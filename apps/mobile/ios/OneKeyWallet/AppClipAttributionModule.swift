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
    let openedAt = (record["openedAt"] as? NSNumber)?.doubleValue
    let savedToAppGroup = AppClipAttributionStore.saveReportingSnapshot(record)
    guard
      let clickId = record["clickId"] as? String,
      AppClipAttributionStore.isCurrentHandoff(
        clickId: clickId,
        openedAt: openedAt
      )
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
    clearPendingHandoff(
      clickId,
      openedAt: nil,
      resolver: resolve,
      rejecter: reject
    )
  }

  @objc(clearPendingHandoff:openedAt:resolver:rejecter:)
  func clearPendingHandoff(
    _ clickId: String,
    openedAt: NSNumber,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    clearPendingHandoff(
      clickId,
      openedAt: openedAt.doubleValue,
      resolver: resolve,
      rejecter: reject
    )
  }

  private func clearPendingHandoff(
    _ clickId: String,
    openedAt: TimeInterval?,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    do {
      try AppClipAttributionStore.clear(
        matchingClickId: clickId,
        openedAt: openedAt
      )
      AppClipAttributionFallbackStore.clear(
        matchingClickId: clickId,
        openedAt: openedAt
      )
      resolve(nil)
    } catch {
      AppClipAttributionFallbackStore.markCleared(
        clickId: clickId,
        openedAt: openedAt
      )
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
  private static let clearedClickIdKey = "app_clip_attribution_cleared_click_id_v1"
  private static let clearedOpenedAtKey = "app_clip_attribution_cleared_opened_at_v1"
  private static let clearedAtKey = "app_clip_attribution_cleared_at_v1"
  private static let defaults = UserDefaults.standard

  static func load(sharedRecord: AppClipAttributionRecord?) -> [String: Any]? {
    if let clearedClickId = defaults.string(forKey: clearedClickIdKey) {
      guard let sharedRecord else {
        return nil
      }
      let clearedAt = defaults.double(forKey: clearedAtKey)
      let clearedOpenedAt = defaults.object(forKey: clearedOpenedAtKey) == nil
        ? nil
        : defaults.double(forKey: clearedOpenedAtKey)
      let matchesClearedHandoff = matches(
        clickId: sharedRecord.clickId,
        openedAt: sharedRecord.openedAt.timeIntervalSince1970,
        expectedClickId: clearedClickId,
        expectedOpenedAt: clearedOpenedAt
      )
      if matchesClearedHandoff && (
        clearedOpenedAt != nil ||
          sharedRecord.updatedAt.timeIntervalSince1970 <= clearedAt
      ) {
        return nil
      }
      clearTombstone()
    }
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
    guard
      let fallbackClickId = fallbackRecord["clickId"] as? String,
      fallbackClickId == sharedRecord.clickId
    else {
      clear()
      return sharedRecord.bridgeDictionary
    }
    if
      let fallbackOpenedAt = (fallbackRecord["openedAt"] as? NSNumber)?.doubleValue,
      !matches(
        clickId: sharedRecord.clickId,
        openedAt: sharedRecord.openedAt.timeIntervalSince1970,
        expectedClickId: fallbackClickId,
        expectedOpenedAt: fallbackOpenedAt
      )
    {
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

  static func clear(
    matchingClickId clickId: String,
    openedAt: TimeInterval?
  ) {
    clearTombstone(matchingClickId: clickId, openedAt: openedAt)
    guard
      let data = defaults.data(forKey: recordKey),
      let record = try? PropertyListSerialization.propertyList(
        from: data,
        options: [],
        format: nil
      ) as? [String: Any],
      matches(
        clickId: record["clickId"] as? String,
        openedAt: (record["openedAt"] as? NSNumber)?.doubleValue,
        expectedClickId: clickId,
        expectedOpenedAt: openedAt
      )
    else {
      return
    }
    clear()
  }

  static func markCleared(clickId: String, openedAt: TimeInterval?) {
    clear(matchingClickId: clickId, openedAt: openedAt)
    defaults.set(clickId, forKey: clearedClickIdKey)
    if let openedAt {
      defaults.set(openedAt, forKey: clearedOpenedAtKey)
    } else {
      defaults.removeObject(forKey: clearedOpenedAtKey)
    }
    defaults.set(Date().timeIntervalSince1970, forKey: clearedAtKey)
  }

  private static func clear() {
    defaults.removeObject(forKey: recordKey)
    defaults.removeObject(forKey: updatedAtKey)
  }

  private static func clearTombstone(
    matchingClickId clickId: String? = nil,
    openedAt: TimeInterval? = nil
  ) {
    if
      let clickId,
      let clearedClickId = defaults.string(forKey: clearedClickIdKey),
      !matches(
        clickId: clearedClickId,
        openedAt: defaults.object(forKey: clearedOpenedAtKey) == nil
          ? nil
          : defaults.double(forKey: clearedOpenedAtKey),
        expectedClickId: clickId,
        expectedOpenedAt: openedAt
      )
    {
      return
    }
    defaults.removeObject(forKey: clearedClickIdKey)
    defaults.removeObject(forKey: clearedOpenedAtKey)
    defaults.removeObject(forKey: clearedAtKey)
  }

  private static func matches(
    clickId: String?,
    openedAt: TimeInterval?,
    expectedClickId: String,
    expectedOpenedAt: TimeInterval?
  ) -> Bool {
    guard clickId == expectedClickId else {
      return false
    }
    guard let expectedOpenedAt, expectedOpenedAt > 0 else {
      return true
    }
    guard let openedAt else {
      return false
    }
    return abs(openedAt - expectedOpenedAt) < 0.000_001
  }
}
