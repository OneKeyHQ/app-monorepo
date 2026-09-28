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
      matches(
        record,
        clickId: clickId,
        openedAt: (snapshot["openedAt"] as? NSNumber)?.doubleValue
      )
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

  static func isCurrentHandoff(
    clickId: String,
    openedAt: TimeInterval?
  ) -> Bool {
    guard let record = load() else {
      return false
    }
    return matches(record, clickId: clickId, openedAt: openedAt)
  }

  static func clear(
    matchingClickId clickId: String,
    openedAt: TimeInterval?
  ) throws {
    guard let pendingRecordURL else {
      throw AppClipAttributionStoreError.appGroupContainerUnavailable
    }
    guard
      let record = load(),
      matches(record, clickId: clickId, openedAt: openedAt)
    else {
      return
    }
    do {
      try FileManager.default.removeItem(at: pendingRecordURL)
    } catch let error as CocoaError where error.code == .fileNoSuchFile {
      return
    }
  }

  private static func matches(
    _ record: AppClipAttributionRecord,
    clickId: String,
    openedAt: TimeInterval?
  ) -> Bool {
    guard record.clickId == clickId else {
      return false
    }
    guard let openedAt, openedAt > 0 else {
      return true
    }
    return abs(record.openedAt.timeIntervalSince1970 - openedAt) < 0.000_001
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

/// Invite code carried by an App Clip invocation (`ref_code`), handed to the
/// full app through the App Group container.
///
/// Kept apart from the pending attribution record on purpose: that record is
/// keyed by `click_id` and deleted once the full app reports it, while the
/// invite code must outlive the report until the full app has captured it, and
/// must survive invocations that carry no code at all.
struct AppClipInviteCodeRecord: Codable {
  static let currentSchemaVersion = 1

  var schemaVersion = currentSchemaVersion
  var code: String
  var capturedAt: Date

  var bridgeDictionary: [String: Any] {
    [
      "schemaVersion": schemaVersion,
      "code": code,
      // Milliseconds, matching the JS side's `attributedAt`.
      "capturedAt": capturedAt.timeIntervalSince1970 * 1_000,
    ]
  }
}

/// Only the App Clip may call `save`. The full app reads this file on its
/// first launch and treats "file present" as "this install came from an invite
/// link"; that holds only because the App Clip cannot run once the full app is
/// installed, which keeps upgraded installs out. Writing it from the full app
/// (or from any path that runs after install) would break the first-launch
/// rule in `installInviteCodeCapture.ts`.
enum AppClipInviteCodeStore {
  static let recordFilename = "app_clip_invite_code_v1.json"

  /// Mirrors `INVITE_CODE_PATTERN` in `installReferrerUtils.ts`.
  static func sanitize(_ value: String?) -> String? {
    guard
      let value = value?.trimmingCharacters(in: .whitespacesAndNewlines),
      value.range(of: "^[A-Za-z0-9]{1,30}$", options: .regularExpression) != nil
    else {
      return nil
    }
    return value
  }

  /// The handed-off record, or nil when there is definitively none (no file,
  /// or one that is unreadable as a record). Throws when the answer is not
  /// known — the App Group container is unavailable or the file cannot be
  /// read — so the full app keeps its capture pending instead of concluding
  /// "no code".
  static func loadHandoff() throws -> AppClipInviteCodeRecord? {
    guard let recordURL else {
      throw AppClipInviteCodeStoreError.appGroupContainerUnavailable
    }
    let data: Data
    do {
      data = try Data(contentsOf: recordURL)
    } catch let error as CocoaError where error.code == .fileReadNoSuchFile {
      return nil
    }
    guard
      let record = try? decoder.decode(AppClipInviteCodeRecord.self, from: data),
      record.schemaVersion == AppClipInviteCodeRecord.currentSchemaVersion,
      sanitize(record.code) != nil
    else {
      return nil
    }
    return record
  }

  /// The most recent invocation that carried a code wins; an invocation
  /// without one leaves the stored code untouched.
  @discardableResult
  static func save(code: String) -> Bool {
    guard
      let code = sanitize(code),
      let recordURL,
      let data = try? encoder.encode(
        AppClipInviteCodeRecord(code: code, capturedAt: Date())
      )
    else {
      return false
    }
    do {
      try data.write(to: recordURL, options: .atomic)
      return true
    } catch {
      return false
    }
  }

  private static var recordURL: URL? {
    FileManager.default
      .containerURL(
        forSecurityApplicationGroupIdentifier: AppClipAttributionStore.appGroupIdentifier
      )?
      .appendingPathComponent(recordFilename, isDirectory: false)
  }

  private static let encoder = JSONEncoder()
  private static let decoder = JSONDecoder()
}

private enum AppClipInviteCodeStoreError: LocalizedError {
  case appGroupContainerUnavailable

  var errorDescription: String? {
    "App Group container is unavailable."
  }
}
