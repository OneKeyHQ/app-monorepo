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
    resolve(
      AppClipAttributionFallbackStore.load(
        sharedRecord: AppClipAttributionStore.load()
      )
    )
  }

  @objc(savePending:resolver:rejecter:)
  func savePending(
    _ record: NSDictionary,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    let savedToAppGroup = AppClipAttributionStore.saveReportingSnapshot(record)
    let savedToFallback = AppClipAttributionFallbackStore.save(record)
    resolve(savedToAppGroup || savedToFallback)
  }

  @objc(clearPending:rejecter:)
  func clearPending(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    do {
      try AppClipAttributionStore.clear()
      AppClipAttributionFallbackStore.clear()
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

private enum AppClipAttributionFallbackStore {
  private static let recordKey = "app_clip_attribution_pending_fallback_v1"
  private static let updatedAtKey = "app_clip_attribution_pending_fallback_updated_at_v1"
  private static let defaults = UserDefaults.standard

  static func load(sharedRecord: AppClipAttributionRecord?) -> [String: Any]? {
    guard
      let data = defaults.data(forKey: recordKey),
      let fallbackRecord = try? PropertyListSerialization.propertyList(
        from: data,
        options: [],
        format: nil
      ) as? [String: Any]
    else {
      return sharedRecord?.bridgeDictionary
    }
    guard let sharedRecord else {
      return fallbackRecord
    }
    let fallbackUpdatedAt = defaults.double(forKey: updatedAtKey)
    if fallbackUpdatedAt >= sharedRecord.updatedAt.timeIntervalSince1970 {
      return fallbackRecord
    }
    return sharedRecord.bridgeDictionary
  }

  static func save(_ record: NSDictionary) -> Bool {
    guard
      let data = try? PropertyListSerialization.data(
        fromPropertyList: record,
        format: .binary,
        options: 0
      )
    else {
      return false
    }
    defaults.set(data, forKey: recordKey)
    defaults.set(Date().timeIntervalSince1970, forKey: updatedAtKey)
    return defaults.data(forKey: recordKey) == data
  }

  static func clear() {
    defaults.removeObject(forKey: recordKey)
    defaults.removeObject(forKey: updatedAtKey)
  }
}
