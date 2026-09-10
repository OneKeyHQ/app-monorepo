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
    guard
      let clickId = record["clickId"] as? String,
      AppClipAttributionStore.load()?.clickId == clickId
    else {
      resolve(savedToAppGroup)
      return
    }
    let savedToFallback = AppClipAttributionFallbackStore.save(record)
    resolve(savedToAppGroup || savedToFallback)
  }

  @objc(clearPending:resolver:rejecter:)
  func clearPending(
    _ clickId: String,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    do {
      try AppClipAttributionStore.clear(matchingClickId: clickId)
      AppClipAttributionFallbackStore.clear(matchingClickId: clickId)
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
    guard fallbackRecord["clickId"] as? String == sharedRecord.clickId else {
      clear()
      return sharedRecord.bridgeDictionary
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

  static func clear(matchingClickId clickId: String) {
    guard
      let data = defaults.data(forKey: recordKey),
      let record = try? PropertyListSerialization.propertyList(
        from: data,
        options: [],
        format: nil
      ) as? [String: Any],
      record["clickId"] as? String == clickId
    else {
      return
    }
    clear()
  }

  private static func clear() {
    defaults.removeObject(forKey: recordKey)
    defaults.removeObject(forKey: updatedAtKey)
  }
}
