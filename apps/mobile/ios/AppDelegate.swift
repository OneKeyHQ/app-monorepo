#if DEBUG
internal import CryptoKit
#endif
internal import Expo
import MMKV
import React
import ReactAppDependencyProvider
// NOTE: Cannot directly import Nitro modules (ReactNativeDeviceUtils, ReactNativeBundleUpdate,
// NativeLogger) because their umbrella headers contain C++ (.hpp) files that cause Clang
// dependency scanner failures. Using NSClassFromString + KVC as a workaround.

// MARK: - Dynamic bridge to Nitro modules (avoids C++ module import issues)
private enum NitroModuleBridge {
  // LaunchOptionsStore is @objcMembers in ReactNativeDeviceUtils.
  // Reach the singleton via the `sharedInstance` class method (perform),
  // NOT KVC `value(forKeyPath: "shared")`: a Swift `static let` stored
  // property is invisible to the ObjC runtime, so KVC returns nil and
  // every subsequent `setValue(_:forKey:)` (startupTime, deviceToken,
  // launchOptions) silently no-ops.
  static func launchOptionsStore() -> NSObject? {
    guard let cls = NSClassFromString("ReactNativeDeviceUtils.LaunchOptionsStore") as? NSObject.Type else { return nil }
    return cls.perform(NSSelectorFromString("sharedInstance"))?.takeUnretainedValue() as? NSObject
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

  static func installSharedBridgeInMainRuntime(
    _ host: AnyObject,
    thenStartBackgroundRunnerWithEntryURL entryURL: String
  ) {
    guard let cls = managerClass() else {
      NitroModuleBridge.logInfo("BackgroundThread", "BackgroundThreadManager unavailable, skip ordered main/background runtime startup")
      return
    }

    let selector = NSSelectorFromString(
      "installSharedBridgeInMainRuntime:thenStartBackgroundRunnerWithEntryURL:"
    )
    guard cls.responds(to: selector) else {
      NitroModuleBridge.logInfo("BackgroundThread", "ordered startup selector unavailable, skip")
      return
    }

    cls.perform(selector, with: host, with: entryURL)
  }

#if DEBUG
  static func installSharedBridgeInMainRuntime(
    _ host: AnyObject,
    thenStartBackgroundRunnerWithDevVendorConfig config: [String: String]
  ) {
    guard let cls = managerClass() else {
      NitroModuleBridge.logInfo("BackgroundThread", "BackgroundThreadManager unavailable, skip dev-vendor startup")
      return
    }

    let selector = NSSelectorFromString(
      "installSharedBridgeInMainRuntime:thenStartBackgroundRunnerWithDevVendorConfig:"
    )
    guard cls.responds(to: selector) else {
      NitroModuleBridge.logInfo("BackgroundThread", "dev-vendor startup selector unavailable, skip")
      return
    }

    cls.perform(selector, with: host, with: config as NSDictionary)
  }
#endif
}

/// Single flag controlling HBC + segment profile on native side. Read from
/// either the env var (Xcode scheme → Arguments → Environment Variables) or
/// Info.plist. See `.skillshare/skills/1k-startup-profile/SKILL.md`.
private func isStartupProfileEnabled() -> Bool {
  if let env = ProcessInfo.processInfo.environment["ONEKEY_STARTUP_PROFILE"]?.lowercased() {
    if ["1", "true", "yes", "on"].contains(env) { return true }
  }
  if let plist = Bundle.main.object(forInfoDictionaryKey: "ONEKEY_STARTUP_PROFILE") as? NSNumber {
    return plist.boolValue
  }
  if let plist = Bundle.main.object(forInfoDictionaryKey: "ONEKEY_STARTUP_PROFILE") as? String {
    return ["1", "true", "yes", "on"].contains(plist.lowercased())
  }
  return false
}

/// Tracks which bundle `bundleURL()` returned as RN's initial bundle, so
/// `handleHostDidStart` can decide whether the main entry bundle still needs
/// to be loaded. In single-bundle Release builds (no `common.bundle`) the
/// initial bundle is already `main.jsbundle` and loading it again would
/// double-evaluate module side effects.
private enum InitialBundleKind {
  case none
  case common
#if DEBUG
  case devVendorCommon
#endif
  case main
}

#if DEBUG
/// Debug-only common HBC configuration shared by the iOS Simulator DevSession
/// shell and Xcode builds that embed the artifacts directly (see
/// `resolveDevVendorBundleInfo`). DevSession identifiers stay inside the
/// dev-shell gate so non-shell builds never carry them.
private struct DevVendorBundleInfo {
  let commonBundleURL: URL
  let fingerprint: String
  let metroBaseURL: URL
#if ONEKEY_DEV_SHELL && targetEnvironment(simulator)
  let sessionId: String
#endif
}
#endif

@UIApplicationMain
class AppDelegate: ExpoAppDelegate {
  /// The real app-launch anchor. Captured eagerly inside `init()`, which is
  /// invoked by `UIApplicationMain` just after dyld + `UIApplication.init`
  /// finish and before `application(_:didFinishLaunchingWithOptions:)` fires.
  /// Reading this from anywhere else returns the same fixed timestamp.
  static let appLaunchCFTime: CFAbsoluteTime = CFAbsoluteTimeGetCurrent()

