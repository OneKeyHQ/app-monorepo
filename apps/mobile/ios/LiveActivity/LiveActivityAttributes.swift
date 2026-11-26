import ActivityKit
import Foundation

enum SwapLiveActivityStatus: String, Codable {
  case confirming, swapping, receiving, refunding, done, failed, refunded, canceled

  var isTerminal: Bool {
    [.done, .refunded, .canceled].contains(self)
  }

  var isRefund: Bool {
    self == .refunding || self == .refunded
  }

  var isError: Bool {
    [.refunding, .failed, .refunded, .canceled].contains(self)
  }

  func canAdvance(to next: Self) -> Bool {
    if self == .failed { return [.failed, .refunding, .refunded].contains(next) }
    if isTerminal { return self == next }
    if self == .refunding { return [.refunding, .refunded, .failed].contains(next) }
    return true
  }
}

enum SwapLiveActivityFailure: String, Codable {
  case expired, refundFailed
}

struct SwapLiveActivityToken: Codable, Hashable {
  let symbol: String
  let iconUrl: String
  let networkName: String
  let networkId: String?
  let isNative: Bool?

  var isNativeBitcoin: Bool { networkId == "btc--0" && isNative == true }
}

struct SwapLiveActivityStrings: Codable, Hashable {
  let done: String
  let failed: String
  let refunded: String
  let canceled: String
  let refunding: String
  let almostDone: String
  let confirmingFrom: String
  let confirmingTo: String
  let pending: String
  let swapFailed: String
  let etaTemplate: String
  let lastUpdated: String
  var lastUpdatedLabel: String? = nil
  var locale: String? = nil
  var refundFailed: String? = nil
  var expired: String? = nil
  var partiallyFilled: String? = nil
}

struct SwapLiveActivityOrder: Codable, Hashable {
  let schemaVersion: Int
  let orderKey: String
  let serviceOrderId: String?
  let depositTxId: String
  let networkId: String
  let provider: String
  let fromToken: SwapLiveActivityToken
  let toToken: SwapLiveActivityToken
  let startedAtMs: Double
  let estimatedEndAtMs: Double
  let expiresAtMs: Double
  let isMock: Bool
  let isPushTest: Bool?

  var isRealOrderOrPushTest: Bool { !isMock || isPushTest == true }
  var startedAt: Date { Date(timeIntervalSince1970: startedAtMs / 1000) }
  var estimatedEndAt: Date { Date(timeIntervalSince1970: estimatedEndAtMs / 1000) }
  var expiresAt: Date { Date(timeIntervalSince1970: expiresAtMs / 1000) }
  var detailURL: URL? {
    var url = URLComponents()
    url.scheme = "onekey-wallet"
    url.host = "swap_activity"
    url.queryItems = [URLQueryItem(name: "orderKey", value: orderKey)]
    return url.url
  }
}

