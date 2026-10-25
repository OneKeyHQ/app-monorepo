import ActivityKit
import Foundation

struct LiveActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    let progress: Int
  }

  let title: String
}

enum SwapLiveActivityStatus: String, Codable {
  case confirming, swapping, receiving, refunding, done, failed, refunded, canceled

  var isTerminal: Bool {
    [.done, .failed, .refunded, .canceled].contains(self)
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

    static func make(
      order: SwapLiveActivityOrder,
      status: SwapLiveActivityStatus,
      revision: Int64,
      updatedAtMs: Double,
      displayPhase: String = "eta"
    ) -> Self {
      let remaining = max(0, order.estimatedEndAt.timeIntervalSinceNow)
      return Self(
        status: status,
        updatedAtMs: updatedAtMs,
        revision: revision,
        displayPhase: displayPhase,
        etaMinutes: Int(ceil(remaining / 60)),
        almostDone: !status.isTerminal && remaining < 10,
        imageRevision: 0,
        progressStoppedAtMs: status.isError ? updatedAtMs : nil
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
  }
  let order: SwapLiveActivityOrder
  let content: Content
}