  override init() {
    // Force the static `let` above to evaluate now. Without this read the
    // anchor would stay un-initialized until something else first touched it
    // (which would be deep inside `didFinishLaunching`), and every "+from
    // launch" delta would collapse to ~0ms.
    _ = AppDelegate.appLaunchCFTime
    super.init()
  }

  var window: UIWindow?
  @objc var reactHost: AnyObject?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let didFinishLaunchingStartAt = CFAbsoluteTimeGetCurrent()
    NitroModuleBridge.logInfo(
      "StartupTiming",
      "ios.app.did_finish_launching.start: +\(String(format: "%.0f", (didFinishLaunchingStartAt - AppDelegate.appLaunchCFTime) * 1000))ms from launch"
    )

    // Disable persistent URL cache so auth/keyless responses (access_token,
    // refresh_token, backendShare, pinHash, etc.) are never written to
    // Library/Caches/<bundle>/Cache.db. Keeping a small memory cache for
    // in-session reuse is UX-neutral. Must run before any URLSession.shared
    // request (incl. recovery-mode path below). See SlowMist audit iOS-9.1.
    URLCache.shared.removeAllCachedResponses()
    URLCache.shared = URLCache(memoryCapacity: 4 * 1024 * 1024, diskCapacity: 0, diskPath: nil)

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

    // The migration bridge uses MMKV's Objective-C wrapper, whose
    // initialization state is separate from react-native-mmkv's C++ factory.
    MMKV.initialize(rootDir: nil)

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
    let tBeforeJPush = CFAbsoluteTimeGetCurrent()
    let entity = JPUSHRegisterEntity()
    entity.types = 0
    JPUSHService.setDebugMode()
    JPUSHService.register(forRemoteNotificationConfig: entity, delegate: self)
    let tAfterJPush = CFAbsoluteTimeGetCurrent()
    NitroModuleBridge.logInfo(
      "StartupTiming",
      "ios.app.jpush_register: \(String(format: "%.0f", (tAfterJPush - tBeforeJPush) * 1000))ms"
    )

    let tBeforeSuper = CFAbsoluteTimeGetCurrent()
    let result = super.application(application, didFinishLaunchingWithOptions: launchOptions)
    let tAfterSuper = CFAbsoluteTimeGetCurrent()
    NitroModuleBridge.logInfo(
      "StartupTiming",
      "ios.app.super_did_finish_launching: \(String(format: "%.0f", (tAfterSuper - tBeforeSuper) * 1000))ms (Expo/RN init)"
    )
    NitroModuleBridge.logInfo(
      "StartupTiming",
      "ios.app.did_finish_launching.done: \(String(format: "%.0f", (tAfterSuper - didFinishLaunchingStartAt) * 1000))ms (+\(String(format: "%.0f", (tAfterSuper - AppDelegate.appLaunchCFTime) * 1000))ms from launch)"
    )
    return result
  }

  // Reset crash counter on graceful exit so normal close is not mistaken for a crash.
  // Skip reset when in recovery mode (count >= 3) so recovery is still offered
  // if the user force-kills from the app switcher while viewing the recovery screen.
  override func applicationDidEnterBackground(_ application: UIApplication) {
    super.applicationDidEnterBackground(application)
    let count = UserDefaults.standard.integer(forKey: BootRecoveryKeys.consecutiveBootFailCount)
    if count < 3 {
      UserDefaults.standard.set(0, forKey: BootRecoveryKeys.consecutiveBootFailCount)
      UserDefaults.standard.synchronize()
    }
  }

  // Background URLSession events (concurrent/background downloads).
  // Posted under a generic name (RangeDownloaderBackgroundEvents) so any number
  // of channels route through one notification; the
  // shared range-downloader filters by its own session identifier prefix (and
  // still recognizes the legacy identifier prefix for in-flight downloads that
  // span an app update).
  override func application(
    _ application: UIApplication,
    handleEventsForBackgroundURLSession identifier: String,
    completionHandler: @escaping () -> Void
  ) {
    NitroModuleBridge.logInfo("RangeDownloader", "handleEventsForBackgroundURLSession: \(identifier)")
    NotificationCenter.default.post(
      name: Notification.Name("RangeDownloaderBackgroundEvents"),
      object: nil,
      userInfo: ["identifier": identifier, "completionHandler": completionHandler]
    )
  }