struct SwapLiveActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var status: SwapLiveActivityStatus
    var failureDetail: SwapLiveActivityFailure?
    var updatedAtMs: Double?
    var revision: Int64?
    var displayPhase: String?
    var etaMinutes: Int?
    var almostDone: Bool?
    var imageRevision: Int?
    var progressStoppedAtMs: Double?
    var terminalAtMs: Double?
    var strings: SwapLiveActivityStrings?
    private var remote: RemotePresentation?

    private enum CodingKeys: String, CodingKey {
      case status, updatedAtMs, revision, displayPhase, etaMinutes, almostDone
      case imageRevision, progressStoppedAtMs, terminalAtMs, strings, remote, failureDetail
    }

    private struct RemotePresentation: Codable, Hashable {
      enum Status: String, Codable {
        case pending, success, partiallyFilled, refunding, refunded, failed, expired, canceled
      }

      enum CodingKeys: String, CodingKey {
        case status, progress, msg, crossChainStatus
      }

      let status: Status
      let progress: Double
      let msg: String?
      let crossChainStatus: String?

      var displayStatus: SwapLiveActivityStatus {
        switch status {
        case .pending:
          switch crossChainStatus {
          case "TO_PENDING": return .receiving
          case "FROM_SUCCESS", "BRIDGE_PENDING", "BRIDGE_SUCCESS": return .swapping
          default: return .confirming
          }
        case .success, .partiallyFilled: return .done
        case .refunding: return .refunding
        case .refunded: return .refunded
        case .failed, .expired: return .failed
        case .canceled: return .canceled
        }
      }
    }

    var isTerminal: Bool { status.isTerminal || isRefundFailed }
    var isRefundFailed: Bool { failureDetail == .refundFailed || remote?.crossChainStatus == "REFUND_FAILED" }
    var isPartiallyFilled: Bool { remote?.status == .partiallyFilled }
    var isExpired: Bool { failureDetail == .expired || remote?.status == .expired }
    var remoteMessage: String? { remote?.msg.flatMap { $0.isEmpty ? nil : $0 } }
    var remoteProgress: Double? { remote?.progress }

    init(from decoder: Decoder) throws {
      let values = try decoder.container(keyedBy: CodingKeys.self)
      progressStoppedAtMs = try values.decodeIfPresent(Double.self, forKey: .progressStoppedAtMs)
      let remoteKeys = try decoder.container(keyedBy: RemotePresentation.CodingKeys.self)
      // The Kafka revision and final flag are outside the state forwarded to ActivityKit.
      if let storedRemote = try values.decodeIfPresent(RemotePresentation.self, forKey: .remote) {
        remote = storedRemote
        status = storedRemote.displayStatus
      } else if remoteKeys.contains(.progress) {
        let incoming = try RemotePresentation(from: decoder)
        remote = incoming
        status = incoming.displayStatus
      } else {
        status = try values.decode(SwapLiveActivityStatus.self, forKey: .status)
        failureDetail = try values.decodeIfPresent(SwapLiveActivityFailure.self, forKey: .failureDetail)
        updatedAtMs = try values.decode(Double.self, forKey: .updatedAtMs)
        revision = try values.decode(Int64.self, forKey: .revision)
        displayPhase = try values.decode(String.self, forKey: .displayPhase)
        etaMinutes = try values.decode(Int.self, forKey: .etaMinutes)
        almostDone = try values.decode(Bool.self, forKey: .almostDone)
        imageRevision = try values.decodeIfPresent(Int.self, forKey: .imageRevision)
        terminalAtMs = try values.decodeIfPresent(Double.self, forKey: .terminalAtMs)
        strings = try values.decodeIfPresent(SwapLiveActivityStrings.self, forKey: .strings)
      }
      if remote != nil {
        if let timestamp = try? values.decode(Double.self, forKey: .updatedAtMs),
           timestamp.isFinite, timestamp > 0, timestamp <= 253_402_300_799_999 {
          updatedAtMs = timestamp
        }
      }
    }

    private init(
      status: SwapLiveActivityStatus,
      failureDetail: SwapLiveActivityFailure?,
      updatedAtMs: Double,
      revision: Int64,
      displayPhase: String,
      etaMinutes: Int,
      almostDone: Bool,
      progressStoppedAtMs: Double?,
      strings: SwapLiveActivityStrings?
    ) {
      self.status = status
      self.failureDetail = status == .failed ? failureDetail : nil
      self.updatedAtMs = updatedAtMs
      self.revision = revision
      self.displayPhase = displayPhase
      self.etaMinutes = etaMinutes
      self.almostDone = almostDone
      self.imageRevision = 0
      self.progressStoppedAtMs = progressStoppedAtMs
      self.strings = strings
    }

    func firstTerminalDate(now: Date) -> Date {
      let nowMs = now.timeIntervalSince1970 * 1000
      // Older activities lack terminalAtMs; their last update is the best available timestamp.
      let candidate = terminalAtMs ?? updatedAtMs ?? nowMs
      let terminalMs = candidate.isFinite && candidate > 0 ? min(candidate, nowMs) : nowMs
      return Date(timeIntervalSince1970: terminalMs / 1000)
    }

    func terminalSchedule(now: Date) -> (endDelay: TimeInterval, dismissalDate: Date) {
      let terminalDate = firstTerminalDate(now: now)
      return (
        max(0, terminalDate.addingTimeInterval(30).timeIntervalSince(now)),
        terminalDate.addingTimeInterval(210)
      )
    }

    mutating func preserveTerminalDate(from previous: Self, now: Date) {
      guard isTerminal else { return }
      terminalAtMs = (previous.isTerminal ? previous.firstTerminalDate(now: now) : now)
        .timeIntervalSince1970 * 1000
    }

    static func make(
      order: SwapLiveActivityOrder,
      status: SwapLiveActivityStatus,
      failureDetail: SwapLiveActivityFailure? = nil,
      revision: Int64,
      updatedAtMs: Double,
      displayPhase: String = "eta",
      strings: SwapLiveActivityStrings? = nil
    ) -> Self {
      let remaining = max(0, order.estimatedEndAt.timeIntervalSinceNow)
      return Self(
        status: status,
        failureDetail: failureDetail,
        updatedAtMs: updatedAtMs,
        revision: revision,
        displayPhase: displayPhase,
        etaMinutes: Int(ceil(remaining / 60)),
        almostDone: !status.isTerminal && !status.isError && remaining < 10,
        progressStoppedAtMs: status.isError ? updatedAtMs : nil,
        strings: strings
      )
    }
  }

  let order: SwapLiveActivityOrder
  let fromIconName: String
  let toIconName: String
  let remoteUpdatesEnabled: Bool?
  var strings: SwapLiveActivityStrings? = nil
  var requestedAt: Date? = nil

  var usesRemoteUpdates: Bool {
    if let remoteUpdatesEnabled { return remoteUpdatesEnabled }
    // Activities created by older builds requested a token only for BTC sends or push tests.
    return order.isPushTest == true || (!order.isMock && order.fromToken.isNativeBitcoin)
  }
}

