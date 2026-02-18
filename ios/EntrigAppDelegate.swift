import UIKit
import UserNotifications
import EntrigSDK

/// Helper class that wires up the iOS AppDelegate hooks required by the Entrig SDK.
///
/// **For Expo users**: The config plugin (`app.plugin.js`) injects these hooks
/// at prebuild time, so this file is not used.
///
/// **For bare React Native users**: Call `EntrigAppDelegate.setup(launchOptions:)`
/// from your AppDelegate's `didFinishLaunchingWithOptions` and forward the
/// other delegate methods as shown below.
///
/// ```swift
/// // AppDelegate.swift
/// import EntrigSDK
///
/// @main
/// class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
///   func application(_ application: UIApplication,
///                    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
///     UNUserNotificationCenter.current().delegate = self
///     EntrigAppDelegate.setup(launchOptions: launchOptions)
///     return true
///   }
///
///   func application(_ application: UIApplication,
///                    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
///     Entrig.didRegisterForRemoteNotifications(deviceToken: deviceToken)
///   }
///
///   func application(_ application: UIApplication,
///                    didFailToRegisterForRemoteNotificationsWithError error: Error) {
///     Entrig.didFailToRegisterForRemoteNotifications(error: error)
///   }
///
///   func userNotificationCenter(_ center: UNUserNotificationCenter,
///                               willPresent notification: UNNotification,
///                               withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
///     Entrig.willPresentNotification(notification)
///     completionHandler(Entrig.getPresentationOptions())
///   }
///
///   func userNotificationCenter(_ center: UNUserNotificationCenter,
///                               didReceive response: UNNotificationResponse,
///                               withCompletionHandler completionHandler: @escaping () -> Void) {
///     Entrig.didReceiveNotification(response)
///     completionHandler()
///   }
/// }
/// ```
@objc public class EntrigAppDelegate: NSObject {

  /// Call from `didFinishLaunchingWithOptions` to check for cold-start notifications.
  @objc public static func setup(launchOptions: [UIApplication.LaunchOptionsKey: Any]?) {
    Entrig.checkLaunchNotification(launchOptions)
  }
}