  // Linking API
  override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }

  // Register APNS & Upload DeviceToken
  override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    NitroModuleBridge.logInfo("App", "didRegisterForRemoteNotificationsWithDeviceToken")
    JPUSHService.registerDeviceToken(deviceToken)
    NitroModuleBridge.launchOptionsStore()?.setValue(deviceToken, forKey: "deviceToken")
  }

  // Explicitly define remote notification delegates to ensure compatibility with some third-party libraries
  override func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: any Error) {
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
    NitroModuleBridge.logInfo("App", "didFailToRegisterForRemoteNotificationsWithError error: \(error)")
  }

  // Explicitly define remote notification delegates to ensure compatibility with some third-party libraries
  override func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable : Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    NitroModuleBridge.logInfo("App", "didReceiveRemoteNotification")
    JPUSHService.handleRemoteNotification(userInfo)
    NotificationCenter.default.post(name: NSNotification.Name(J_APNS_NOTIFICATION_ARRIVED_EVENT), object: userInfo)
    completionHandler(.newData)
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  private var initialBundleKind: InitialBundleKind = .none

  private func canonicalDevMetroURL(_ url: URL?) -> URL? {
    return url
  }

#if DEBUG
  private lazy var devVendorBundleInfo = resolveDevVendorBundleInfo()

  private func explicitDevBackgroundHMRValue() -> Bool? {
    if let envValue = ProcessInfo.processInfo.environment["ONEKEY_DEV_BG_HMR"] {
      return ["1", "true", "yes", "on"].contains(
        envValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
      )
    }
    if let enabled = Bundle.main.object(forInfoDictionaryKey: "ONEKEY_DEV_BG_HMR") as? NSNumber {
      return enabled.boolValue
    }
    if let enabled = Bundle.main.object(forInfoDictionaryKey: "ONEKEY_DEV_BG_HMR") as? String {
      return ["1", "true", "yes", "on"].contains(
        enabled.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
      )
    }
    return nil
  }

  private func isDevBackgroundHMREnabled(fingerprint _: String) -> Bool {
    return explicitDevBackgroundHMRValue() ?? false
  }

  private func resolveDevVendorBundleInfo() -> DevVendorBundleInfo? {
#if ONEKEY_DEV_SHELL && targetEnvironment(simulator)
    guard
      let nativeContractKey = Bundle.main.object(
        forInfoDictionaryKey: "ONEKEY_NATIVE_CONTRACT_KEY"
      ) as? String,
      nativeContractKey.range(
        of: "^[0-9a-f]{64}$",
        options: .regularExpression
      ) != nil
    else {
      return nil
    }
    do {
      guard
        let vendorSchemaVersion = bundleInteger(
          forInfoDictionaryKey: "ONEKEY_DEV_VENDOR_SCHEMA_VERSION"
        ),
        let vendorStrategyVersion = bundleInteger(
          forInfoDictionaryKey: "ONEKEY_DEV_VENDOR_STRATEGY_VERSION"
        )
      else {
        fatalError("iOS Simulator dev shell is missing generated vendor contract versions")
      }
      let fileManager = FileManager.default
      let sessionRoot = try fileManager.url(
        for: .applicationSupportDirectory,
        in: .userDomainMask,
        appropriateFor: nil,
        create: true
      ).appendingPathComponent("onekey-dev-sessions", isDirectory: true)
      let current = try readDevSessionJSON(
        from: sessionRoot.appendingPathComponent("current.json"),
        maxBytes: 2 * 1024 * 1024
      )
      guard
        (current["schemaVersion"] as? NSNumber)?.intValue == 1,
        let sessionId = current["sessionId"] as? String,
        let deviceId = current["deviceId"] as? String,
        !deviceId.isEmpty,
        let worktreeId = current["worktreeId"] as? String,
        worktreeId.range(of: "^[0-9a-f]{12}$", options: .regularExpression) != nil,
        sessionId.range(
          of: "^wk-[0-9a-f]{12}-dev-[0-9a-f]{12}-[0-9a-f]{16}$",
          options: .regularExpression
        ) != nil,
        sessionId.hasPrefix("wk-\(worktreeId)-")
      else {
        fatalError("iOS Simulator dev shell current session pointer is invalid")
      }
      let sessionDirectory = sessionRoot
        .appendingPathComponent(sessionId, isDirectory: true)
        .standardizedFileURL
      guard sessionDirectory.path.hasPrefix(sessionRoot.standardizedFileURL.path + "/") else {
        fatalError("iOS Simulator dev shell session path escapes its private root")
      }
      let session = try readDevSessionJSON(
        from: sessionDirectory.appendingPathComponent("session.json"),
        maxBytes: 2 * 1024 * 1024
      )
      guard
        (session["schemaVersion"] as? NSNumber)?.intValue == 2,
        session["platform"] as? String == "ios",
        session["sessionId"] as? String == sessionId,
        session["deviceId"] as? String == deviceId,
        session["worktreeId"] as? String == worktreeId,
        session["nativeContractKey"] as? String == nativeContractKey,
        let expiresAtEpochMs = session["expiresAtEpochMs"] as? NSNumber,
        expiresAtEpochMs.int64Value > Int64(Date().timeIntervalSince1970 * 1000),
        let sessionVendor = session["vendor"] as? [String: Any],
        sessionVendor["nativeContractKey"] as? String == nativeContractKey,
        sessionVendor["manifestFile"] as? String == "vendor-manifest.json",
        sessionVendor["commonHbcFile"] as? String == "common.hbc",
        let metro = session["metro"] as? [String: Any],
        let metroBaseURLValue = metro["baseUrl"] as? String,
        let metroBaseURL = validatedMetroBaseURL(metroBaseURLValue)
      else {
        fatalError("DevSession does not match this iOS Simulator shell")
      }
      let manifest = try readDevSessionJSON(
        from: sessionDirectory.appendingPathComponent("vendor-manifest.json"),
        maxBytes: 2 * 1024 * 1024
      )
      guard
        let contractVendorSchema = sessionVendor["schemaVersion"] as? NSNumber,
        let contractVendorStrategy = sessionVendor["strategyVersion"] as? NSNumber,
        contractVendorSchema.intValue == vendorSchemaVersion,
        contractVendorStrategy.intValue == vendorStrategyVersion,
        (manifest["schemaVersion"] as? NSNumber)?.intValue == contractVendorSchema.intValue,
        (manifest["strategyVersion"] as? NSNumber)?.intValue == contractVendorStrategy.intValue,
        manifest["platform"] as? String == "ios",
        manifest["nativeContractKey"] as? String == nativeContractKey,
        let fingerprint = manifest["fingerprint"] as? String,
        sessionVendor["fingerprint"] as? String == fingerprint,
        fingerprint.range(
          of: "^[0-9a-f]{64}$",
          options: .regularExpression
        ) != nil,
        let common = manifest["common"] as? [String: Any],
        let bytecode = common["bytecode"] as? [String: Any],
        bytecode["file"] as? String == "common.hbc",
        let expectedBytes = bytecode["bytes"] as? NSNumber,
        let expectedSha256 = bytecode["sha256"] as? String,
        sessionVendor["commonHbcSha256"] as? String == expectedSha256,
        expectedSha256.range(
          of: "^[0-9a-f]{64}$",
          options: .regularExpression
        ) != nil,
        expectedBytes.int64Value > 0,
        expectedBytes.int64Value <= 512 * 1024 * 1024
      else {
        fatalError("DevSession vendor manifest is incompatible")
      }
      let commonURL = sessionDirectory.appendingPathComponent("common.hbc")
      let commonAttributes = try fileManager.attributesOfItem(atPath: commonURL.path)
      guard
        let commonSize = commonAttributes[.size] as? NSNumber,
        commonSize.int64Value == expectedBytes.int64Value,
        (try sha256File(commonURL)) == expectedSha256
      else {
        fatalError("DevSession private common.hbc integrity mismatch")
      }
      NitroModuleBridge.logInfo(
        "DevVendor",
        "configured private iOS dev vendor session=\(sessionId) fingerprint=\(fingerprint)"
      )
      return DevVendorBundleInfo(
        commonBundleURL: commonURL,
        fingerprint: fingerprint,
        metroBaseURL: metroBaseURL,
        sessionId: sessionId
      )
    } catch {
      fatalError(
        "Unable to configure iOS Simulator DevSession from app-private storage. " +
        "Run the dev-shell command again for this exact simulator. Error: \(error)"
      )
    }
#else
    // Xcode Debug builds (physical devices and non-shell simulators): the
    // "Bundle React Native code and images" phase embeds the validated
    // out-dir-bundle/dev-vendor common HBC + manifest when
    // ONEKEY_DEV_VENDOR=true. There is no DevSession; Metro is the plain
    // `yarn app:native-bundle` server reached through the packager URL, and the
    // delta requests identify themselves with resolver.devVendorEmbedded=true.
    let commonURL = Bundle.main.url(
      forResource: "onekey-dev-vendor-common",
      withExtension: "hbc"
    )
    let manifestURL = Bundle.main.url(
      forResource: "onekey-dev-vendor-manifest",
      withExtension: "json"
    )
    if commonURL == nil && manifestURL == nil {
      return nil
    }
    guard let commonURL, let manifestURL else {
      fatalError("Dev-vendor common HBC and manifest must be embedded together")
    }
    guard
      let packagerURL = RCTBundleURLProvider.sharedSettings().jsBundleURL(
        forBundleRoot: ".expo/.virtual-metro-entry"
      ),
      var baseComponents = URLComponents(url: packagerURL, resolvingAgainstBaseURL: false)
    else {
      // Without a reachable packager the plain Metro path fails the same way
      // (RN "could not connect" screen) instead of loading two full bundles.
      NitroModuleBridge.logInfo(
        "DevVendor",
        "embedded common HBC found but no Metro packager URL is available; using the plain Metro bundle path"
      )
      return nil
    }
    baseComponents.path = ""
    baseComponents.query = nil
    baseComponents.fragment = nil
    guard
      let metroBaseURLValue = baseComponents.url?.absoluteString,
      let metroBaseURL = validatedMetroBaseURL(metroBaseURLValue)
    else {
      fatalError("Dev-vendor Metro packager URL is invalid: \(packagerURL.absoluteString)")
    }
    do {
      let manifest = try readDevSessionJSON(from: manifestURL, maxBytes: 8 * 1024 * 1024)
      guard
        manifest["platform"] as? String == "ios",
        let fingerprint = manifest["fingerprint"] as? String,
        fingerprint.range(
          of: "^[0-9a-f]{64}$",
          options: .regularExpression
        ) != nil,
        let common = manifest["common"] as? [String: Any],
        let bytecode = common["bytecode"] as? [String: Any],
        bytecode["file"] as? String == "common.hbc",
        let expectedBytes = bytecode["bytes"] as? NSNumber,
        let expectedSha256 = bytecode["sha256"] as? String,
        expectedSha256.range(
          of: "^[0-9a-f]{64}$",
          options: .regularExpression
        ) != nil,
        expectedBytes.int64Value > 0,
        expectedBytes.int64Value <= 512 * 1024 * 1024
      else {
        fatalError("Dev-vendor embedded iOS manifest is invalid")
      }
      let commonAttributes = try FileManager.default.attributesOfItem(atPath: commonURL.path)
      guard
        let commonSize = commonAttributes[.size] as? NSNumber,
        commonSize.int64Value == expectedBytes.int64Value,
        (try sha256File(commonURL)) == expectedSha256
      else {
        fatalError("Dev-vendor embedded common.hbc integrity mismatch")
      }
      NitroModuleBridge.logInfo(
        "DevVendor",
        "configured embedded iOS dev vendor fingerprint=\(fingerprint) metro=\(metroBaseURL.absoluteString)"
      )
      return DevVendorBundleInfo(
        commonBundleURL: commonURL,
        fingerprint: fingerprint,
        metroBaseURL: metroBaseURL
      )
    } catch {
      fatalError("Unable to validate embedded dev-vendor iOS artifacts: \(error)")
    }
#endif
  }

  private func bundleInteger(forInfoDictionaryKey key: String) -> Int? {
    if let value = Bundle.main.object(forInfoDictionaryKey: key) as? NSNumber {
      return value.intValue
    }
    if
      let value = Bundle.main.object(forInfoDictionaryKey: key) as? String,
      let integer = Int(value)
    {
      return integer
    }
    return nil
  }

  private func readDevSessionJSON(from url: URL, maxBytes: Int) throws -> [String: Any] {
    let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
    guard
      let fileSize = attributes[.size] as? NSNumber,
      fileSize.int64Value > 0,
      fileSize.int64Value <= maxBytes
    else {
      throw NSError(
        domain: "OneKeyDevSession",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "DevSession file exceeds size limit"]
      )
    }
    let data = try Data(contentsOf: url, options: .mappedIfSafe)
    guard
      data.count <= maxBytes,
      let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
      throw NSError(
        domain: "OneKeyDevSession",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "DevSession JSON is invalid"]
      )
    }
    return json
  }

  private func validatedMetroBaseURL(_ value: String) -> URL? {
    guard
      var components = URLComponents(string: value),
      let scheme = components.scheme,
      ["http", "https"].contains(scheme),
      let host = components.host,
      !host.isEmpty,
      components.user == nil,
      components.password == nil,
      components.query == nil,
      components.fragment == nil,
      components.path.isEmpty || components.path == "/"
    else {
      return nil
    }
    components.path = ""
    return components.url
  }

  private func sha256File(_ url: URL) throws -> String {
    let handle = try FileHandle(forReadingFrom: url)
    defer { try? handle.close() }
    var hasher = SHA256()
    while true {
      let data = try handle.read(upToCount: 1024 * 1024) ?? Data()
      if data.isEmpty { break }
      hasher.update(data: data)
    }
    return hasher.finalize().map { String(format: "%02x", $0) }.joined()
  }

  private func devVendorEntryBundleURL(
    runtimeTarget: String,
    fingerprint: String
  ) -> URL? {
    let fallbackPath = runtimeTarget == "background"
      ? "background.bundle"
      : ".expo/.virtual-metro-entry.bundle"
    guard
      let devVendorBundleInfo,
      var components = URLComponents(
        url: devVendorBundleInfo.metroBaseURL,
        resolvingAgainstBaseURL: false
      )
    else {
      return nil
    }
    components.path = "/\(fallbackPath)"

    var values = [
      "platform": "ios",
      "dev": "true",
      "lazy": "false",
      "minify": "false",
      "inlineSourceMap": "false",
      "modulesOnly": "true",
      "runModule": "true",
      "resolver.devVendor": "true",
      "resolver.devVendorNative": "true",
      "resolver.devVendorFingerprint": fingerprint,
      "resolver.runtimeTarget": runtimeTarget,
      "unstable_transformProfile": "hermes-stable",
    ]
#if ONEKEY_DEV_SHELL && targetEnvironment(simulator)
    values["resolver.devSessionId"] = devVendorBundleInfo.sessionId
#else
    // Embedded Xcode builds have no DevSession; Metro serves them only when it
    // is not bound to one either (see plugins/devVendor.js).
    values["resolver.devVendorEmbedded"] = "true"
#endif
    if runtimeTarget == "background", isDevBackgroundHMREnabled(fingerprint: fingerprint) {
      values["resolver.devVendorBackgroundHMR"] = "true"
    }
    let overriddenNames = Set(values.keys)
    var queryItems = (components.queryItems ?? []).filter {
      !overriddenNames.contains($0.name)
    }
    queryItems.append(contentsOf: values.keys.sorted().map {
      URLQueryItem(name: $0, value: values[$0])
    })
    components.queryItems = queryItems
    return components.url
  }

  private func devVendorMainHMRBundleURL(from entryURL: URL) -> URL? {
    guard var components = URLComponents(
      url: entryURL,
      resolvingAgainstBaseURL: false
    ) else {
      return nil
    }
    components.path = "/apps/mobile/index.bundle"
    let values = [
      "transform.routerRoot": "app",
      "transform.engine": "hermes",
      "transform.bytecode": "1",
    ]
    let overriddenNames = Set(values.keys)
    var queryItems = (components.queryItems ?? []).filter {
      !overriddenNames.contains($0.name)
    }
    queryItems.append(contentsOf: values.keys.sorted().map {
      URLQueryItem(name: $0, value: values[$0])
    })
    components.queryItems = queryItems
    return components.url
  }
