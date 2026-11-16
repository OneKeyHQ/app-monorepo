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

struct SwapLiveActivityToken: Codable, Hashable {
  let symbol: String
  let iconUrl: String
  let networkName: String
  let networkId: String?
  let isNative: Bool?
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
    var updatedAtMs: Double
    var revision: Int64
    var displayPhase: String
    var etaMinutes: Int
    var almostDone: Bool
    var imageRevision: Int?
    var progressStoppedAtMs: Double?
    var terminalAtMs: Double?
    var strings: SwapLiveActivityStrings?

    func firstTerminalDate(now: Date) -> Date {
      let nowMs = now.timeIntervalSince1970 * 1000
      // Older activities lack terminalAtMs; their last update is the best available timestamp.
      let candidate = terminalAtMs ?? updatedAtMs
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
      guard status.isTerminal else { return }
      terminalAtMs = (previous.status.isTerminal ? previous.firstTerminalDate(now: now) : now)
        .timeIntervalSince1970 * 1000
    }

    static func make(
      order: SwapLiveActivityOrder,
      status: SwapLiveActivityStatus,
      revision: Int64,
      updatedAtMs: Double,
      displayPhase: String = "eta",
      strings: SwapLiveActivityStrings? = nil
    ) -> Self {
      let remaining = max(0, order.estimatedEndAt.timeIntervalSinceNow)
      return Self(
        status: status,
        updatedAtMs: updatedAtMs,
        revision: revision,
        displayPhase: displayPhase,
        etaMinutes: Int(ceil(remaining / 60)),
        almostDone: !status.isTerminal && !status.isError && remaining < 10,
        imageRevision: 0,
        progressStoppedAtMs: status.isError ? updatedAtMs : nil,
        terminalAtMs: nil,
        strings: strings
      )
    }
  }

  let order: SwapLiveActivityOrder
  let fromIconName: String
  let toIconName: String
}

struct SwapLiveActivityRequest: Decodable {
  struct Content: Decodable {
    let status: SwapLiveActivityStatus
    let updatedAtMs: Double
    let revision: Int64
    let strings: SwapLiveActivityStrings?
  }
  let order: SwapLiveActivityOrder
  let content: Content
}

struct SwapLiveActivityStringsRequest: Decodable {
  let orderKey: String
  let revision: Int64
  let strings: SwapLiveActivityStrings
}
