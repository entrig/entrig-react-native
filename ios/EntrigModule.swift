import React
import UserNotifications
import EntrigSDK

@objc(Entrig)
class EntrigModule: RCTEventEmitter {
  private var hasListeners = false

  override func supportedEvents() -> [String]! {
    return ["onForegroundNotification", "onNotificationOpened"]
  }

  override class func requiresMainQueueSetup() -> Bool {
    return true
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  @objc(initialize:withResolver:withRejecter:)
  func initializeSDK(config: [String: Any], resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    guard let apiKey = config["apiKey"] as? String, !apiKey.isEmpty else {
      rejecter("INVALID_API_KEY", "API key is required and cannot be empty", nil)
      return
    }

    let handlePermission = config["handlePermission"] as? Bool ?? true
    let showForegroundNotification = config["showForegroundNotification"] as? Bool ?? true
    let entrigConfig = EntrigConfig(apiKey: apiKey, handlePermission: handlePermission, showForegroundNotification: showForegroundNotification)

    // Set up SDK listeners
    Entrig.setOnForegroundNotificationListener(self)
    Entrig.setOnNotificationOpenedListener(self)

    Entrig.configure(config: entrigConfig) { success, error in
      if success {
        resolver(nil)
      } else {
        rejecter("INIT_ERROR", error ?? "Failed to initialize SDK", nil)
      }
    }
  }

  @objc(register:withIsDebug:withResolver:withRejecter:)
  func register(userId: String, isDebugOverride: NSNumber?, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    let isDebug: Bool
    if let override = isDebugOverride {
      isDebug = override.boolValue
    } else {
      #if DEBUG
      isDebug = true
      #else
      isDebug = false
      #endif
    }

    Entrig.register(userId: userId, sdk: "react-native", isDebug: isDebug) { success, error in
      if success {
        resolver(nil)
      } else {
        rejecter("REGISTER_ERROR", error ?? "Registration failed", nil)
      }
    }
  }

  @objc(requestPermission:withRejecter:)
  func requestPermission(resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    Entrig.requestPermission { granted, error in
      if let error = error {
        rejecter("PERMISSION_ERROR", error.localizedDescription, nil)
      } else {
        resolver(granted)
      }
    }
  }

  @objc(unregister:withRejecter:)
  func unregister(resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    Entrig.unregister { success, error in
      if success {
        resolver(nil)
      } else {
        rejecter("UNREGISTER_ERROR", error ?? "Unregistration failed", nil)
      }
    }
  }

  @objc(getInitialNotification:withRejecter:)
  func getInitialNotification(resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    if let event = Entrig.getInitialNotification() {
      let payload: [String: Any] = [
        "title": event.title ?? "",
        "body": event.body ?? "",
        "data": event.data ?? [:],
        "isForeground": false
      ]
      resolver(payload)
    } else {
      resolver(nil)
    }
  }

  // Helper method to send notification events to JavaScript
  private func sendNotificationToJS(event: NotificationEvent, isForeground: Bool) {
    guard hasListeners else { return }

    let payload: [String: Any] = [
      "title": event.title ?? "",
      "body": event.body ?? "",
      "data": event.data ?? [:],
      "isForeground": isForeground
    ]

    if isForeground {
      sendEvent(withName: "onForegroundNotification", body: payload)
    } else {
      sendEvent(withName: "onNotificationOpened", body: payload)
    }
  }
}

// MARK: - SDK Listeners
extension EntrigModule: OnNotificationReceivedListener {
  func onNotificationReceived(_ event: NotificationEvent) {
    sendNotificationToJS(event: event, isForeground: true)
  }
}

extension EntrigModule: OnNotificationClickListener {
  func onNotificationClick(_ event: NotificationEvent) {
    sendNotificationToJS(event: event, isForeground: false)
  }
}
