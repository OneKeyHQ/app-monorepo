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

  @objc(savePending:resolver:rejecter:)
  func savePending(
    _ record: NSDictionary,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    resolve(AppClipAttributionStore.saveReportingSnapshot(record))
  }

  @objc(clearPending:rejecter:)
  func clearPending(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    do {
      try AppClipAttributionStore.clear()
      resolve(nil)
    } catch {
      reject(
        "APP_CLIP_ATTRIBUTION_CLEAR_FAILED",
        error.localizedDescription,
        error
      )
    }
  }
}
