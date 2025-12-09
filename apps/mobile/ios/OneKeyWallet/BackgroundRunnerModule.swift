import Foundation
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@objc(BackgroundRunnerModule)
class BackgroundRunnerModule: RCTEventEmitter {
  static let shared = BackgroundRunnerModule()
  var reactNativeFactory: RCTReactNativeFactory?
  var reactNativeFactoryDelegate: RCTReactNativeFactoryDelegate?

  private static var isStarted = false
  private var hasListeners = false

  override init() {
    super.init()
  }

  @objc
  static func sharedInstance() -> BackgroundRunnerModule {
    return BackgroundRunnerModule.shared
  }

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  override func supportedEvents() -> [String]! {
    return ["toUI", "toBackground"]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  @objc
  func startBackgroundRunner() {
    if BackgroundRunnerModule.isStarted {
      return
    }
    BackgroundRunnerModule.isStarted = true
    reactNativeFactoryDelegate = BackgroundReactNativeDelegate()
    reactNativeFactoryDelegate!.dependencyProvider = RCTAppDependencyProvider()
    reactNativeFactory = RCTReactNativeFactory(delegate: reactNativeFactoryDelegate!)
    reactNativeFactory!.rootViewFactory.view(withModuleName: BackgroundReactNativeDelegate.BACKGROUND_BUNDLE_NAME, initialProperties: [:])
  }

  @objc(sendToUI:)
  func sendToUI(_ msg: [String: Any]) {
    print("[BackgroundRunnerModule] Received message: \(msg)")
    if hasListeners {
      sendEvent(withName: "toUI", body: msg)
    }
  }

  @objc(sendToBackground:)
  func sendToBackground(_ msg: [String: Any]) {
    print("[BackgroundRunnerModule] Received message: \(msg)")
    if hasListeners {
      sendEvent(withName: "toBackground", body: msg)
    }
  }
}

class BackgroundReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  static let BACKGROUND_BUNDLE_DEBUG_URL = "http://localhost:8082/apps/mobile/background.bundle?platform=ios&dev=true&lazy=false&minify=false&inlineSourceMap=false&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server&app=so.onekey.wallet&transform.routerRoot=app&transform.engine=hermes&transform.bytecode=1&unstable_transformProfile=hermes-stable"
  static let BACKGROUND_BUNDLE_NAME = "background"
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    bundleURL()
  }


  override func bundleURL() -> URL? {
    #if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: BackgroundReactNativeDelegate.BACKGROUND_BUNDLE_NAME)
    #else
      return Bundle.main.url(forResource: BackgroundReactNativeDelegate.BACKGROUND_BUNDLE_NAME, withExtension: "jsbundle")
    #endif
  }
  
  override func createJSRuntimeFactory() -> JSRuntimeFactoryRef {
    return super.createJSRuntimeFactory()
    //return jsrt_create_jsc_factory() // Use JavaScriptCore runtime
  }
}
