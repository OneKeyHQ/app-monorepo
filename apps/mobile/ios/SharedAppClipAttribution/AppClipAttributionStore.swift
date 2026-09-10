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
  var firstOpenedAt: String?
  var experience: String
  var route: String
  var reportCompleted: Bool?
  var selectedAddress: String?
  var selectedIsNative: Bool?
  var selectedNetwork: String?
  var selectedSymbol: String?
  var shortLinkPath: String?
  var shortLinkVersion: Int?
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
      "firstOpenedAt": firstOpenedAt,
      "selectedAddress": selectedAddress,
      "selectedNetwork": selectedNetwork,
      "selectedSymbol": selectedSymbol,
      "shortLinkPath": shortLinkPath,
    ]
    for (key, value) in optionalValues {
      if let value {
        result[key] = value
      }
    }
    if let selectedIsNative {
      result["selectedIsNative"] = selectedIsNative
    }
    if let reportCompleted {
      result["reportCompleted"] = reportCompleted
    }
    if let shortLinkVersion {
      result["shortLinkVersion"] = shortLinkVersion
    }
    return result
  }
}

enum AppClipAttributionStore {
  static let appGroupIdentifier = "group.so.onekey.wallet"
  static let pendingRecordFilename = "app_clip_attribution_pending_v1.json"

  static func load() -> AppClipAttributionRecord? {
    guard
      let pendingRecordURL,
      let data = try? Data(contentsOf: pendingRecordURL),
      let record = try? decoder.decode(AppClipAttributionRecord.self, from: data),
      record.schemaVersion == AppClipAttributionRecord.currentSchemaVersion
    else {
      return nil
    }
    return record
  }

  @discardableResult
  static func save(_ record: AppClipAttributionRecord) -> Bool {
    guard
      let pendingRecordURL,
      let data = try? encoder.encode(record)
    else {
      return false
    }
    do {
      try data.write(to: pendingRecordURL, options: .atomic)
      return true
    } catch {
      return false
    }
  }

  static func saveReportingSnapshot(_ snapshot: NSDictionary) -> Bool {
    guard
      var record = load(),
      let clickId = snapshot["clickId"] as? String,
      clickId == record.clickId
    else {
      return false
    }
    record.utmCampaign = snapshot["utmCampaign"] as? String
    record.utmContent = snapshot["utmContent"] as? String
    record.utmId = snapshot["utmId"] as? String
    record.utmMedium = snapshot["utmMedium"] as? String
    record.utmSource = snapshot["utmSource"] as? String
    record.utmTerm = snapshot["utmTerm"] as? String
    record.campaignId = snapshot["campaignId"] as? String
    record.firstOpenedAt = snapshot["firstOpenedAt"] as? String
    record.experience = (snapshot["experience"] as? String) ?? record.experience
    record.route = (snapshot["route"] as? String) ?? record.route
    record.reportCompleted = snapshot["reportCompleted"] as? Bool
    record.selectedAddress = snapshot["selectedAddress"] as? String
    record.selectedIsNative = snapshot["selectedIsNative"] as? Bool
    record.selectedNetwork = snapshot["selectedNetwork"] as? String
    record.selectedSymbol = snapshot["selectedSymbol"] as? String
    record.shortLinkPath = snapshot["shortLinkPath"] as? String
    record.shortLinkVersion = (snapshot["shortLinkVersion"] as? NSNumber)?.intValue
    record.lastAction = (snapshot["lastAction"] as? String) ?? record.lastAction
    record.updatedAt = Date()
    return save(record)
  }

  static func clear() throws {
    guard let pendingRecordURL else {
      throw AppClipAttributionStoreError.appGroupContainerUnavailable
    }
    do {
      try FileManager.default.removeItem(at: pendingRecordURL)
    } catch let error as CocoaError where error.code == .fileNoSuchFile {
      return
    }
  }

  private static var pendingRecordURL: URL? {
    FileManager.default
      .containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)?
      .appendingPathComponent(pendingRecordFilename, isDirectory: false)
  }

  private static let encoder = JSONEncoder()
  private static let decoder = JSONDecoder()
}

private enum AppClipAttributionStoreError: LocalizedError {
  case appGroupContainerUnavailable

  var errorDescription: String? {
    "App Group container is unavailable."
  }
}