#endif

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
    if let mainMetroURL = canonicalDevMetroURL(
         RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
       ),
       var components = URLComponents(url: mainMetroURL, resolvingAgainstBaseURL: false) {
      components.path = "/background.bundle"
      return components.url?.absoluteString
    }

    let packagerHostPort = RCTBundleURLProvider.sharedSettings().packagerServerHostPort()
    if !packagerHostPort.isEmpty {
      let url = URL(string: "http://\(packagerHostPort)/background.bundle?platform=ios&dev=true&lazy=false&minify=false&inlineSourceMap=false&modulesOnly=false&runModule=true")
      return canonicalDevMetroURL(url)?.absoluteString
    }

    return nil
  }

  private func backgroundBundleEntryURL() -> String {
#if DEBUG
    let fallbackURL = URL(string: "http://localhost:8081/background.bundle?platform=ios&dev=true&lazy=false&minify=false&inlineSourceMap=false&modulesOnly=false&runModule=true")
    let debugURL = backgroundDebugBundleURLString() ??
      canonicalDevMetroURL(fallbackURL)?.absoluteString ?? fallbackURL!.absoluteString
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
    if let devVendorBundleInfo {
      initialBundleKind = .devVendorCommon
      NitroModuleBridge.logInfo(
        "DevVendor",
        "bundleURL(DEBUG): loading local common HBC"
      )
      return devVendorBundleInfo.commonBundleURL
    }
    let metroURL = canonicalDevMetroURL(
      RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
    )
    NitroModuleBridge.logInfo("BundleUpdate", "bundleURL(DEBUG): metroURL=\(metroURL?.absoluteString ?? "nil")")
    return metroURL
#else
    // In split-bundle mode the initial bundle is common.bundle (polyfills + shared modules).
    // The entry-specific main.jsbundle is loaded later in handleHostDidStart via SplitBundleLoader.

    // Check for OTA-updated common bundle first
    if let bundlePath = NitroModuleBridge.currentBundleCommonJSBundle(), !bundlePath.isEmpty {
      let isFileURL = bundlePath.hasPrefix("file://")
      let bundleFilePath = isFileURL ? (URL(string: bundlePath)?.path ?? bundlePath) : bundlePath
      let exists = FileManager.default.fileExists(atPath: bundleFilePath)
      NitroModuleBridge.logInfo("BundleUpdate", "bundleURL(RELEASE): OTA common path=\(bundlePath), exists=\(exists)")

      if exists {
        initialBundleKind = .common
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
        initialBundleKind = .main
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

    // Three-bundle mode: initial bundle is common.bundle (polyfills + shared modules).
    // Single-bundle mode: fall back to main.jsbundle (standard react-native bundle output).
    let candidates: [(String, String)] = [("common", "bundle"), ("main", "jsbundle")]
    for (name, ext) in candidates {
      if let url = Bundle.main.url(forResource: name, withExtension: ext) {
        initialBundleKind = (name == "common") ? .common : .main
        let fileSize = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? Int) ?? 0
        NitroModuleBridge.logInfo("BundleUpdate", "bundleURL(RELEASE): fallback \(name).\(ext)=\(url.absoluteString)")
        NitroModuleBridge.logInfo("SplitBundle", "bundleURL: \(url.lastPathComponent) (\(fileSize / 1024)KB)")
        return url
      }
    }

    initialBundleKind = .none
    NitroModuleBridge.logInfo("BundleUpdate", "bundleURL(RELEASE): no bundle found (common.bundle / main.jsbundle)")
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
    let hostDidStartAt = CFAbsoluteTimeGetCurrent()
    let sinceAppLaunch = (hostDidStartAt - AppDelegate.appLaunchCFTime) * 1000
    NitroModuleBridge.logInfo("StartupTiming", "main_host.did_start: +\(String(format: "%.0f", sinceAppLaunch))ms from launch (ios, common bundle loaded)")

    (UIApplication.shared.delegate as? AppDelegate)?.reactHost = host

#if DEBUG
    if initialBundleKind == .devVendorCommon {
      guard
        let devVendorBundleInfo,
        let mainEntryURL = devVendorEntryBundleURL(
          runtimeTarget: "main",
          fingerprint: devVendorBundleInfo.fingerprint
        ),
        let mainHMRURL = devVendorMainHMRBundleURL(from: mainEntryURL)
      else {
        fatalError("Unable to construct the dev-vendor main entry or HMR URL")
      }

      if isNativeBackgroundThreadEnabled() {
        guard
          let backgroundEntryURL = devVendorEntryBundleURL(
            runtimeTarget: "background",
            fingerprint: devVendorBundleInfo.fingerprint
          )
        else {
          fatalError("Unable to construct the dev-vendor background entry URL")
        }
        NitroModuleBridge.logInfo(
          "BackgroundThread",
          "hostDidStart: start background runner (dev-vendor) entryURL=\(backgroundEntryURL.absoluteString)"
        )
        // Queue SharedBridge first. Its runtime executor starts the background
        // host after common.hbc is ready, before the main delta waits on Metro.
        BackgroundThreadBridge.installSharedBridgeInMainRuntime(
          host,
          thenStartBackgroundRunnerWithDevVendorConfig: [
            "commonBundlePath": devVendorBundleInfo.commonBundleURL.path,
            "entryURL": backgroundEntryURL.absoluteString,
            "fingerprint": devVendorBundleInfo.fingerprint,
            "backgroundHMREnabled": isDevBackgroundHMREnabled(
              fingerprint: devVendorBundleInfo.fingerprint
            ) ? "true" : "false",
          ]
        )
      } else {
        NitroModuleBridge.logInfo(
          "BackgroundThread",
          "hostDidStart: background thread disabled by ENABLE_NATIVE_BACKGROUND_THREAD"
        )
      }

      SplitBundleLoader.loadDevVendorEntryBundle(
        mainEntryURL,
        hmrBundleURL: mainHMRURL,
        fingerprint: devVendorBundleInfo.fingerprint,
        inHost: host
      )
      return
    }
#endif

#if !DEBUG
    // Skip entry bundle loading when RN's initial bundle is already main.jsbundle
    // (single-bundle Release: no common.bundle shipped, or legacy OTA pushed a
    // monolithic main.jsbundle). Re-evaluating the same file would double-run module
    // side effects (timers, subscriptions, global init). Only proceed when the
    // initial bundle was common.bundle, which is the split-bundle mode contract.
    if initialBundleKind != .common {
      NitroModuleBridge.logInfo("SplitBundle", "hostDidStart: initial bundle kind=\(initialBundleKind), skip main entry load to avoid double-evaluation")
    } else {
    // Defer entry bundle loading to the next run-loop tick.
    //
    // Why: hostDidStart: fires synchronously on the main thread while Expo modules
    // are still being registered (EXNativeModulesProxy registerExpoModulesInBridge:).
    // If we evaluate main.jsbundle immediately, the JS thread may call a legacy
    // TurboModule's getConstants() which dispatch_sync's back to the main thread —
    // but the main thread is blocked on Expo registration → deadlock → SIGABRT.
    //
    // By deferring to DispatchQueue.main.async, the main thread finishes Expo
    // registration first, so any dispatch_sync from JS → main succeeds.
    DispatchQueue.main.async { [weak host] in
      guard let host = host else { return }
      let deferredAt = CFAbsoluteTimeGetCurrent()
      let deferDelay = (deferredAt - hostDidStartAt) * 1000
      NitroModuleBridge.logInfo("StartupTiming", "ios.main_entry.deferred: +\(String(format: "%.0f", (deferredAt - AppDelegate.appLaunchCFTime) * 1000))ms from launch (defer delay: \(String(format: "%.1f", deferDelay))ms)")

      let entryLoadStart = CFAbsoluteTimeGetCurrent()
      if let entryPath = self.resolveMainEntryBundlePath() {
        NitroModuleBridge.logInfo("SplitBundle", "hostDidStart: loading main entry bundle at \(entryPath)")

        // --- ONEKEY_STARTUP_PROFILE: HBC I/O signal ---
        // Pre-read the file so we can attribute pure I/O time separately from
        // SplitBundleLoader's combined read+parse+exec below. Warms the page
        // cache; SplitBundleLoader's subsequent read hits cache and its
        // measured time is effectively parse+exec only.
        var hbcIoMs: Double = -1
        var hbcSize: Int = -1
        if isStartupProfileEnabled() {
          let ioStart = CFAbsoluteTimeGetCurrent()
          if let data = try? Data(contentsOf: URL(fileURLWithPath: entryPath), options: .mappedIfSafe) {
            hbcIoMs = (CFAbsoluteTimeGetCurrent() - ioStart) * 1000
            hbcSize = data.count
          }
        }

        SplitBundleLoader.loadEntryBundle(entryPath, inHost: host)
        let elapsed = (CFAbsoluteTimeGetCurrent() - entryLoadStart) * 1000
        let totalFromLaunch = (CFAbsoluteTimeGetCurrent() - AppDelegate.appLaunchCFTime) * 1000
        NitroModuleBridge.logInfo("StartupTiming", "ios.main_entry.evaluated: \(String(format: "%.0f", elapsed))ms (+\(String(format: "%.0f", totalFromLaunch))ms from launch)")
        if isStartupProfileEnabled() && hbcSize > 0 {
          NitroModuleBridge.logInfo(
            "StartupProfile.hbc",
            "main.hbc: io=\(String(format: "%.1f", hbcIoMs))ms size=\(hbcSize)B (parse+exec ~= \(String(format: "%.0f", elapsed - hbcIoMs))ms)"
          )
        }
      } else {
        NitroModuleBridge.logInfo("SplitBundle", "hostDidStart: no main entry bundle found")
      }
    }
    }
#endif

    guard isNativeBackgroundThreadEnabled() else {
      NitroModuleBridge.logInfo("BackgroundThread", "hostDidStart: background thread disabled by ENABLE_NATIVE_BACKGROUND_THREAD")
      return
    }

#if DEBUG
    let bgStartAtDebug = CFAbsoluteTimeGetCurrent()
    NitroModuleBridge.logInfo("StartupTiming", "bg_runner.start: +\(String(format: "%.0f", (bgStartAtDebug - AppDelegate.appLaunchCFTime) * 1000))ms from launch (ios, debug)")
    // Standard development mode keeps the existing single-bundle path. The
    // dev-vendor path returned above after ordering background before main.
    let entryURL = backgroundBundleEntryURL()
    NitroModuleBridge.logInfo("BackgroundThread", "hostDidStart: start background runner (debug) entryURL=\(entryURL)")
    BackgroundThreadBridge.installSharedBridgeInMainRuntime(
      host,
      thenStartBackgroundRunnerWithEntryURL: entryURL
    )
#else
    // Release split-bundle: pass empty string so BackgroundRunnerReactNativeDelegate
    // uses the default two-step strategy (common.bundle first, then background.bundle).
    // Passing any non-empty path would bypass common.bundle loading.
    let bgStartAt = CFAbsoluteTimeGetCurrent()
    NitroModuleBridge.logInfo("StartupTiming", "bg_runner.start: +\(String(format: "%.0f", (bgStartAt - AppDelegate.appLaunchCFTime) * 1000))ms from launch (ios)")
    BackgroundThreadBridge.installSharedBridgeInMainRuntime(
      host,
      thenStartBackgroundRunnerWithEntryURL: ""
    )
#endif
  }
}

extension AppDelegate:JPUSHRegisterDelegate {
  //MARK - JPUSHRegisterDelegate
  @available(iOS 10.0, *)
  func jpushNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
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
  func jpushNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: (() -> Void)) {

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

  func jpushNotificationCenter(_ center: UNUserNotificationCenter, openSettingsFor notification: UNNotification) {

  }

  func jpushNotificationAuthorization(_ status: JPAuthorizationStatus, withInfo info: [AnyHashable : Any]?) {
    NitroModuleBridge.logInfo("App", "receive notification authorization status: \(status), info: \(String(describing: info))")
  }


  // //MARK - 自定义消息
  func networkDidReceiveMessage(_ notification: NSNotification) {
    let userInfo = notification.userInfo!
    NotificationCenter.default.post(name: NSNotification.Name(J_CUSTOM_NOTIFICATION_EVENT), object: userInfo)
  }
}
