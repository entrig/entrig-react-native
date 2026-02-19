package com.entrig.reactnative

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.entrig.sdk.Entrig
import com.entrig.sdk.models.EntrigConfig

class EntrigModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  private val context: Context
    get() = reactApplicationContext

  override fun getName(): String = "Entrig"

  override fun initialize() {
    super.initialize()

    // Register for activity events (onNewIntent, onActivityResult)
    reactApplicationContext.addActivityEventListener(this)

    val currentActivity = reactApplicationContext.currentActivity
    // Set activity on SDK for foreground detection
    currentActivity?.let { Entrig.setActivity(it) }

    // Handle initial intent (app launched from notification tap)
    currentActivity?.intent?.let { intent ->
      Entrig.handleIntent(intent)
    }

    Entrig.setOnForegroundNotificationListener { notification ->
      sendEvent("onForegroundNotification", Arguments.makeNativeMap(notification.toMap() as Map<String, Any?>))
    }

    Entrig.setOnNotificationOpenedListener { notification ->
      sendEvent("onNotificationOpened", Arguments.makeNativeMap(notification.toMap() as Map<String, Any?>))
    }
  }

  override fun invalidate() {
    reactApplicationContext.removeActivityEventListener(this)
    super.invalidate()
  }

  // ActivityEventListener — called when a new intent arrives (notification tap while app is open)
  override fun onNewIntent(intent: Intent) {
    Entrig.handleIntent(intent)
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    // Not used
  }

  @ReactMethod
  fun initialize(config: ReadableMap, promise: Promise) {
    val apiKey = config.getString("apiKey")
    if (apiKey.isNullOrEmpty()) {
      promise.reject("INVALID_API_KEY", "API key is required and cannot be empty")
      return
    }

    val showForegroundNotification = if (config.hasKey("showForegroundNotification")) {
      config.getBoolean("showForegroundNotification")
    } else {
      true
    }
    val entrigConfig = EntrigConfig(
      apiKey = apiKey,
      handlePermission = false, // Module handles permission itself
      showForegroundNotification = showForegroundNotification
    )

    val appCtx = context.applicationContext
    Entrig.initialize(appCtx, entrigConfig) { success, error ->
      if (success) {
        promise.resolve(null)
      } else {
        promise.reject("INIT_ERROR", error ?: "Failed to initialize SDK")
      }
    }
  }

  @ReactMethod
  fun register(userId: String, isDebug: Boolean?, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Activity not available")
      return
    }

    if (needsNotificationPermission()) {
      requestNotificationPermission(activity) {
        // Proceed with registration regardless of permission result
        doRegister(userId, activity, promise)
      }
      return
    }

    doRegister(userId, activity, promise)
  }

  @ReactMethod
  fun requestPermission(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Activity not available")
      return
    }

    if (needsNotificationPermission()) {
      requestNotificationPermission(activity) { granted ->
        promise.resolve(granted)
      }
      return
    }

    promise.resolve(true)
  }

  @ReactMethod
  fun unregister(promise: Promise) {
    Entrig.unregister { success, error ->
      if (success) {
        promise.resolve(null)
      } else {
        promise.reject("UNREGISTER_ERROR", error ?: "Unregistration failed")
      }
    }
  }

  @ReactMethod
  fun getInitialNotification(promise: Promise) {
    val initialNotification = Entrig.getInitialNotification()
    if (initialNotification != null) {
      promise.resolve(Arguments.makeNativeMap(initialNotification.toMap() as Map<String, Any?>))
    } else {
      promise.resolve(null)
    }
  }

  private fun needsNotificationPermission(): Boolean {
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS) !=
        PackageManager.PERMISSION_GRANTED
  }

  private fun requestNotificationPermission(activity: Activity, callback: (Boolean) -> Unit) {
    val componentActivity = activity as? ComponentActivity
    if (componentActivity == null) {
      callback(false)
      return
    }

    val key = "entrig_permission_${System.nanoTime()}"
    val registry = componentActivity.activityResultRegistry

    var launcher: androidx.activity.result.ActivityResultLauncher<String>? = null
    launcher = registry.register(key, ActivityResultContracts.RequestPermission()) { granted ->
      launcher?.unregister()
      callback(granted)
    }
    launcher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
  }

  private fun doRegister(userId: String, activity: Activity, promise: Promise) {
    Entrig.register(userId, activity, "react-native") { success, error ->
      if (success) {
        promise.resolve(null)
      } else {
        promise.reject("REGISTER_ERROR", error ?: "Registration failed")
      }
    }
  }

  private fun sendEvent(eventName: String, params: WritableMap?) {
    if (reactApplicationContext.hasActiveReactInstance()) {
      reactApplicationContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(eventName, params)
    }
  }
}
