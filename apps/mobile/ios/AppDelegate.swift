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

  static func currentBundleBackgroundJSBundle() -> String? {
    guard let cls = NSClassFromString("ReactNativeBundleUpdate.BundleUpdateStore") as? NSObject.Type else { return nil }
    let selector = NSSelectorFromString("currentBundleBackgroundJSBundle")
    guard cls.responds(to: selector) else { return nil }
    return cls.perform(selector)?.takeUnretainedValue() as? String
  }

  static func currentBundleCommonJSBundle() -> String? {
    guard let cls = NSClassFromString("ReactNativeBundleUpdate.BundleUpdateStore") as? NSObject.Type else { return nil }
    let selector = NSSelectorFromString("currentBundleCommonJSBundle")
    guard cls.responds(to: selector) else { return nil }
    return cls.perform(selector)?.takeUnretainedValue() as? String
  }
}

private enum BackgroundThreadBridge {
  private static let managerClassNames = [
    "BackgroundThread.BackgroundThreadManager",
    "BackgroundThreadManager"
  ]

  private static func managerClass() -> NSObject.Type? {
    managerClassNames.compactMap {
      NSClassFromString($0) as? NSObject.Type
    }.first
  }

  private static func sharedManager() -> NSObject? {
    guard let cls = managerClass() else { return nil }
    return cls.perform(NSSelectorFromString("sharedInstance"))?.takeUnretainedValue() as? NSObject
  }

  static func installSharedBridgeInMainRuntime(_ host: AnyObject) {
    guard let cls = managerClass() else {
      NitroModuleBridge.logInfo("BackgroundThread", "BackgroundThreadManager unavailable, skip installSharedBridgeInMainRuntime")
      return
    }

    cls.perform(NSSelectorFromString("installSharedBridgeInMainRuntime:"), with: host)
  }