struct SwapLiveActivityIconURLs: Decodable {
  let from: String?
  let to: String?
}

struct SwapLiveActivityIconPrefetchRequest: Decodable {
  let urls: SwapLiveActivityIconURLs
  let activityId: String?
}

struct SwapLiveActivityRequest: Decodable {
  struct Content: Decodable {
    let status: SwapLiveActivityStatus
    let failureDetail: SwapLiveActivityFailure?
    let updatedAtMs: Double
    let revision: Int64
    let strings: SwapLiveActivityStrings?
  }
  struct TerminalFallback: Decodable {
    enum Reason: String, Decodable {
      case jpushFailed, subscriptionRejected
    }
    let activityId: String
    let reason: Reason
  }
  let order: SwapLiveActivityOrder
  let content: Content
  let iconUrls: SwapLiveActivityIconURLs?
  let supportsBtcReceivingPush: Bool?
  let terminalFallback: TerminalFallback?
}

private let swapLiveActivityAppGroup = "group.so.onekey.wallet"
private let swapLiveActivityDefaults = UserDefaults(suiteName: swapLiveActivityAppGroup)

enum SwapLiveActivitySharedLabels {
  static let key = "swapLiveActivity.localizedLabels"
  static let defaults = swapLiveActivityDefaults

  static func decode(_ data: Data) -> [String: SwapLiveActivityStrings] {
    (try? JSONDecoder().decode([String: SwapLiveActivityStrings].self, from: data)) ?? [:]
  }

  static func set(_ strings: SwapLiveActivityStrings, for activityID: String, keeping activityIDs: Set<String>) {
    guard let defaults else { return }
    let previous = decode(defaults.data(forKey: key) ?? Data())
    var updated = previous.filter { activityIDs.contains($0.key) }
    updated[activityID] = strings
    guard updated != previous, let data = try? JSONEncoder().encode(updated) else { return }
    defaults.set(data, forKey: key)
  }
}

enum SwapLiveActivityIconFiles {
  struct Names: Codable, Equatable {
    let from: String
    let to: String

    func fillingMissing(with other: Names) -> Names {
      Names(from: from.isEmpty ? other.from : from, to: to.isEmpty ? other.to : to)
    }
  }

  private static let assignedNamesKey = "swapLiveActivity.assignedIconNames"

  static var directory: URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: swapLiveActivityAppGroup)?
      .appendingPathComponent("LiveActivityIcons", isDirectory: true)
  }

  static func available(_ name: String) -> String {
    guard !name.isEmpty, let directory,
          FileManager.default.fileExists(atPath: directory.appendingPathComponent(name).path) else { return "" }
    return name
  }

  private static func assignments() -> [String: Names] {
    guard let data = swapLiveActivityDefaults?.data(forKey: assignedNamesKey) else { return [:] }
    return (try? JSONDecoder().decode([String: Names].self, from: data)) ?? [:]
  }

  static func names(for activityId: String, attributes: SwapLiveActivityAttributes) -> Names {
    let initial = Names(from: attributes.fromIconName, to: attributes.toIconName)
    return assignments()[activityId]?.fillingMissing(with: initial) ?? initial
  }

  static func assign(_ names: Names, to activityId: String, attributes: SwapLiveActivityAttributes,
                     keeping activityIds: Set<String>) -> Bool {
    let previous = assignments()
    let initial = Names(from: attributes.fromIconName, to: attributes.toIconName)
    let displayed = previous[activityId]?.fillingMissing(with: initial) ?? initial
    let next = names.fillingMissing(with: displayed)
    guard next != displayed else { return false }
    var updated = previous.filter { activityIds.contains($0.key) }
    updated[activityId] = next
    guard let defaults = swapLiveActivityDefaults,
          let data = try? JSONEncoder().encode(updated) else { return false }
    defaults.set(data, forKey: assignedNamesKey)
    return true
  }

  static func clearAssignments() {
    swapLiveActivityDefaults?.removeObject(forKey: assignedNamesKey)
  }
}

struct SwapLiveActivityStringsRequest: Decodable {
  let orderKey: String
  let revision: Int64?
  let strings: SwapLiveActivityStrings
}
