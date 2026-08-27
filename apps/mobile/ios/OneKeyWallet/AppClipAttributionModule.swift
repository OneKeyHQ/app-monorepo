import Foundation
import React

@objc(AppClipAttribution)
final class AppClipAttributionModule: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(readPending:rejecter:)
  func readPending(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    resolve(AppClipAttributionStore.load()?.bridgeDictionary)
  }

  @objc(clearPending:rejecter:)
  func clearPending(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    AppClipAttributionStore.clear()
    resolve(nil)
  }
}
