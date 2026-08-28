import Foundation

struct AppClipAttributionRecord: Codable {
  static let currentSchemaVersion = 1

  var schemaVersion = currentSchemaVersion
  var clickId: String?
  var utmCampaign: String?
  var utmContent: String?
  var utmId: String?
  var utmMedium: String?
  var utmSource: String?
  var utmTerm: String?
  var campaignId: String?
  var experience: String
  var route: String
  var selectedAddress: String?
  var selectedIsNative: Bool?
  var selectedNetwork: String?
  var selectedSymbol: String?
  var lastAction: String
  var openedAt: Date
  var updatedAt: Date

  var bridgeDictionary: [String: Any] {
    var result: [String: Any] = [
      "schemaVersion": schemaVersion,
      "experience": experience,
      "route": route,
      "lastAction": lastAction,
      "openedAt": openedAt.timeIntervalSince1970,
      "updatedAt": updatedAt.timeIntervalSince1970,
    ]
    let optionalValues: [String: String?] = [
      "clickId": clickId,
      "utmCampaign": utmCampaign,
      "utmContent": utmContent,
      "utmId": utmId,
      "utmMedium": utmMedium,
      "utmSource": utmSource,
      "utmTerm": utmTerm,
      "campaignId": campaignId,
      "selectedAddress": selectedAddress,
      "selectedNetwork": selectedNetwork,
      "selectedSymbol": selectedSymbol,
    ]
    for (key, value) in optionalValues {
      if let value {
        result[key] = value
      }
    }
    if let selectedIsNative {
      result["selectedIsNative"] = selectedIsNative
    }
    return result
  }
}

enum AppClipAttributionStore {
  static let appGroupIdentifier = "group.so.onekey.wallet"
  static let pendingRecordKey = "app_clip_attribution_pending_v1"

  static func load() -> AppClipAttributionRecord? {
    guard
      let data = defaults?.data(forKey: pendingRecordKey),
      let record = try? decoder.decode(AppClipAttributionRecord.self, from: data),
      record.schemaVersion == AppClipAttributionRecord.currentSchemaVersion
    else {
      return nil
    }
    return record
  }

  static func save(_ record: AppClipAttributionRecord) {
    guard let data = try? encoder.encode(record) else {
      return
    }
    defaults?.set(data, forKey: pendingRecordKey)
  }

  static func clear() {
    defaults?.removeObject(forKey: pendingRecordKey)
  }

  private static let defaults = UserDefaults(suiteName: appGroupIdentifier)
  private static let encoder = JSONEncoder()
  private static let decoder = JSONDecoder()
}
