Plan: @entrig/react-native SDK

  File Structure

  entrig-react-native/
  ├── package.json
  ├── tsconfig.json
  ├── src/
  │   ├── index.ts                  # ← copy from expo, replace requireNativeModule
  │   ├── types.ts                  # ← copy Entrig.types.ts as-is
  │   └── EntrigModule.ts           # NativeModules bridge (new, ~10 lines)
  ├── android/
  │   ├── build.gradle              # new (RN library style, not Expo)
  │   └── src/main/
  │       ├── AndroidManifest.xml
  │       └── java/com/entrig/reactnative/
  │           └── EntrigModule.kt   # rewrite from Expo's EntrigModule.kt
  │           └── EntrigPackage.kt  # new (RN boilerplate)
  ├── ios/
  │   ├── EntrigReactNative.podspec # new (depends on EntrigSDK, React-Core)
  │   ├── EntrigModule.swift        # rewrite from Expo's EntrigModule.swift
  │   └── EntrigModule.m            # ObjC bridge macro (~5 lines)
  ├── app.plugin.js                 # Expo config plugin (replaces expo-module.config.json + bin/setup.js)
  └── plugin/
      └── withEntrig.js             # config plugin logic (from bin/setup.js)

  Step-by-step with copy/rewrite mapping

  | #   | Task                          | Source                                  | Action

                                                                                         |
  |-----|-------------------------------|-----------------------------------------|--------------------------
  -----------------------------------------------------------------------------------------------------------
  ---------------------------------------------------------------------------------------|
  | 1   | src/types.ts                  | entrig-expo/src/Entrig.types.ts         | Copy as-is

                                                                                         |
  | 2   | src/EntrigModule.ts           | entrig-expo/src/EntrigModule.ts         | Rewrite — replace
  requireNativeModule with RN NativeModules + NativeEventEmitter
                                                                                                |
  | 3   | src/index.ts                  | entrig-expo/src/index.ts                | Rewrite — export from new
   EntrigModule.ts, expose useEntrigEvent hook
                                                                                         |
  | 4   | android/build.gradle          | entrig-expo/android/build.gradle        | Rewrite — remove Expo
  plugin, use standard RN library gradle template, keep api 'com.entrig:entrig:0.0.10-dev'
                                                                                            |
  | 5   | android/.../EntrigModule.kt   | entrig-expo/android/.../EntrigModule.kt | Rewrite — change base
  class from expo.modules.kotlin.modules.Module → ReactContextBaseJavaModule, replace
  Promise/Events/OnNewIntent. Business logic (Entrig.initialize, register, etc.) is identical — copy those 
  blocks. |
  | 6   | android/.../EntrigPackage.kt  | —                                       | New — RN boilerplate
  ReactPackage (~15 lines)
                                                                                             |
  | 7   | ios/EntrigModule.swift        | entrig-expo/ios/EntrigModule.swift      | Rewrite — change base
  class from ExpoModulesCore.Module → RCTEventEmitter, replace DSL with @objc methods + RCT_EXTERN_METHOD.
  Business logic (Entrig.configure, register, etc.) is identical — copy those blocks.         |
  | 8   | ios/EntrigModule.m            | —                                       | New — ObjC bridge file
  (~10 lines of RCT_EXTERN_METHOD macros)
                                                                                           |
  | 9   | ios/EntrigReactNative.podspec | entrig-expo/ios/Entrig.podspec          | Rewrite — replace
  ExpoModulesCore dependency with React-Core, keep EntrigSDK dep
                                                                                                |
  | 10  | plugin/withEntrig.js          | entrig-expo/bin/setup.js                | Adapt — convert
  imperative file patching into Expo config plugin format (withInfoPlist, withEntitlementsPlist,
  withAppDelegate). Same logic for entitlements + UIBackgroundModes.
   |
  | 11  | app.plugin.js                 | —                                       | New — one-liner:
  module.exports = require('./plugin/withEntrig')
                                                                                                 |
  | 12  | package.json                  | entrig-expo/package.json                | Rewrite — change name to
  @entrig/react-native, remove expo deps, add react-native peer dep, add "expo-plugin" field
                                                                                         |

  Key differences from Expo SDK

  - No expo-module.config.json — replaced by app.plugin.js config plugin
  - No EntrigAppDelegateSubscriber.swift — the config plugin injects AppDelegate hooks
  (didRegisterForRemoteNotifications, UNUserNotificationCenterDelegate) at prebuild time
  - No bin/setup.js — the config plugin handles entitlements + Info.plist automatically
  - Android OnNewIntent — handled via ActivityEventListener on ReactContext instead of Expo's lifecycle hook

  Expo compatibility

  Users add to app.json:
  {
    "expo": {
      "plugins": ["@entrig/react-native"]
    }
  }

  The config plugin runs at npx expo prebuild and modifies the native projects, same end result as the
  current setup CLI + expo-module.config.json.