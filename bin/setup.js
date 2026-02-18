#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);

if (args.length < 1 || args[0] !== "ios") {
  console.log("Usage: npx @entrig/react-native setup ios");
  process.exit(1);
}

console.log("🔧 Entrig iOS Setup for React Native\n");

// Find iOS directory
const iosDir = path.join(process.cwd(), "ios");
if (!fs.existsSync(iosDir)) {
  console.log("❌ Error: ios/ directory not found");
  console.log("   Make sure you run this from your React Native project root.");
  process.exit(1);
}

// Find the app directory in ios/
let appName = null;
const iosDirs = fs.readdirSync(iosDir).filter((f) => {
  const stat = fs.statSync(path.join(iosDir, f));
  return (
    stat.isDirectory() &&
    !f.startsWith(".") &&
    f !== "Pods" &&
    f !== "build" &&
    !f.endsWith(".xcodeproj") &&
    !f.endsWith(".xcworkspace")
  );
});
if (iosDirs.length > 0) {
  appName = iosDirs[0];
}

if (!appName) {
  console.log("❌ Error: Could not determine app name from ios/ directory");
  process.exit(1);
}

console.log(`✅ Found iOS project: ${appName}\n`);

// Step 1: Patch AppDelegate
patchAppDelegate(iosDir, appName);

// Step 2: Update entitlements (create if needed)
updateEntitlements(iosDir, appName);

// Step 3: Update Info.plist
updateInfoPlist(iosDir, appName);

console.log("\n🎉 Setup complete! Rebuild your iOS app to apply changes.\n");

// ---------------------------------------------------------------------------
// AppDelegate patching
// ---------------------------------------------------------------------------

function patchAppDelegate(iosDir, appName) {
  // Try Swift first, then ObjC
  const swiftPath = path.join(iosDir, appName, "AppDelegate.swift");
  const objcPath = path.join(iosDir, appName, "AppDelegate.mm");
  const objcMPath = path.join(iosDir, appName, "AppDelegate.m");

  if (fs.existsSync(swiftPath)) {
    patchSwiftAppDelegate(swiftPath);
  } else if (fs.existsSync(objcPath)) {
    patchObjCAppDelegate(objcPath);
  } else if (fs.existsSync(objcMPath)) {
    patchObjCAppDelegate(objcMPath);
  } else {
    console.log("⚠️  Warning: No AppDelegate found (checked .swift, .mm, .m)");
    console.log("   You will need to manually configure notification handling.");
    console.log("   See ios/EntrigAppDelegate.swift in the package for guidance.\n");
  }
}

