import Foundation

@main
enum HomeContainerProtocolV3Contract {
  private static let decoder = JSONDecoder()

  static func main() throws {
    guard CommandLine.arguments.count == 3 else {
      throw ContractError.invalidArguments
    }
    let snapshot = try decoder.decode(
      HomeContainerProtocolV3SnapshotEnvelope.self,
      from: Data(CommandLine.arguments[1].utf8)
    )
    let patch = try decoder.decode(
      HomeContainerProtocolV3PatchEnvelope.self,
      from: Data(CommandLine.arguments[2].utf8)
    )
    let initial = try applied(
      HomeContainerProtocolV3Transaction.apply(snapshot: snapshot)
    )
    try expect(initial.transportRevision == 11)
    try expect(initial.identity.storeCommitId == 7)
    try expect(initial.snapshot.header.balance == "$100.00")

    let next = try applied(
      HomeContainerProtocolV3Transaction.apply(
        patch: patch,
        current: initial,
        availableSlotRevisions: initial.slotRevisions
      )
    )
    try expect(next.transportRevision == 12)
    try expect(next.identity.storeCommitId == 8)
    try expect(next.snapshot.selectedTabId == "history")
    try expect(next.snapshot.header.balance == "$101.00")
    try expect(next.authorityRevisions.tabApplicability == 3)

    try verifySlotAndTransportGaps(patch: patch, current: initial)
    try verifyIntentAuthority(current: next)
  }

  private static func verifySlotAndTransportGaps(
    patch: HomeContainerProtocolV3PatchEnvelope,
    current: HomeContainerProtocolV3State
  ) throws {
    let missingSlotsPatch = HomeContainerProtocolV3PatchEnvelope(
      kind: patch.kind,
      protocolVersion: patch.protocolVersion,
      identity: patch.identity,
      baseTransportRevision: patch.baseTransportRevision,
      transportRevision: patch.transportRevision,
      presentationRevisions: patch.presentationRevisions,
      authorityRevisions: patch.authorityRevisions,
      requiredSlotRevisions: ["content.state.defi": 9],
      changes: patch.changes
    )
    try expectNeedSnapshot(
      HomeContainerProtocolV3Transaction.apply(
        patch: missingSlotsPatch,
        current: current,
        availableSlotRevisions: current.slotRevisions
      ),
      reason: .slotRevisionGap
    )

    let revisionGapPatch = HomeContainerProtocolV3PatchEnvelope(
      kind: patch.kind,
      protocolVersion: patch.protocolVersion,
      identity: patch.identity,
      baseTransportRevision: patch.baseTransportRevision - 1,
      transportRevision: patch.transportRevision,
      presentationRevisions: patch.presentationRevisions,
      authorityRevisions: patch.authorityRevisions,
      requiredSlotRevisions: [:],
      changes: patch.changes
    )
    try expectNeedSnapshot(
      HomeContainerProtocolV3Transaction.apply(
        patch: revisionGapPatch,
        current: current,
        availableSlotRevisions: current.slotRevisions
      ),
      reason: .revisionGap
    )
  }

  private static func verifyIntentAuthority(
    current: HomeContainerProtocolV3State
  ) throws {
    let owner = current.identity.owner
    let first = HomeContainerProtocolV3Intent(
      protocolVersion: 3,
      intentId: "tab-portfolio",
      owner: owner,
      authority: .tabApplicability(revision: 3),
      intent: .selectTab(tabId: "portfolio")
    )
    let second = HomeContainerProtocolV3Intent(
      protocolVersion: 3,
      intentId: "tab-defi",
      owner: owner,
      authority: .tabApplicability(revision: 3),
      intent: .selectTab(tabId: "defi")
    )
    try expect(first.isValid(against: current))
    try expect(second.isValid(against: current))

    let staleShell = HomeContainerProtocolV3Intent(
      protocolVersion: 3,
      intentId: "stale-shell",
      owner: owner,
      authority: .shellCommands(revision: 1),
      intent: .action(commandId: "send", itemId: nil)
    )
    try expect(!staleShell.isValid(against: current))

    let unknownAuthority = Data(
      """
      {"protocolVersion":3,"intentId":"unknown","owner":{"scopeKey":"wallet-1:account-1:all","sessionId":"session-1"},"authority":{"kind":"globalRevision","revision":1},"intent":{"kind":"selectTab","tabId":"portfolio"}}
      """.utf8
    )
    do {
      _ = try decoder.decode(
        HomeContainerProtocolV3Intent.self,
        from: unknownAuthority
      )
      throw ContractError.expectedDecodeFailure
    } catch ContractError.expectedDecodeFailure {
      throw ContractError.expectedDecodeFailure
    } catch {
      return
    }
  }

  private static func applied(
    _ outcome: HomeContainerProtocolV3ApplyOutcome
  ) throws -> HomeContainerProtocolV3State {
    guard case .applied(let state) = outcome else {
      throw ContractError.expectedApplied
    }
    return state
  }

  private static func expectNeedSnapshot(
    _ outcome: HomeContainerProtocolV3ApplyOutcome,
    reason expected: HomeContainerProtocolV3NeedSnapshotReason
  ) throws {
    guard case .needSnapshot(let reason) = outcome, reason == expected else {
      throw ContractError.expectedNeedSnapshot
    }
  }

  private static func expect(_ condition: @autoclosure () -> Bool) throws {
    guard condition() else { throw ContractError.failedExpectation }
  }

  private enum ContractError: Error {
    case expectedApplied
    case expectedDecodeFailure
    case expectedNeedSnapshot
    case failedExpectation
    case invalidArguments
  }
}
