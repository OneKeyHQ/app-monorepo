import Foundation
import React
import Expo
import ExpoModulesCore

@objc(BackgroundRunnerModule)
class BackgroundRunnerModule: RCTEventEmitter {
  static let shared = BackgroundRunnerModule()
  private let backgroundAppDelegate = BackgroundAppDelegate()

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
    backgroundAppDelegate.startBackgroundRunner()
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
