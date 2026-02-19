# Entrig

**Push Notifications for Supabase**

Send push notifications to your React Native app, triggered by database events.

---


## Prerequisites

1. **Create Entrig Account** - Sign up at [entrig.com](https://entrig.com)

2. **Connect Supabase** - Authorize Entrig to access your Supabase project

   <details>
   <summary>How it works (click to expand)</summary>

   During onboarding, you'll:
   1. Click the "Connect Supabase" button
   2. Sign in to your Supabase account (if not already signed in)
   3. Authorize Entrig to access your project
   4. Select which project to use (if you have multiple)

   That's it! Entrig will automatically set up everything needed to send notifications. No manual SQL or configuration required.

   </details>

3. **Upload FCM Service Account** (Android) - Upload Service Account JSON and provide your Application ID

   <details>
   <summary>How to get FCM Service Account JSON (click to expand)</summary>

   1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
   2. Add your Android app to the project
   3. Go to Project Settings → Service Accounts
   4. Click "Firebase Admin SDK"
   5. Click "Generate new private key"
   6. Download the JSON file
   7. Upload this file to the Entrig dashboard

   </details>

   <details>
   <summary>What is Application ID? (click to expand)</summary>

   The Application ID is your Android app's package name (e.g., `com.example.myapp`). You can find it in:
   - Your `android/app/build.gradle` file under `applicationId`
   - Or in your `AndroidManifest.xml` under the `package` attribute

   </details>

   > **Note:** If you've configured iOS in your Firebase console, you can use FCM for both Android and iOS, which will skip the APNs setup step.

4. **Upload APNs Key** (iOS) - Upload `.p8` key file with Team ID, Bundle ID, and Key ID to Entrig

   <details>
   <summary>How to get APNs Authentication Key (click to expand)</summary>

   1. Enroll in [Apple Developer Program](https://developer.apple.com/programs/)
   2. Go to [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources)
   3. Navigate to Keys → Click "+" to create a new key
   4. Enter a key name and enable "Apple Push Notifications service (APNs)"
   5. Click "Continue" then "Register"
   6. Download the `.p8` key file (you can only download this once!)
   7. Note your **Key ID** (shown on the confirmation page - 10 alphanumeric characters)
   8. Note your **Team ID** (found in Membership section of your Apple Developer account - 10 alphanumeric characters)
   9. Note your **Bundle ID** (found in your Xcode project settings or `Info.plist` - reverse domain format like `com.example.app`)
   10. Upload the `.p8` file along with Team ID, Bundle ID, and Key ID to the Entrig dashboard

   </details>

   <details>
   <summary>Production vs Sandbox environments (click to expand)</summary>

   Entrig supports configuring both APNs environments:
   - **Production**: For App Store releases and TestFlight builds
   - **Sandbox**: For development builds via Xcode

   You can configure one or both environments during onboarding. Developers typically need Sandbox for testing and Production for live releases. You can use the same APNs key for both environments, but you'll need to provide the configuration separately for each.

   </details>

---

## Installation

```bash
npm install @entrig/react-native
```

or

```bash
yarn add @entrig/react-native
```

---

## Platform Setup

### Android

No setup required for Android. We'll take care of it.

### iOS

#### Expo (Managed Workflow)

Add the plugin to your `app.json`:

```json
{
  "expo": {
    "plugins": ["@entrig/react-native"]
  }
}
```

Then run prebuild:

```bash
npx expo prebuild
```

This automatically configures:
- AppDelegate with Entrig notification handlers
- Entitlements with push notification capabilities
- Info.plist with background modes

#### Bare React Native — Automatic Setup (Recommended)

Run this command in your project root:

```bash
npx @entrig/react-native setup ios
```

This automatically configures:
- AppDelegate.swift with Entrig notification handlers
- Entitlements with push notification capabilities (creates the file if it doesn't exist)
- Info.plist with background modes
- project.pbxproj with CODE_SIGN_ENTITLEMENTS reference

> **Note:** The command creates `.backup` files for safety. You can delete them after verifying everything works.

<details>
<summary>Manual AppDelegate setup (click to expand)</summary>

#### 1. Enable Push Notifications in Xcode

- Open `ios/YourApp.xcworkspace`
- Select your target → Signing & Capabilities
- Click `+ Capability` → Push Notifications
- Click `+ Capability` → Background Modes → Enable `Remote notifications`

#### 2. Update AppDelegate.swift

Add `import UserNotifications` and `import EntrigSDK`, add `UNUserNotificationCenterDelegate` conformance, then add the notification methods.

**RN 0.74+ (new style — `UIResponder, UIApplicationDelegate`)**

```swift
import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import UserNotifications
import EntrigSDK

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
  var window: UIWindow?
  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    UNUserNotificationCenter.current().delegate = self
    Entrig.checkLaunchNotification(launchOptions)

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()
    reactNativeDelegate = delegate
    reactNativeFactory = factory
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(withModuleName: "YourApp", in: window, launchOptions: launchOptions)
    return true
  }

  func application(_ application: UIApplication,
                   didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    Entrig.didRegisterForRemoteNotifications(deviceToken: deviceToken)
  }

  func application(_ application: UIApplication,
                   didFailToRegisterForRemoteNotificationsWithError error: Error) {
    Entrig.didFailToRegisterForRemoteNotifications(error: error)
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
}
```

> Replace `"YourApp"` with your actual module name.

**RN 0.71–0.73 (old style — `RCTAppDelegate`)**

```swift
import UIKit
import UserNotifications
import EntrigSDK

@main
class AppDelegate: RCTAppDelegate, UNUserNotificationCenterDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    UNUserNotificationCenter.current().delegate = self
    Entrig.checkLaunchNotification(launchOptions)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

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
}
```

</details>

---

## Troubleshooting

<details>
<summary>Native Entrig module not found (iOS)</summary>

This means the `EntrigReactNative` pod was not installed. Run:

```bash
cd ios && pod install
```

Then rebuild the app. If the error persists, verify `EntrigReactNative` appears in `ios/Podfile.lock`:

```bash
grep "EntrigReactNative" ios/Podfile.lock
```

If it's missing, make sure you are on `@entrig/react-native` version that includes the root-level `EntrigReactNative.podspec` and re-run `pod install`.

</details>

<details>
<summary>Push token not generated (iOS)</summary>

The device token won't be generated if the AppDelegate is not configured. Run the setup command:

```bash
npx @entrig/react-native setup ios
```

Then rebuild. Also ensure:
- Push Notifications capability is added in Xcode (Target → Signing & Capabilities)
- You are testing on a **real device** (simulators cannot receive push notifications)
- The APNs key is uploaded to your Entrig dashboard

</details>

<details>
<summary>Cannot read Config / env variables undefined</summary>

`react-native-config` requires native setup on both platforms. The simplest alternative is [`react-native-dotenv`](https://github.com/goatandsheep/react-native-dotenv) (a Babel plugin — no native setup needed):

```bash
npm install react-native-dotenv
```

Add to `babel.config.js`:
```js
module.exports = {
  plugins: [['module:react-native-dotenv']]
};
```

Then import:
```ts
import { ENTRIG_API_KEY } from '@env';
```

</details>

<details>
<summary>pod install CocoaPods dependency errors</summary>

Try cleaning and reinstalling:

```bash
cd ios
rm Podfile.lock
rm -rf Pods
pod deintegrate
pod repo update
pod install
```

</details>


---

## Usage

### Initialize

```typescript
import Entrig from '@entrig/react-native';

// Initialize Entrig (call once at app startup)
await Entrig.init({ apiKey: 'YOUR_ENTRIG_API_KEY' });
```

<details>
<summary>How to get your Entrig API key (click to expand)</summary>

1. Sign in to your Entrig account at [entrig.com](https://entrig.com)
2. Go to your dashboard
3. Navigate to your project settings
4. Copy your **API Key** from the project settings page
5. Use this API key in the `Entrig.init()` call above

</details>

### Register/Unregister Devices

<details>
<summary>Automatic registration with Supabase Auth (Recommended - click to expand)</summary>

Listen to Supabase auth state changes and automatically register/unregister devices:

```typescript
import { useEffect } from 'react';
import Entrig from '@entrig/react-native';
import { supabase } from './supabase'; // your Supabase client

function App() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // User signed in - register device
          await Entrig.register(session.user.id);
        } else {
          // User signed out - unregister device
          await Entrig.unregister();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return <YourApp />;
}
```

> **Important:** Devices are registered with the **Supabase Auth user ID** (`auth.users.id`). When creating notifications, make sure the user identifier field you select contains this same Supabase Auth user ID to ensure notifications are delivered to the correct users.

</details>

<details>
<summary>Manual registration (click to expand)</summary>

**Register device:**
```typescript
const { data: { user } } = await supabase.auth.getUser();
if (user) {
  await Entrig.register(user.id);
}
```

**Unregister device:**
```typescript
await Entrig.unregister();
```

> **Note:** `register()` automatically handles permission requests. The `userId` you pass here must match the user identifier field you select when creating notifications.

</details>

<details>
<summary>Custom permission handling (click to expand)</summary>

If you want to handle notification permissions yourself, disable automatic permission handling:

```typescript
await Entrig.init({
  apiKey: 'YOUR_ENTRIG_API_KEY',
  handlePermission: false,
});
```

Then request permissions manually before registering:

```typescript
const granted = await Entrig.requestPermission();
```

</details>

### Listen to Notifications

**Using the `useEntrigEvent` hook** (Recommended):

```typescript
import { useEntrigEvent } from '@entrig/react-native';

function MyComponent() {
  // Foreground notifications (when app is open)
  useEntrigEvent('foreground', (event) => {
    console.log('Notification received:', event.title, event.body);
  });

  // Notification tap (when user taps a notification)
  useEntrigEvent('opened', (event) => {
    // Navigate to specific screen based on event.data
    console.log('Notification opened:', event.data);
  });

  return <YourComponent />;
}
```

**Using event listeners directly:**

```typescript
import Entrig from '@entrig/react-native';

// Foreground notifications
const subscription = Entrig.onForegroundNotification((event) => {
  console.log('Foreground:', event.title, event.body);
});

// Notification tap
const subscription2 = Entrig.onNotificationOpened((event) => {
  console.log('Opened:', event.data);
});

// Clean up when done
subscription.remove();
subscription2.remove();
```

**Get the notification that launched the app** (cold start):

```typescript
const notification = await Entrig.getInitialNotification();
if (notification) {
  // App was launched from a notification tap
  console.log('Launched from notification:', notification.data);
}
```

**NotificationEvent** contains:
- `title` - Notification title
- `body` - Notification body text
- `data` - Custom payload data from your database
- `isForeground` - Whether the notification was received in the foreground

---

## Creating Notifications

<details>
<summary>Learn how to create notification triggers in the dashboard (click to expand)</summary>

Create notification triggers in the Entrig dashboard. The notification creation form has two sections: configuring the trigger and composing the notification message.

### Section 1: Configure Trigger

Set up when and to whom notifications should be sent.

#### 1. Select Table
Choose the database table where events will trigger notifications (e.g., `messages`, `orders`). This is the "trigger table" that activates the notification.

#### 2. Select Event
Choose which database operation triggers the notification:
- **INSERT** - When new rows are created
- **UPDATE** - When existing rows are modified
- **DELETE** - When rows are deleted

#### 3. Select User Identifier
Specify how to identify notification recipients. Toggle "Use join table" to switch between modes.

> **Important:** The user identifier field you select here must contain the same user ID that was used when registering the device. This should be the Supabase Auth user ID (`auth.users.id`).

**Single User Mode** (Default):
- Select a field that contains the user ID directly
- Supports foreign key navigation (e.g., navigate through `orders.customer_id` to reach `customers.user_id`)
- Example: For a `messages` table with `user_id` field, select `user_id`

**Multi-User Mode** (Join Table):
- Use when one database event should notify multiple users
- Requires configuring the relationship between tables:

  **Event Table Section:**
  - **Lookup Field**: Select a foreign key field that links to your join table
    - Example: For notifying all room members when a message is sent, select `room_id` from the `messages` table

  **Join Table Section:**
  - **Join Table**: Select the table containing recipient records
    - Example: `room_members` table that links rooms to users
  - **Matching Field**: Field in the join table that matches your lookup field
    - Usually auto-populated to match the lookup field name
  - **User ID Field**: Field containing the actual user identifiers
    - Supports foreign key navigation
    - Should contain the same user ID used during device registration

#### 4. Event Conditions (Optional)
Filter when notifications are sent based on the trigger event data:
- Add conditions to control notification sending (e.g., only when `status = 'completed'`)
- Supports multiple conditions with AND/OR logic

#### 5. Recipient Filters (Optional, Multi-User only)
Filter which users receive the notification based on join table data:
- Example: Only notify users where `role = 'admin'` in the join table

### Section 2: Compose Notification

Design the notification content that users will see.

#### 1. Payload Data (Optional)
Select database fields to use as dynamic placeholders:
- Click "Add Fields" to open the field selector
- Selected fields appear as clickable pills (e.g., `{{messages.content}}`)
- Click any pill to insert it at your cursor position in title or body

#### 2. Title & Body
Write your notification text using placeholders:
- Use double-brace format: `{{table.column}}`
- Example Title: `New message from {{users.name}}`
- Example Body: `{{messages.content}}`
- Placeholders are replaced with actual data when notifications are sent

### Example Use Cases

**Single User Notification:**
- **Table**: `orders`, **Event**: `INSERT`
- **User ID**: `customer_id`
- **Title**: `Order Confirmed!`
- **Body**: `Your order #{{orders.id}} has been received`

**Multi-User Notification (Group Chat):**
- **Table**: `messages`, **Event**: `INSERT`
- **Lookup Field**: `room_id`
- **Join Table**: `room_members`
- **Matching Field in Join Table**: `room_id`
- **User ID**: `user_id`
- **Title**: `New message in {{rooms.name}}`
- **Body**: `{{users.name}}: {{messages.content}}`

</details>

---

## Support

- Email: team@entrig.com

---
