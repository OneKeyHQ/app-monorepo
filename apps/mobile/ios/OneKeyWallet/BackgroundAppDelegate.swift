import Foundation
import React
import Expo
import ExpoModulesCore
import ReactAppDependencyProvider

class BackgroundAppDelegate: ExpoAppDelegate {
  var window: UIWindow?
  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func startBackgroundRunner() {
    DispatchQueue.main.async {
      let delegate = BackgroundReactNativeDelegate()
      let factory = ExpoReactNativeFactory(delegate: delegate)
      delegate.dependencyProvider = RCTAppDependencyProvider()
      
      self.reactNativeDelegate = delegate
      self.reactNativeFactory = factory
      self.bindReactNativeFactory(factory)

      factory.startBackgroundReactNative(
        withModuleName: BackgroundReactNativeDelegate.BACKGROUND_BUNDLE_NAME,
      )
    }
  }
}

class BackgroundReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  static let BACKGROUND_BUNDLE_NAME = "background"
  static let BACKGROUND_BUNDLE_DEBUG_URL = "http://localhost:8082/apps/mobile/background.bundle?platform=ios&dev=true&lazy=false&minify=false&inlineSourceMap=false&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server&app=so.onekey.wallet&transform.routerRoot=app&transform.engine=hermes&transform.bytecode=1&unstable_transformProfile=hermes-stable"
  
  // Override to provide the JS bundle URL for the background runner
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // Use bundleURL() if bridge.bundleURL is not set
    return bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    // Load Metro bundle for background runner (change root as needed)
    return URL(string: BackgroundReactNativeDelegate.BACKGROUND_BUNDLE_DEBUG_URL)
#else
    // Look for updated background bundle in Documents first
    // if let bundlePath = BundleUpdateModule.currentBundleBackgroundJSBundle() {
    //   return URL(string: bundlePath)
    // }
    // Fallback: look for main bundle background.jsbundle
    return Bundle.main.url(forResource: BackgroundReactNativeDelegate.BACKGROUND_BUNDLE_NAME, withExtension: "jsbundle")
#endif
  }
}

