import Foundation

// Compile with LiveActivityAttributes.swift for an iOS Simulator and run with simctl spawn.
@main
struct SwapLiveActivityStatusTests {
  static func main() throws {
    let cases: [(String, SwapLiveActivityStatus)] = [
      (#"{"status":"success","progress":1}"#, .done),
      (#"{"status":"pending","progress":0.25}"#, .confirming),
      (#"{"status":"refunding","progress":0.75}"#, .refunding),
      (#"{"status":"refunded","progress":1}"#, .refunded),
      (#"{"status":"refunded","progress":1,"crossChainStatus":"REFUNDING"}"#, .refunded),
      (#"{"status":"failed","progress":0.5}"#, .failed),
      (#"{"status":"canceled","progress":0.5}"#, .canceled),
      (#"{"status":"success","progress":1,"extraStatus":"REFUNDED"}"#, .refunded),
      (#"{"status":"failed","progress":1,"extraStatus":"REFUNDED"}"#, .refunded),
      (#"{"status":"success","progress":1,"crossChainStatus":"REFUNDED"}"#, .refunded),
      (#"{"status":"failed","progress":0.75,"crossChainStatus":"REFUNDING"}"#, .refunding),
      (#"{"status":"partiallyFilled","progress":1,"extraStatus":"REFUNDED"}"#, .refunded),
      (#"{"status":"expired","progress":1,"extraStatus":"REFUNDED"}"#, .refunded),
    ]
    for (payload, expected) in cases {
      let state = try JSONDecoder().decode(
        SwapLiveActivityAttributes.ContentState.self, from: Data(payload.utf8)
      )
      precondition(state.status == expected, "Unexpected status for \(payload)")
      if expected == .refunded {
        precondition(state.isTerminal && !state.isPartiallyFilled && !state.isExpired,
          "A completed refund must keep its status after decoding")
      }
      let stored = try JSONEncoder().encode(state)
      let restored = try JSONDecoder().decode(SwapLiveActivityAttributes.ContentState.self, from: stored)
      precondition(restored.status == expected, "Status changed after round trip for \(payload)")
    }
    let partial = try JSONDecoder().decode(SwapLiveActivityAttributes.ContentState.self,
      from: Data(#"{"status":"partiallyFilled","progress":1}"#.utf8))
    precondition(partial.isPartiallyFilled, "Partial-fill status must retain its label")
    let expired = try JSONDecoder().decode(SwapLiveActivityAttributes.ContentState.self,
      from: Data(#"{"status":"expired","progress":0.5}"#.utf8))
    precondition(expired.isExpired, "Expired status must retain its label")
    let refundingOverride = try JSONDecoder().decode(SwapLiveActivityAttributes.ContentState.self,
      from: Data(#"{"status":"success","progress":1,"crossChainStatus":"REFUNDING","msg":"Done"}"#.utf8))
    precondition(refundingOverride.status == .refunding && refundingOverride.remoteMessage == nil,
      "A refunding override must not retain the previous status message")
    let normalRefunding = try JSONDecoder().decode(SwapLiveActivityAttributes.ContentState.self,
      from: Data(#"{"status":"refunding","progress":0.5,"msg":"Refund initiated"}"#.utf8))
    precondition(normalRefunding.remoteMessage == "Refund initiated",
      "A matching refunding message must remain available")
    let messageCases: [(String, String?)] = [
      (#"{"status":"failed","progress":0.3,"msg":"Insufficient liquidity"}"#, "Insufficient liquidity"),
      (#"{"status":"failed","progress":0.3,"msg":"   "}"#, nil),
      (#"{"status":"success","progress":1,"msg":"\n\t"}"#, nil),
      (#"{"status":"failed","progress":0.3,"msg":" Insufficient liquidity\n"}"#, "Insufficient liquidity"),
      (#"{"status":"success","progress":1,"msg":"Swap completed"}"#, "Swap completed"),
      (#"{"status":"success","progress":1,"extraStatus":"REFUNDED","msg":"Swap completed"}"#, nil),
      (#"{"status":"refunded","progress":1,"msg":"Swap failed"}"#, nil),
      (#"{"status":"canceled","progress":0,"msg":"Swap failed"}"#, nil),
    ]
    for (payload, expectedMessage) in messageCases {
      let state = try JSONDecoder().decode(SwapLiveActivityAttributes.ContentState.self,
        from: Data(payload.utf8))
      precondition(state.remoteMessage == expectedMessage, "Unexpected display message for \(payload)")
    }
    let completedRefund = try JSONDecoder().decode(SwapLiveActivityAttributes.ContentState.self,
      from: Data(#"{"status":"success","progress":1,"extraStatus":"REFUNDED","crossChainStatus":"REFUND_FAILED"}"#.utf8))
    precondition(completedRefund.status == .refunded && !completedRefund.isRefundFailed,
      "A completed refund must not display a refund-failed label")
    let legacy = try JSONDecoder().decode(SwapLiveActivityAttributes.ContentState.self,
      from: Data(#"{"status":"confirming","updatedAtMs":1000,"revision":1,"displayPhase":"eta","etaMinutes":4,"almostDone":false}"#.utf8))
    precondition(legacy.status == .confirming && legacy.etaMinutes == 4,
      "Existing local activity state must remain decodable")
    let storedRemote = try JSONDecoder().decode(SwapLiveActivityAttributes.ContentState.self,
      from: Data(#"{"remote":{"status":"success","progress":1}}"#.utf8))
    precondition(storedRemote.status == .done, "Older stored remote state must remain decodable")
    do {
      _ = try JSONDecoder().decode(SwapLiveActivityAttributes.ContentState.self,
        from: Data(#"{"status":"unknown","progress":1}"#.utf8))
      preconditionFailure("Unknown remote status must not be accepted")
    } catch DecodingError.dataCorrupted { }
    print("Swap Live Activity status: \(cases.count) payloads passed")
  }
}
