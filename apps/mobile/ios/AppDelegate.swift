import Expo
import React
import ReactAppDependencyProvider
// NOTE: Cannot directly import Nitro modules (ReactNativeDeviceUtils, ReactNativeBundleUpdate,
// NativeLogger) because their umbrella headers contain C++ (.hpp) files that cause Clang
// dependency scanner failures. Using NSClassFromString + KVC as a workaround.

// MARK: - Dynamic bridge to Nitro modules (avoids C++ module import issues)
private enum NitroModuleBridge {
  // LaunchOptionsStore is @objcMembers in ReactNativeDeviceUtils
  static func launchOptionsStore() -> NSObject? {
    guard let cls = NSClassFromString("ReactNativeDeviceUtils.LaunchOptionsStore") as? NSObject.Type else { return nil }
    return cls.value(forKeyPath: "shared") as? NSObject
  }

  // OneKeyLog is @objc in ReactNativeNativeLogger
  static func logInfo(_ tag: String, _ message: String) {
    guard let cls = NSClassFromString("ReactNativeNativeLogger.OneKeyLog") as? NSObject.Type else { return }
    cls.perform(NSSelectorFromString("info::"), with: tag, with: message)
  }

  // BundleUpdateStore is @objcMembers in ReactNativeBundleUpdate
  static func currentBundleMainJSBundle() -> String? {
    guard let cls = NSClassFromString("ReactNativeBundleUpdate.BundleUpdateStore") as? NSObject.Type else { return nil }
    return cls.perform(NSSelectorFromString("currentBundleMainJSBundle"))?.takeUnretainedValue() as? String
  }
}

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let store = NitroModuleBridge.launchOptionsStore()
    store?.setValue(NSNumber(value: Date().timeIntervalSince1970), forKey: "startupTime")
    NitroModuleBridge.logInfo("App", "OneKey started")

    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)
    RCTI18nUtil.sharedInstance().allowRTL(true)
#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    store?.setValue(launchOptions, forKey: "launchOptions")

    // JPUSHService Register
    let entity = JPUSHRegisterEntity()
    entity.types = 0
    JPUSHService.setDebugMode()
    JPUSHService.register(forRemoteNotificationConfig: entity, delegate: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }

  // Register APNS & Upload DeviceToken
  public override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    NitroModuleBridge.logInfo("App", "didRegisterForRemoteNotificationsWithDeviceToken")
    JPUSHService.registerDeviceToken(deviceToken)
    NitroModuleBridge.launchOptionsStore()?.setValue(deviceToken, forKey: "deviceToken")
  }

  // Explicitly define remote notification delegates to ensure compatibility with some third-party libraries
  public override func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: any Error) {
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
    NitroModuleBridge.logInfo("App", "didFailToRegisterForRemoteNotificationsWithError error: \(error)")
  }

  // Explicitly define remote notification delegates to ensure compatibility with some third-party libraries
  public override func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable : Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    NitroModuleBridge.logInfo("App", "didReceiveRemoteNotification")
    JPUSHService.handleRemoteNotification(userInfo)
    NotificationCenter.default.post(name: NSNotification.Name(J_APNS_NOTIFICATION_ARRIVED_EVENT), object: userInfo)
    completionHandler(.newData)
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    // Check for updated bundle via dynamic bridge (avoids Nitro module import)
    if let bundlePath = NitroModuleBridge.currentBundleMainJSBundle() {
      return URL(string: bundlePath)
    }
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

extension AppDelegate:JPUSHRegisterDelegate {
  //MARK - JPUSHRegisterDelegate
  @available(iOS 10.0, *)
  public func jpushNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                               withCompletionHandler completionHandler: ((Int) -> Void)) {
    let userInfo = notification.request.content.userInfo

    if (notification.request.trigger?.isKind(of: UNPushNotificationTrigger.self) == true) {
      JPUSHService.handleRemoteNotification(userInfo)
      NotificationCenter.default.post(name: NSNotification.Name(J_APNS_NOTIFICATION_ARRIVED_EVENT), object: userInfo)
      NitroModuleBridge.logInfo("App", "received remote notification: \(userInfo)")
    } else {
      NotificationCenter.default.post(name: NSNotification.Name(J_LOCAL_NOTIFICATION_ARRIVED_EVENT), object: userInfo)
      NitroModuleBridge.logInfo("App", "received local notification: \(userInfo)")
    }

    completionHandler(Int(UNNotificationPresentationOptions.badge.rawValue | UNNotificationPresentationOptions.sound.rawValue | UNNotificationPresentationOptions.alert.rawValue))
  }

  @available(iOS 10.0, *)
  public func jpushNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: (() -> Void)) {

    let userInfo = response.notification.request.content.userInfo
    if (response.notification.request.trigger?.isKind(of: UNPushNotificationTrigger.self) == true) {
      JPUSHService.handleRemoteNotification(userInfo)
      NotificationCenter.default.post(name: NSNotification.Name(J_APNS_NOTIFICATION_OPENED_EVENT), object: userInfo)
      NitroModuleBridge.logInfo("App", "clicked remote notification: \(userInfo)")
    } else {
      NitroModuleBridge.logInfo("App", "clicked local notification: \(userInfo)")
      NotificationCenter.default.post(name: NSNotification.Name(J_LOCAL_NOTIFICATION_OPENED_EVENT), object: userInfo)
    }

    completionHandler()

  }

  public func jpushNotificationCenter(_ center: UNUserNotificationCenter, openSettingsFor notification: UNNotification) {

  }

  public func jpushNotificationAuthorization(_ status: JPAuthorizationStatus, withInfo info: [AnyHashable : Any]?) {
    NitroModuleBridge.logInfo("App", "receive notification authorization status: \(status), info: \(String(describing: info))")
  }


  // //MARK - 自定义消息
  func networkDidReceiveMessage(_ notification: NSNotification) {
    let userInfo = notification.userInfo!
    NotificationCenter.default.post(name: NSNotification.Name(J_CUSTOM_NOTIFICATION_EVENT), object: userInfo)
  }
}
