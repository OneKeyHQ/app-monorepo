import Expo
import React
import ReactAppDependencyProvider

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate, JPUSHRegisterDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    LaunchOptionsManager.sharedInstance().saveStartupTime(NSNumber(value: Date().timeIntervalSince1970))
    let entity = JPUSHRegisterEntity()
    if #available(iOS 12.0, *) {
      entity.types = JPAuthorizationOptionNone // JPAuthorizationOptionAlert|JPAuthorizationOptionBadge|JPAuthorizationOptionSound|JPAuthorizationOptionProvidesAppNotificationSettings
    }
    JPUSHService.registerForRemoteNotificationConfig(entity, delegate: self)
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
    // Save launch options to LaunchOptionsManager
    LaunchOptionsManager.sharedInstance().saveLaunchOptions(launchOptions)
    JPushManager.sharedInstance().registerNotification()
    UIApplication.shared.registerForRemoteNotifications()
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
    LaunchOptionsManager.sharedInstance().log("didRegisterForRemoteNotificationsWithDeviceToken")
    JPUSHService.registerDeviceToken(deviceToken)
    let tokenString = deviceToken.map { String(format: "%02.2hhx", $0)}.joined()
    LaunchOptionsManager.sharedInstance().saveDeviceToken(tokenString)
  }
  
  // Explicitly define remote notification delegates to ensure compatibility with some third-party libraries
  public override func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: any Error) {
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
    LaunchOptionsManager.sharedInstance().log("didFailToRegisterForRemoteNotificationsWithError error: \(error)")
  }
  
  //iOS 7 APNS
  public override func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable : Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    NSLog(@"iOS 7 APNS");
    JPUSHService.handleRemoteNotification(userInfo)
    super.application(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler)
    LaunchOptionsManager.sharedInstance().log("didReceiveRemoteNotification")
    NotificationCenter.default.post(name: NSNotification.Name(J_APNS_NOTIFICATION_ARRIVED_EVENT), object: userInfo)
  }

  //iOS 10 APNS event in foreground
  - (void)jpushNotificationCenter:(UNUserNotificationCenter *)center  willPresentNotification:(UNNotification *)notification withCompletionHandler:(void (^)(NSInteger))completionHandler {
    NSDictionary * userInfo = notification.request.content.userInfo;
    if([notification.request.trigger isKindOfClass:[UNPushNotificationTrigger class]]) {
      // Apns
      LaunchOptionsManager.sharedInstance().log("iOS 10 APNS event in foreground")
      [JPUSHService handleRemoteNotification:userInfo];
      [[NSNotificationCenter defaultCenter] postNotificationName:J_APNS_NOTIFICATION_ARRIVED_EVENT object:userInfo];
    }
    else {
      // local notification
      LaunchOptionsManager.sharedInstance().log("iOS 10 Local Notification event in foreground")
      [[NSNotificationCenter defaultCenter] postNotificationName:J_LOCAL_NOTIFICATION_ARRIVED_EVENT object:userInfo];
    }
    //需要执行这个方法，选择是否提醒用户，有 Badge、Sound、Alert 三种类型可以选择设置
    completionHandler(UNNotificationPresentationOptionAlert);
  }

  //iOS 10 APNS event in background
  public func jpushNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
    let userInfo = response.notification.request.content.userInfo
    if response.notification.request.trigger is UNPushNotificationTrigger {
      // Apns
      LaunchOptionsManager.sharedInstance().log("iOS 10 APNS event in background")
      JPUSHService.handleRemoteNotification(userInfo)
      // 保障应用被杀死状态下，用户点击推送消息，打开app后可以收到点击通知事件
      RCTJPushEventQueue.sharedInstance()._notificationQueue.insert(userInfo, at: 0)
      NotificationCenter.default.post(name: NSNotification.Name(J_APNS_NOTIFICATION_OPENED_EVENT), object: userInfo)
    } else {
      // 本地通知
      LaunchOptionsManager.sharedInstance().log("iOS 10 Local Notification event in background")
      // 保障应用被杀死状态下，用户点击推送消息，打开app后可以收到点击通知事件
      RCTJPushEventQueue.sharedInstance()._localNotificationQueue.insert(userInfo, at: 0)
      NotificationCenter.default.post(name: NSNotification.Name(J_LOCAL_NOTIFICATION_OPENED_EVENT), object: userInfo)
    }
    // 系统要求执行这个方法
    completionHandler()
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
    // Check for updated bundle in Documents directory first
    let bundlePath = BundleUpdateModule.currentBundleMainJSBundle()

    if bundlePath != nil {
      return URL(string: bundlePath!)
    }

    // Fallback to main bundle
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