  static func startBackgroundRunner(entryURL: String) {
    guard let manager = sharedManager() else {
      NitroModuleBridge.logInfo("BackgroundThread", "BackgroundThreadManager unavailable, skip startBackgroundRunnerWithEntryURL")
      return
    }

    manager.perform(NSSelectorFromString("startBackgroundRunnerWithEntryURL:"), with: entryURL)
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
    // === Recovery Check ===
    let defaults = UserDefaults.standard

    // Version-aware counter reset
    let currentVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
    let storedVersion = defaults.string(forKey: BootRecoveryKeys.bootFailAppVersion) ?? ""
    if !storedVersion.isEmpty && storedVersion != currentVersion {
      defaults.set(0, forKey: BootRecoveryKeys.consecutiveBootFailCount)
    }
    defaults.set(currentVersion, forKey: BootRecoveryKeys.bootFailAppVersion)

    // Increment boot fail count; counter is reset in applicationDidEnterBackground
    // on graceful exit, so only consecutive crashes accumulate
    let oldCount = defaults.integer(forKey: BootRecoveryKeys.consecutiveBootFailCount)
    let newCount = oldCount + 1
    defaults.set(newCount, forKey: BootRecoveryKeys.consecutiveBootFailCount)
    defaults.synchronize()

    NitroModuleBridge.logInfo("BootRecovery", "boot_fail_count: \(oldCount) -> \(newCount), shouldShowRecovery: \(newCount >= 3)")

    // Harness tests set this flag via globalSetup so the recovery page
    // never blocks React Native from starting during test runs.
    let isHarnessMode = defaults.bool(forKey: "onekey_harness_mode")

    if !isHarnessMode && newCount >= 3 {
      // Skip super.application() and React Native initialization entirely.
      // Create our own window — this replaces the system launch storyboard.
      // Do NOT call super here: ExpoAppDelegate.super would start the RN engine
      // and show the Expo splash screen overlay, which would cover recovery UI.
      window = UIWindow(frame: UIScreen.main.bounds)
      window?.rootViewController = RecoveryViewController()
      window?.makeKeyAndVisible()
      return true
    }

    let store = NitroModuleBridge.launchOptionsStore()
    store?.setValue(NSNumber(value: Date().timeIntervalSince1970), forKey: "startupTime")
    NitroModuleBridge.logInfo("App", "OneKey started")
    let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
    let buildNumber = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? ""
    let builtinBundleVersion = Bundle.main.infoDictionary?["BUNDLE_VERSION"] as? String ?? ""
    NitroModuleBridge.logInfo("App", "nativeAppVersion: \(appVersion), buildNumber: \(buildNumber), builtinBundleVersion: \(builtinBundleVersion)")

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

  // Reset crash counter on graceful exit so normal close is not mistaken for a crash.
  // Skip reset when in recovery mode (count >= 3) so recovery is still offered
  // if the user force-kills from the app switcher while viewing the recovery screen.
  public override func applicationDidEnterBackground(_ application: UIApplication) {
    super.applicationDidEnterBackground(application)
    let count = UserDefaults.standard.integer(forKey: BootRecoveryKeys.consecutiveBootFailCount)
    if count < 3 {
      UserDefaults.standard.set(0, forKey: BootRecoveryKeys.consecutiveBootFailCount)
      UserDefaults.standard.synchronize()
    }
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

  private func isNativeBackgroundThreadEnabled() -> Bool {
#if DEBUG
    if let envValue = ProcessInfo.processInfo.environment["ENABLE_NATIVE_BACKGROUND_THREAD"]?.lowercased() {
      return ["1", "true", "yes", "on"].contains(envValue)
    }
#endif

    if let enabled = Bundle.main.object(forInfoDictionaryKey: "ENABLE_NATIVE_BACKGROUND_THREAD") as? NSNumber {
      return enabled.boolValue
    }
    if let enabled = Bundle.main.object(forInfoDictionaryKey: "ENABLE_NATIVE_BACKGROUND_THREAD") as? String {
      return ["1", "true", "yes", "on"].contains(enabled.lowercased())
    }

    return false
  }

  private func backgroundDebugBundleURLString() -> String? {
    if let mainMetroURL = RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry"),
       var components = URLComponents(url: mainMetroURL, resolvingAgainstBaseURL: false) {
      components.port = 8082
      components.path = "/background.bundle"
      return components.url?.absoluteString
    }

    let packagerHost = RCTBundleURLProvider.sharedSettings().packagerServerHost()
    if !packagerHost.isEmpty {
      return "http://\(packagerHost):8082/background.bundle?platform=ios&dev=true&lazy=false&minify=false&inlineSourceMap=false&modulesOnly=false&runModule=true"
    }

    return nil
  }

  private func backgroundBundleEntryURL() -> String {
#if DEBUG
    let debugURL = backgroundDebugBundleURLString() ??
      "http://localhost:8082/background.bundle?platform=ios&dev=true&lazy=false&minify=false&inlineSourceMap=false&modulesOnly=false&runModule=true"
    NitroModuleBridge.logInfo("BackgroundThread", "backgroundBundleEntryURL(DEBUG): \(debugURL)")
    return debugURL
#else
    if let bundlePath = NitroModuleBridge.currentBundleBackgroundJSBundle(), !bundlePath.isEmpty {
      let isFileURL = bundlePath.hasPrefix("file://")
      let bundleFilePath = isFileURL ? (URL(string: bundlePath)?.path ?? bundlePath) : bundlePath
      let exists = FileManager.default.fileExists(atPath: bundleFilePath)
      NitroModuleBridge.logInfo("BundleUpdate", "backgroundBundleEntryURL(RELEASE): otaPath=\(bundlePath), exists=\(exists)")

      if exists {
        return bundlePath
      }
    }

    NitroModuleBridge.logInfo("BundleUpdate", "backgroundBundleEntryURL(RELEASE): fallback background.bundle")
    return "background.bundle"
#endif
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    let metroURL = RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
    NitroModuleBridge.logInfo("BundleUpdate", "bundleURL(DEBUG): metroURL=\(metroURL?.absoluteString ?? "nil")")
    return metroURL
#else
    // In split-bundle mode the initial bundle is common.jsbundle (polyfills + shared modules).
    // The entry-specific main.jsbundle is loaded later in handleHostDidStart via SplitBundleLoader.

    // Check for OTA-updated common bundle first
    if let bundlePath = NitroModuleBridge.currentBundleCommonJSBundle(), !bundlePath.isEmpty {
      let isFileURL = bundlePath.hasPrefix("file://")
      let bundleFilePath = isFileURL ? (URL(string: bundlePath)?.path ?? bundlePath) : bundlePath
      let exists = FileManager.default.fileExists(atPath: bundleFilePath)
      NitroModuleBridge.logInfo("BundleUpdate", "bundleURL(RELEASE): OTA common path=\(bundlePath), exists=\(exists)")

      if exists {
        if isFileURL, let fileURL = URL(string: bundlePath) {
          NitroModuleBridge.logInfo("BundleUpdate", "bundleURL(RELEASE): using OTA common file URL=\(fileURL.absoluteString)")
          return fileURL
        }
        let fileURL = URL(fileURLWithPath: bundlePath)
        NitroModuleBridge.logInfo("BundleUpdate", "bundleURL(RELEASE): using OTA common file path=\(fileURL.absoluteString)")
        return fileURL
      }

      NitroModuleBridge.logInfo("BundleUpdate", "bundleURL(RELEASE): OTA common path not found, will fallback")
    }

    // Fallback: check for OTA main bundle path (legacy single-bundle OTA)
    if let bundlePath = NitroModuleBridge.currentBundleMainJSBundle(), !bundlePath.isEmpty {
      let isFileURL = bundlePath.hasPrefix("file://")
      let bundleFilePath = isFileURL ? (URL(string: bundlePath)?.path ?? bundlePath) : bundlePath
      let exists = FileManager.default.fileExists(atPath: bundleFilePath)
      NitroModuleBridge.logInfo("BundleUpdate", "bundleURL(RELEASE): OTA main path=\(bundlePath), exists=\(exists)")

      if exists {
        if isFileURL, let fileURL = URL(string: bundlePath) {
          NitroModuleBridge.logInfo("BundleUpdate", "bundleURL(RELEASE): using OTA main file URL=\(fileURL.absoluteString)")
          return fileURL
        }
        let fileURL = URL(fileURLWithPath: bundlePath)
        NitroModuleBridge.logInfo("BundleUpdate", "bundleURL(RELEASE): using OTA main file path=\(fileURL.absoluteString)")
        return fileURL
      }

      NitroModuleBridge.logInfo("BundleUpdate", "bundleURL(RELEASE): OTA main path not found, will fallback")
    }

    // Three-bundle mode: initial bundle is common.jsbundle (polyfills + shared modules).
    // Single-bundle mode: fall back to main.jsbundle (standard react-native bundle output).
    let candidates: [(String, String)] = [("common", "jsbundle"), ("main", "jsbundle")]
    for (name, ext) in candidates {
      if let url = Bundle.main.url(forResource: name, withExtension: ext) {
        let fileSize = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? Int) ?? 0
        NitroModuleBridge.logInfo("BundleUpdate", "bundleURL(RELEASE): fallback \(name).\(ext)=\(url.absoluteString)")
        NitroModuleBridge.logInfo("SplitBundle", "bundleURL: \(url.lastPathComponent) (\(fileSize / 1024)KB)")
        return url
      }
    }

    NitroModuleBridge.logInfo("BundleUpdate", "bundleURL(RELEASE): no bundle found (common.jsbundle / main.jsbundle)")
    return nil
#endif
  }

  /// Resolves the filesystem path for the main entry bundle (main.jsbundle).
  /// Returns nil in DEBUG (single bundle from Metro) or if the file cannot be found.
  private func resolveMainEntryBundlePath() -> String? {
#if DEBUG
    return nil
#else
    // Check OTA path first
    if let bundlePath = NitroModuleBridge.currentBundleMainJSBundle(), !bundlePath.isEmpty {
      let isFileURL = bundlePath.hasPrefix("file://")
      let bundleFilePath = isFileURL ? (URL(string: bundlePath)?.path ?? bundlePath) : bundlePath
      if FileManager.default.fileExists(atPath: bundleFilePath) {
        NitroModuleBridge.logInfo("BundleUpdate", "resolveMainEntryBundlePath: OTA path=\(bundleFilePath)")
        return bundleFilePath
      }
    }

    // Fallback to built-in main.jsbundle
    if let url = Bundle.main.url(forResource: "main", withExtension: "jsbundle") {
      NitroModuleBridge.logInfo("BundleUpdate", "resolveMainEntryBundlePath: builtin=\(url.path)")
      return url.path
    }

    NitroModuleBridge.logInfo("BundleUpdate", "resolveMainEntryBundlePath: not found")
    return nil
#endif
  }

  @objc(hostDidStart:)
  func handleHostDidStart(_ host: AnyObject) {
#if !DEBUG
    // In release mode, the initial bundle is common.jsbundle (shared modules only).
    // Load the main entry bundle now so the app's entry point is executed.
    let entryLoadStart = CFAbsoluteTimeGetCurrent()
    if let entryPath = resolveMainEntryBundlePath() {
      NitroModuleBridge.logInfo("SplitBundle", "hostDidStart: loading main entry bundle at \(entryPath)")
      SplitBundleLoader.loadEntryBundle(entryPath, inHost: host)
      let elapsed = (CFAbsoluteTimeGetCurrent() - entryLoadStart) * 1000
      NitroModuleBridge.logInfo("SplitBundle", "hostDidStart: main entry loaded in \(String(format: "%.1f", elapsed))ms")
    } else {
      NitroModuleBridge.logInfo("SplitBundle", "hostDidStart: no main entry bundle found")
    }
#endif

    guard isNativeBackgroundThreadEnabled() else {
      NitroModuleBridge.logInfo("BackgroundThread", "hostDidStart: background thread disabled by ENABLE_NATIVE_BACKGROUND_THREAD")
      return
    }

    BackgroundThreadBridge.installSharedBridgeInMainRuntime(host)

#if DEBUG
    // Dev: pass the Metro URL directly (single bundle served by the dev server).
    let entryURL = backgroundBundleEntryURL()
    NitroModuleBridge.logInfo("BackgroundThread", "hostDidStart: start background runner (debug) entryURL=\(entryURL)")
    BackgroundThreadBridge.startBackgroundRunner(entryURL: entryURL)
#else
    // Release split-bundle: pass empty string so BackgroundRunnerReactNativeDelegate
    // uses the default two-step strategy (common.jsbundle first, then background.bundle).
    // Passing any non-empty path would bypass common.jsbundle loading.
    NitroModuleBridge.logInfo("BackgroundThread", "hostDidStart: start background runner (release split-bundle)")
    BackgroundThreadBridge.startBackgroundRunner(entryURL: "")
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
