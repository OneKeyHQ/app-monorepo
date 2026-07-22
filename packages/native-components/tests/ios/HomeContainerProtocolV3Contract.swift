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

    try verifyMountedSlotRevisionVector(owner: initial.identity.owner)
    try verifySlotAndTransportGaps(patch: patch, current: initial)
    try verifyIntentAuthority(current: next)
    try verifyRapidTabSelectionQueue()
    try verifyExactSectionRevisionKeys(current: next)
  }

  private static func verifyExactSectionRevisionKeys(
    current: HomeContainerProtocolV3State
  ) throws {
    var sections = current.presentationRevisions.sections
    sections["unknown"] = 1
    let presentation = HomeContainerProtocolV3PresentationRevisions(
      shell: current.presentationRevisions.shell,
      navigation: current.presentationRevisions.navigation,
      sections: sections
    )
    try expect(!presentation.isValid)

    var sectionCommands = current.authorityRevisions.sectionCommands
    sectionCommands["unknown"] = 1
    let authority = HomeContainerProtocolV3AuthorityRevisions(
      shellCommands: current.authorityRevisions.shellCommands,
      tabApplicability: current.authorityRevisions.tabApplicability,
      sectionCommands: sectionCommands
    )
    try expect(!authority.isValid)
  }

  private static func verifyRapidTabSelectionQueue() throws {
    var queue = HomeContainerTabSelectionQueue()
    queue.replacePending(
      with: HomeContainerTabSelectionRequest(
        tabId: "perps",
        animated: true,
        notify: true
      )
    )
    queue.replacePending(
      with: HomeContainerTabSelectionRequest(
        tabId: "defi",
        animated: true,
        notify: true
      )
    )
    try expect(queue.takePending()?.tabId == "defi")
    try expect(queue.takePending() == nil)
  }

  private static func verifyMountedSlotRevisionVector(
    owner: HomeContainerProtocolV2Owner
  ) throws {
    let otherOwner = HomeContainerProtocolV2Owner(
      scopeKey: owner.scopeKey,
      sessionId: "other-session"
    )
    let revisions = homeContainerProtocolV3AvailableSlotRevisions(
      owner: owner,
      mountedSlots: [
        HomeContainerProtocolV3MountedSlotMetadata(
          slotId: "header.balance",
          owner: owner,
          slotRevision: 7,
          producedByStoreCommitId: 9
        ),
        HomeContainerProtocolV3MountedSlotMetadata(
          slotId: "header.action-row",
          owner: otherOwner,
          slotRevision: 11,
          producedByStoreCommitId: 9
        ),
        HomeContainerProtocolV3MountedSlotMetadata(
          slotId: "content.state.defi",
          owner: owner,
          slotRevision: -1,
          producedByStoreCommitId: 9
        ),
      ]
    )
    try expect(revisions == ["header.balance": 7])
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

    var regressingSlots = current.slotRevisions
    if let slotId = regressingSlots.keys.first,
      let revision = regressingSlots[slotId]
    {
      regressingSlots[slotId] = revision - 1
    }
    try expectNeedSnapshot(
      HomeContainerProtocolV3Transaction.apply(
        patch: patch,
        current: current,
        availableSlotRevisions: regressingSlots
      ),
      reason: .invalidInvariant
    )

    var unrequiredSlots = current.slotRevisions
    unrequiredSlots["header.action-row"] = 99
    let unrequiredResult = try applied(
      HomeContainerProtocolV3Transaction.apply(
        patch: patch,
        current: current,
        availableSlotRevisions: unrequiredSlots
      )
    )
    try expect(unrequiredResult.slotRevisions["header.action-row"] == nil)

    let regressingAuthority = HomeContainerProtocolV3AuthorityRevisions(
      shellCommands: patch.authorityRevisions.shellCommands,
      tabApplicability: current.authorityRevisions.tabApplicability - 1,
      sectionCommands: patch.authorityRevisions.sectionCommands
    )
    let malformedDuplicate = HomeContainerProtocolV3PatchEnvelope(
      kind: patch.kind,
      protocolVersion: patch.protocolVersion,
      identity: patch.identity,
      baseTransportRevision: current.transportRevision - 1,
      transportRevision: current.transportRevision,
      presentationRevisions: patch.presentationRevisions,
      authorityRevisions: regressingAuthority,
      requiredSlotRevisions: [:],
      changes: patch.changes
    )
    try expectNeedSnapshot(
      HomeContainerProtocolV3Transaction.apply(
        patch: malformedDuplicate,
        current: current,
        availableSlotRevisions: current.slotRevisions
      ),
      reason: .invalidInvariant
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
    guard case .applied(let state, _) = outcome else {
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
