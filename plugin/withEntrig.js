const {
  withInfoPlist,
  withEntitlementsPlist,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin for Entrig React Native SDK
 * Automatically configures push notification entitlements, capabilities,
 * and AppDelegate hooks.
 *
 * Add to app.json:
 * {
 *   "expo": {
 *     "plugins": ["@entrig/react-native"]
 *   }
 * }
 */
function withEntrig(config) {
  config = withInfoPlist(config, modifyInfoPlist);
  config = withEntitlementsPlist(config, modifyEntitlementsPlist);
  config = withDangerousMod(config, ['ios', modifyAppDelegate]);
  return config;
}

/**
 * Add UIBackgroundModes with remote-notification to Info.plist
 */
function modifyInfoPlist(config) {
  const infoPlist = config.modResults;

  if (!infoPlist.UIBackgroundModes) {
    infoPlist.UIBackgroundModes = [];
  }

  if (!infoPlist.UIBackgroundModes.includes('remote-notification')) {
    infoPlist.UIBackgroundModes.push('remote-notification');
  }

  return config;
}

/**
 * Add APS environment to entitlements
 */
function modifyEntitlementsPlist(config) {
  const entitlements = config.modResults;

  if (!entitlements['aps-environment']) {
    entitlements['aps-environment'] = 'development';
  }

  return config;
}

/**
 * Inject AppDelegate hooks for push notification handling.
 * Handles both Swift (modern Expo/RN 0.71+) and ObjC AppDelegates.
 */
async function modifyAppDelegate(config) {
  const iosRoot = path.join(config.modRequest.platformProjectRoot);

  // Find the app delegate file
  const appName = config.modRequest.projectName || config.name;
  const swiftPath = path.join(iosRoot, appName, 'AppDelegate.swift');
  const objcPath = path.join(iosRoot, appName, 'AppDelegate.mm');

  if (fs.existsSync(swiftPath)) {
    patchSwiftAppDelegate(swiftPath);
  } else if (fs.existsSync(objcPath)) {
    patchObjCAppDelegate(objcPath);
  }

  return config;
}

// ---------------------------------------------------------------------------
// Swift AppDelegate patching (Expo prebuild generates Swift by default)
// ---------------------------------------------------------------------------

function patchSwiftAppDelegate(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Already configured?
  if (content.includes('Entrig.checkLaunchNotification') || content.includes('EntrigSDK')) {
    return;
  }

  // Detect if this is an Expo SDK 54+ AppDelegate (inherits from ExpoAppDelegate)
  const isExpoSDK54 = content.includes('ExpoAppDelegate');

  // 1. Add imports
  if (!content.includes('import UserNotifications')) {
    const importMatch = content.match(/^import \w+/m);
    if (importMatch) {
      content = content.replace(
        importMatch[0],
        importMatch[0] + '\nimport UserNotifications'
      );
    }
  }

  if (!content.includes('import EntrigSDK')) {
    const importMatch = content.match(/^import \w+/m);
    if (importMatch) {
      content = content.replace(
        importMatch[0],
        importMatch[0] + '\nimport EntrigSDK'
      );
    }
  }

  // 2. Add UNUserNotificationCenterDelegate conformance to the class
  if (!content.includes('UNUserNotificationCenterDelegate')) {
    // For Expo SDK 54+, match pattern like: public class AppDelegate: ExpoAppDelegate {
    // For older RN/Expo, match pattern like: class AppDelegate: UIResponder, UIApplicationDelegate {
    const classPattern = isExpoSDK54
      ? /(public\s+class\s+AppDelegate\s*:\s*ExpoAppDelegate)\s*\{/
      : /(class\s+AppDelegate\s*:\s*[^{]+)\{/;
    const classMatch = content.match(classPattern);
    if (classMatch) {
      const declaration = classMatch[1].trimEnd();
      content = content.replace(
        classMatch[0],
        declaration + ', UNUserNotificationCenterDelegate {'
      );
    }
  }

  // 3. Add setup code inside didFinishLaunchingWithOptions
  if (!content.includes('Entrig.checkLaunchNotification')) {
    // Pattern matches both old and new Expo formats (with/without override keyword and multiline)
    const didFinishPattern =
      /(public\s+)?override\s+func\s+application\(\s*_\s+application:\s*UIApplication,\s*didFinishLaunchingWithOptions\s+launchOptions:[^)]*\)\s*->\s*Bool\s*\{/s;
    let didFinishMatch = content.match(didFinishPattern);

    // Fallback for older format without override
    if (!didFinishMatch) {
      didFinishMatch = content.match(
        /func\s+application\(\s*_\s+application:\s*UIApplication,\s*didFinishLaunchingWithOptions\s+launchOptions:[^)]*\)\s*->\s*Bool\s*\{/s
      );
    }

    if (didFinishMatch) {
      const insertPos = didFinishMatch.index + didFinishMatch[0].length;
      const setupCode = `
    // Entrig: Setup push notification handling
    UNUserNotificationCenter.current().delegate = self
    Entrig.checkLaunchNotification(launchOptions)
`;
      content = content.slice(0, insertPos) + setupCode + content.slice(insertPos);
    }
  }

  // 4. Add delegate methods before the closing brace of the AppDelegate class
  if (!content.includes('didRegisterForRemoteNotificationsWithDeviceToken')) {
    // Use 'public' keyword for Expo SDK 54+
    const publicKeyword = isExpoSDK54 ? 'public ' : '';
    const delegateMethods = `
  // MARK: - Entrig Push Notification Handling

  ${publicKeyword}override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    Entrig.didRegisterForRemoteNotifications(deviceToken: deviceToken)
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }

  ${publicKeyword}override func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    Entrig.didFailToRegisterForRemoteNotifications(error: error)
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }

  ${publicKeyword}func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    Entrig.willPresentNotification(notification)
    completionHandler(Entrig.getPresentationOptions())
  }

  ${publicKeyword}func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    Entrig.didReceiveNotification(response)
    completionHandler()
  }
`;

    const lastBrace = findClassClosingBrace(content);
    if (lastBrace !== -1) {
      content = content.slice(0, lastBrace) + delegateMethods + content.slice(lastBrace);
    }
  }

  fs.writeFileSync(filePath, content);
}

// ---------------------------------------------------------------------------
// ObjC AppDelegate patching (older Expo/RN projects)
// ---------------------------------------------------------------------------

function patchObjCAppDelegate(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Already configured?
  if (content.includes('[Entrig checkLaunchNotification') || content.includes('EntrigSDK')) {
    return;
  }

  // 1. Add imports
  if (!content.includes('UserNotifications/UserNotifications.h')) {
    content = '#import <UserNotifications/UserNotifications.h>\n' + content;
  }

  if (!content.includes('@import EntrigSDK')) {
    content = '@import EntrigSDK;\n' + content;
  }

  // 2. Add UNUserNotificationCenterDelegate to interface
  if (!content.includes('UNUserNotificationCenterDelegate')) {
    const interfacePattern = /(@interface\s+AppDelegate[^>]*>)/;
    const interfaceMatch = content.match(interfacePattern);
    if (interfaceMatch) {
      // Check if there's already a protocol list
      if (interfaceMatch[0].includes('<')) {
        // Add to existing protocol list before the closing >
        content = content.replace(
          interfaceMatch[0],
          interfaceMatch[0].replace('>', ', UNUserNotificationCenterDelegate>')
        );
      }
    }
  }

  // 3. Add setup in didFinishLaunchingWithOptions
  if (!content.includes('[Entrig checkLaunchNotification')) {
    const didFinishPattern =
      /(-\s*\(BOOL\)application:.*?didFinishLaunchingWithOptions:.*?\{)/s;
    const didFinishMatch = content.match(didFinishPattern);

    if (didFinishMatch) {
      const insertPos = didFinishMatch.index + didFinishMatch[0].length;
      const setupCode = `
  // Entrig: Setup push notification handling
  [UNUserNotificationCenter currentNotificationCenter].delegate = self;
  [Entrig checkLaunchNotification:launchOptions];
`;
      content = content.slice(0, insertPos) + setupCode + content.slice(insertPos);
    }
  }

  // 4. Add delegate methods before @end
  if (!content.includes('didRegisterForRemoteNotificationsWithDeviceToken')) {
    const endIdx = content.lastIndexOf('@end');
    if (endIdx !== -1) {
      const delegateMethods = `
// MARK: - Entrig Push Notification Handling

- (void)application:(UIApplication *)application
    didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {
  [Entrig didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
}

- (void)application:(UIApplication *)application
    didFailToRegisterForRemoteNotificationsWithError:(NSError *)error {
  [Entrig didFailToRegisterForRemoteNotificationsWithError:error];
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler {
  [Entrig willPresentNotification:notification];
  completionHandler([Entrig getPresentationOptions]);
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
    didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completionHandler {
  [Entrig didReceiveNotification:response];
  completionHandler();
}

`;
      content = content.slice(0, endIdx) + delegateMethods + content.slice(endIdx);
    }
  }

  fs.writeFileSync(filePath, content);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findClassClosingBrace(content) {
  const classStart = content.indexOf('class AppDelegate');
  if (classStart === -1) return -1;

  const openBrace = content.indexOf('{', classStart);
  if (openBrace === -1) return -1;

  let depth = 1;
  let i = openBrace + 1;
  while (i < content.length && depth > 0) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') depth--;
    if (depth === 0) return i;
    i++;
  }
  return -1;
}

module.exports = withEntrig;