function patchSwiftAppDelegate(filePath) {
  console.log(`📝 Checking ${path.relative(process.cwd(), filePath)}...`);

  let content = fs.readFileSync(filePath, "utf8");

  // Already configured?
  if (content.includes("Entrig.checkLaunchNotification") || content.includes("EntrigAppDelegate.setup")) {
    console.log("✅ Entrig is already configured in AppDelegate.swift");
    return;
  }

  // Check for existing delegate methods that would conflict
  if (hasExistingDelegateMethods(content)) {
    printManualSwiftInstructions();
    return;
  }

  // Backup
  const backupPath = filePath + ".backup";
  fs.copyFileSync(filePath, backupPath);
  console.log(`💾 Backup created: ${path.relative(process.cwd(), backupPath)}`);

  // 1. Add imports
  if (!content.includes("import UserNotifications")) {
    // Insert after the first import line
    const importMatch = content.match(/^import \w+/m);
    if (importMatch) {
      content = content.replace(
        importMatch[0],
        importMatch[0] + "\nimport UserNotifications"
      );
    }
  }

  if (!content.includes("import EntrigSDK")) {
    const importMatch = content.match(/^import \w+/m);
    if (importMatch) {
      content = content.replace(
        importMatch[0],
        importMatch[0] + "\nimport EntrigSDK"
      );
    }
  }

  // 2. Add UNUserNotificationCenterDelegate conformance
  if (!content.includes("UNUserNotificationCenterDelegate")) {
    // Match class declaration patterns:
    //   class AppDelegate: RCTAppDelegate {
    //   class AppDelegate: UIResponder, UIApplicationDelegate {
    const classPattern = /(class\s+AppDelegate\s*:\s*[^{]+)\{/;
    const classMatch = content.match(classPattern);
    if (classMatch) {
      const declaration = classMatch[1].trimEnd();
      content = content.replace(
        classMatch[0],
        declaration + ", UNUserNotificationCenterDelegate {"
      );
    }
  }

  // 3. Add setup code inside didFinishLaunchingWithOptions
  const didFinishPattern =
    /func application\(\s*_\s+application:\s*UIApplication,\s*didFinishLaunchingWithOptions\s+launchOptions:[^)]*\)\s*->\s*Bool\s*\{/s;
  const didFinishMatch = content.match(didFinishPattern);

  if (didFinishMatch) {
    const insertPos = didFinishMatch.index + didFinishMatch[0].length;
    const setupCode = `
    // Entrig: Setup push notification handling
    UNUserNotificationCenter.current().delegate = self
    Entrig.checkLaunchNotification(launchOptions)
`;
    content =
      content.slice(0, insertPos) + setupCode + content.slice(insertPos);
  }

  // 4. Add delegate methods before the closing brace of the class
  const delegateMethods = `
  // MARK: - Entrig Push Notification Handling

  override func application(_ application: UIApplication,
      didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    Entrig.didRegisterForRemoteNotifications(deviceToken: deviceToken)
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }

  override func application(_ application: UIApplication,
      didFailToRegisterForRemoteNotificationsWithError error: Error) {
    Entrig.didFailToRegisterForRemoteNotifications(error: error)
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }

  func userNotificationCenter(_ center: UNUserNotificationCenter,
                               willPresent notification: UNNotification,
                               withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
    Entrig.willPresentNotification(notification)
    completionHandler(Entrig.getPresentationOptions())
  }

  func userNotificationCenter(_ center: UNUserNotificationCenter,
                               didReceive response: UNNotificationResponse,
                               withCompletionHandler completionHandler: @escaping () -> Void) {
    Entrig.didReceiveNotification(response)
    completionHandler()
  }
`;

  // Find the last closing brace of the main AppDelegate class
  // We look for the class-level closing brace
  const lastBrace = findClassClosingBrace(content);
  if (lastBrace !== -1) {
    content =
      content.slice(0, lastBrace) + delegateMethods + content.slice(lastBrace);
  }

  fs.writeFileSync(filePath, content);

  console.log("✅ Successfully configured AppDelegate.swift");
  console.log("   • Added import UserNotifications");
  console.log("   • Added import EntrigSDK");
  console.log("   • Added UNUserNotificationCenterDelegate conformance");
  console.log("   • Added notification delegate setup in didFinishLaunchingWithOptions");
  console.log("   • Added didRegisterForRemoteNotifications");
  console.log("   • Added didFailToRegisterForRemoteNotifications");
  console.log("   • Added userNotificationCenter:willPresent");
  console.log("   • Added userNotificationCenter:didReceive\n");
}

function patchObjCAppDelegate(filePath) {
  console.log(`📝 Checking ${path.relative(process.cwd(), filePath)}...`);

  let content = fs.readFileSync(filePath, "utf8");

  // Already configured?
  if (content.includes("Entrig") && content.includes("checkLaunchNotification")) {
    console.log("✅ Entrig is already configured in AppDelegate");
    return;
  }

  console.log("⚠️  Objective-C AppDelegate detected.");
  console.log("   Automatic patching is only supported for Swift AppDelegates.");
  console.log("   Please manually add the following to your AppDelegate:\n");
  printManualObjCInstructions();
}

function hasExistingDelegateMethods(content) {
  const patterns = [
    /func application\([^)]*didRegisterForRemoteNotificationsWithDeviceToken/,
    /func application\([^)]*didFailToRegisterForRemoteNotificationsWithError/,
    /func userNotificationCenter\([^)]*willPresent/,
    /func userNotificationCenter\([^)]*didReceive.*response/,
  ];

  for (const pattern of patterns) {
    if (pattern.test(content)) {
      return true;
    }
  }
  return false;
}

function findClassClosingBrace(content) {
  // Find "class AppDelegate" then track braces to find its closing }
  const classStart = content.indexOf("class AppDelegate");
  if (classStart === -1) return -1;

  const openBrace = content.indexOf("{", classStart);
  if (openBrace === -1) return -1;

  let depth = 1;
  let i = openBrace + 1;
  while (i < content.length && depth > 0) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") depth--;
    if (depth === 0) return i;
    i++;
  }
  return -1;
}

function printManualSwiftInstructions() {
  console.log(
    "⚠️  Existing notification delegate methods detected in AppDelegate.swift"
  );
  console.log(
    "   Please manually add these calls to your existing methods:\n"
  );
  console.log("   In didFinishLaunchingWithOptions:");
  console.log("     UNUserNotificationCenter.current().delegate = self");
  console.log("     Entrig.checkLaunchNotification(launchOptions)\n");
  console.log("   In didRegisterForRemoteNotificationsWithDeviceToken:");
  console.log(
    "     Entrig.didRegisterForRemoteNotifications(deviceToken: deviceToken)\n"
  );
  console.log("   In didFailToRegisterForRemoteNotificationsWithError:");
  console.log(
    "     Entrig.didFailToRegisterForRemoteNotifications(error: error)\n"
  );
  console.log("   In userNotificationCenter:willPresent:");
  console.log("     Entrig.willPresentNotification(notification)");
  console.log(
    "     completionHandler(Entrig.getPresentationOptions())\n"
  );
  console.log("   In userNotificationCenter:didReceive:");
  console.log("     Entrig.didReceiveNotification(response)\n");
}

function printManualObjCInstructions() {
  console.log("   @import EntrigSDK;");
  console.log("   #import <UserNotifications/UserNotifications.h>\n");
  console.log("   In didFinishLaunchingWithOptions:");
  console.log(
    "     [UNUserNotificationCenter currentNotificationCenter].delegate = self;"
  );
  console.log(
    "     [Entrig checkLaunchNotification:launchOptions];\n"
  );
  console.log("   In didRegisterForRemoteNotificationsWithDeviceToken:");
  console.log(
    "     [Entrig didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];\n"
  );
  console.log("   In userNotificationCenter:willPresent:");
  console.log("     [Entrig willPresentNotification:notification];");
  console.log(
    "     completionHandler([Entrig getPresentationOptions]);\n"
  );
  console.log("   In userNotificationCenter:didReceive:");
  console.log("     [Entrig didReceiveNotification:response];\n");
}

// ---------------------------------------------------------------------------
// Entitlements
// ---------------------------------------------------------------------------

function updateEntitlements(iosDir, appName) {
  // Try common entitlements paths
  const possiblePaths = [
    path.join(iosDir, appName, `${appName}.entitlements`),
    path.join(iosDir, appName, `${appName.replace(/\s/g, "")}.entitlements`),
  ];

  let entitlementsPath = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      entitlementsPath = p;
      break;
    }
  }

  // If no entitlements file exists, create one
  if (!entitlementsPath) {
    entitlementsPath = path.join(iosDir, appName, `${appName}.entitlements`);
    const dir = path.dirname(entitlementsPath);

    if (!fs.existsSync(dir)) {
      console.log(`❌ Error: ${dir} not found`);
      return;
    }

    const defaultEntitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>aps-environment</key>
\t<string>development</string>
</dict>
</plist>`;

    fs.writeFileSync(entitlementsPath, defaultEntitlements);
    console.log(
      `📝 Created: ${path.relative(process.cwd(), entitlementsPath)}`
    );
    console.log("✅ Added aps-environment to entitlements");

    // Try to add CODE_SIGN_ENTITLEMENTS to pbxproj
    addEntitlementsToPbxproj(iosDir, appName);
    return;
  }

  console.log(
    `📝 Checking ${path.relative(process.cwd(), entitlementsPath)}...`
  );

  let content = fs.readFileSync(entitlementsPath, "utf8");

  // Check if aps-environment already exists
  if (content.includes("aps-environment")) {
    console.log("✅ aps-environment already configured");
    return;
  }

  // Backup
  const backupPath = entitlementsPath + ".backup";
  fs.copyFileSync(entitlementsPath, backupPath);
  console.log(
    `💾 Backup created: ${path.relative(process.cwd(), backupPath)}`
  );

  const apsEntry = `\t<key>aps-environment</key>\n\t<string>development</string>\n`;

  // Handle self-closing <dict/> tag
  if (content.includes("<dict/>")) {
    content = content.replace("<dict/>", `<dict>\n${apsEntry}</dict>`);
  } else {
    // Add aps-environment before closing </dict>
    const insertPoint = content.lastIndexOf("</dict>");
    if (insertPoint === -1) {
      console.log("❌ Error: Could not parse entitlements file");
      return;
    }
    content =
      content.slice(0, insertPoint) + apsEntry + content.slice(insertPoint);
  }

  fs.writeFileSync(entitlementsPath, content);
  console.log("✅ Added aps-environment to entitlements");
}

/**
 * Try to add CODE_SIGN_ENTITLEMENTS build setting to the Xcode project
 * so the newly created .entitlements file is picked up automatically.
 */
function addEntitlementsToPbxproj(iosDir, appName) {
  const pbxprojPath = path.join(
    iosDir,
    `${appName}.xcodeproj`,
    "project.pbxproj"
  );

  if (!fs.existsSync(pbxprojPath)) {
    console.log("\n⚠️  Could not find project.pbxproj to add entitlements reference.");
    console.log("   You may need to add the entitlements file in Xcode:");
    console.log(`   1. Open ${appName}.xcworkspace in Xcode`);
    console.log("   2. Select your target → Signing & Capabilities");
    console.log("   3. Click + Capability → Push Notifications\n");
    return;
  }

  let pbxContent = fs.readFileSync(pbxprojPath, "utf8");

  const entitlementsValue = `${appName}/${appName}.entitlements`;

  // Already referenced?
  if (pbxContent.includes("CODE_SIGN_ENTITLEMENTS")) {
    console.log("✅ CODE_SIGN_ENTITLEMENTS already in project.pbxproj");
    return;
  }

  // Backup pbxproj
  const pbxBackup = pbxprojPath + ".backup";
  fs.copyFileSync(pbxprojPath, pbxBackup);

  // Add CODE_SIGN_ENTITLEMENTS to every XCBuildConfiguration that has a
  // PRODUCT_BUNDLE_IDENTIFIER (i.e. app targets, not Pods/tests)
  const configBlockPattern =
    /(\bPRODUCT_BUNDLE_IDENTIFIER\s*=\s*[^;]+;)/g;

  let count = 0;
  pbxContent = pbxContent.replace(configBlockPattern, (match) => {
    count++;
    return (
      match +
      `\n\t\t\t\tCODE_SIGN_ENTITLEMENTS = "${entitlementsValue}";`
    );
  });

  if (count > 0) {
    fs.writeFileSync(pbxprojPath, pbxContent);
    console.log(
      `✅ Added CODE_SIGN_ENTITLEMENTS to project.pbxproj (${count} build configurations)`
    );
    console.log(
      `💾 Backup created: ${path.relative(process.cwd(), pbxBackup)}`
    );
  } else {
    // Clean up backup if we didn't change anything
    fs.unlinkSync(pbxBackup);
    console.log("\n⚠️  Could not auto-add entitlements reference to project.pbxproj.");
    console.log("   Please add Push Notifications capability in Xcode:\n");
    console.log(`   1. Open ${appName}.xcworkspace in Xcode`);
    console.log("   2. Select your target → Signing & Capabilities");
    console.log("   3. Click + Capability → Push Notifications\n");
  }
}

// ---------------------------------------------------------------------------
// Info.plist
// ---------------------------------------------------------------------------

function updateInfoPlist(iosDir, appName) {
  const infoPlistPath = path.join(iosDir, appName, "Info.plist");

  if (!fs.existsSync(infoPlistPath)) {
    console.log(
      `⚠️  Warning: ${path.relative(process.cwd(), infoPlistPath)} not found`
    );
    return;
  }

  console.log(
    `📝 Checking ${path.relative(process.cwd(), infoPlistPath)}...`
  );

  let content = fs.readFileSync(infoPlistPath, "utf8");

  // Check if UIBackgroundModes with remote-notification already exists
  if (
    content.includes("UIBackgroundModes") &&
    content.includes("remote-notification")
  ) {
    console.log("✅ UIBackgroundModes already configured");
    return;
  }

  // Backup
  const backupPath = infoPlistPath + ".backup";
  fs.copyFileSync(infoPlistPath, backupPath);
  console.log(
    `💾 Backup created: ${path.relative(process.cwd(), backupPath)}`
  );

  if (content.includes("UIBackgroundModes")) {
    // Add remote-notification to existing array
    const arrayMatch = content.match(
      /<key>UIBackgroundModes<\/key>\s*<array>/
    );
    if (arrayMatch) {
      const insertPoint = arrayMatch.index + arrayMatch[0].length;
      const newEntry = "\n\t\t<string>remote-notification</string>";
      content =
        content.slice(0, insertPoint) +
        newEntry +
        content.slice(insertPoint);
    }
  } else {
    // Add UIBackgroundModes array before closing </dict>
    const plistEnd = content.lastIndexOf("</plist>");
    const dictEnd = content.lastIndexOf("</dict>", plistEnd);

    if (dictEnd === -1) {
      console.log("❌ Error: Could not parse Info.plist");
      return;
    }

    const bgModes = `\t<key>UIBackgroundModes</key>\n\t<array>\n\t\t<string>remote-notification</string>\n\t</array>\n`;
    content =
      content.slice(0, dictEnd) + bgModes + content.slice(dictEnd);
  }

  fs.writeFileSync(infoPlistPath, content);
  console.log("✅ Added remote-notification to UIBackgroundModes");
}
