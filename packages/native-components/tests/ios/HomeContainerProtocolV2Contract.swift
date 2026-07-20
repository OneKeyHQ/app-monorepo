import Foundation

@main
enum HomeContainerProtocolV2Contract {
  private static let decoder = JSONDecoder()
  private static let fixtureArguments: [String: Data] = {
    guard CommandLine.arguments.count == 3 else { return [:] }
    return [
      "home-container-v2.snapshot.json": Data(CommandLine.arguments[1].utf8),
      "home-container-v2.patch.json": Data(CommandLine.arguments[2].utf8),
    ]
  }()

  static func main() throws {
    try verifyCanonicalFixturesApplyAsOneOwnerScopedTransaction()
    try verifyInvalidSelectedTabRequiresSnapshotInsteadOfFallingBack()
    try verifyPatchRejectsOwnerMismatchAndRevisionGapWithoutMutation()
    try verifyReplaceSectionUsesStableIdAndExplicitIndex()
    try verifyInvalidLateChangeDoesNotCommitEarlierChanges()
    try verifyDuplicateSnapshotAcknowledgesWithoutReapplying()
    try verifyEmptyOwnerAndContentIdentifiersAreRejectedWithoutMutation()
    try verifyUnsafeIntegersAreRejectedWithoutMutation()
    try verifyStringAndFractionalNumbersAreDecodeRejections()
  }

  private static func verifyCanonicalFixturesApplyAsOneOwnerScopedTransaction() throws {
    let snapshotEnvelope = try decoder.decode(
      HomeContainerProtocolV2SnapshotEnvelope.self,
      from: fixtureData("home-container-v2.snapshot.json")
    )
    let initialState = try appliedState(
      HomeContainerProtocolV2Transaction.apply(
        snapshot: snapshotEnvelope,
        current: nil
      )
    )
    try expect(initialState.owner.scopeKey == "wallet-1:account-1:all")
    try expect(initialState.owner.sessionId == "session-1")
    try expect(initialState.revision == 7)

    let patchEnvelope = try decoder.decode(
      HomeContainerProtocolV2PatchEnvelope.self,
      from: fixtureData("home-container-v2.patch.json")
    )
    let patchedState = try appliedState(
      HomeContainerProtocolV2Transaction.apply(
        patch: patchEnvelope,
        current: initialState
      )
    )

    try expect(patchedState.revision == 8)
    try expect(patchedState.snapshot.selectedTabId == "history")
    try expect(patchedState.snapshot.header.balance == "$101.00")
    try expect(
      patchedState.snapshot.tabs
        .first(where: { $0.id == "portfolio" })?
        .sections.first?.id == "tokens"
    )
    try expect(
      patchedState.snapshot.tabs
        .first(where: { $0.id == "history" })?
        .sections.first?.items.first?.id == "transfer-1"
    )
  }

  private static func verifyInvalidSelectedTabRequiresSnapshotInsteadOfFallingBack() throws {
    let envelope = try decoder.decode(
      HomeContainerProtocolV2SnapshotEnvelope.self,
      from: fixtureData("home-container-v2.snapshot.json")
    )
    let invalidEnvelope = HomeContainerProtocolV2SnapshotEnvelope(
      kind: envelope.kind,
      protocolVersion: envelope.protocolVersion,
      schemaVersion: envelope.schemaVersion,
      owner: envelope.owner,
      revision: envelope.revision,
      payload: HomeContainerProtocolV2SnapshotPayload(
        selectedTabId: "missing",
        header: envelope.payload.header,
        tabs: envelope.payload.tabs,
        theme: envelope.payload.theme
      )
    )

    try expectNeedSnapshot(
      HomeContainerProtocolV2Transaction.apply(
        snapshot: invalidEnvelope,
        current: nil
      ),
      reason: .invalidInvariant
    )
  }

  private static func verifyPatchRejectsOwnerMismatchAndRevisionGapWithoutMutation() throws {
    let snapshotEnvelope = try decoder.decode(
      HomeContainerProtocolV2SnapshotEnvelope.self,
      from: fixtureData("home-container-v2.snapshot.json")
    )
    let initialState = try appliedState(
      HomeContainerProtocolV2Transaction.apply(
        snapshot: snapshotEnvelope,
        current: nil
      )
    )
    let patch = try decoder.decode(
      HomeContainerProtocolV2PatchEnvelope.self,
      from: fixtureData("home-container-v2.patch.json")
    )
    let wrongOwnerPatch = HomeContainerProtocolV2PatchEnvelope(
      kind: patch.kind,
      protocolVersion: patch.protocolVersion,
      schemaVersion: patch.schemaVersion,
      owner: HomeContainerProtocolV2Owner(
        scopeKey: patch.owner.scopeKey,
        sessionId: "other-session"
      ),
      baseRevision: patch.baseRevision,
      revision: patch.revision,
      changes: patch.changes
    )
    try expectNeedSnapshot(
      HomeContainerProtocolV2Transaction.apply(
        patch: wrongOwnerPatch,
        current: initialState
      ),
      reason: .ownerMismatch
    )

    let gapPatch = HomeContainerProtocolV2PatchEnvelope(
      kind: patch.kind,
      protocolVersion: patch.protocolVersion,
      schemaVersion: patch.schemaVersion,
      owner: patch.owner,
      baseRevision: patch.baseRevision + 1,
      revision: patch.revision + 1,
      changes: patch.changes
    )
    try expectNeedSnapshot(
      HomeContainerProtocolV2Transaction.apply(
        patch: gapPatch,
        current: initialState
      ),
      reason: .revisionGap
    )
    try expect(initialState.snapshot.revision == 7)
  }

  private static func verifyReplaceSectionUsesStableIdAndExplicitIndex() throws {
    let snapshotEnvelope = try decoder.decode(
      HomeContainerProtocolV2SnapshotEnvelope.self,
      from: fixtureData("home-container-v2.snapshot.json")
    )
    let initialState = try appliedState(
      HomeContainerProtocolV2Transaction.apply(
        snapshot: snapshotEnvelope,
        current: nil
      )
    )
    guard let original = initialState.snapshot.tabs.first?.sections.first else {
      throw ContractError.failedExpectation
    }
    let movedPatch = HomeContainerProtocolV2PatchEnvelope(
      kind: "patch",
      protocolVersion: 2,
      schemaVersion: 1,
      owner: initialState.owner,
      baseRevision: 7,
      revision: 8,
      changes: [
        .replaceSection(
          tabId: "portfolio",
          sectionId: "tokens",
          index: 0,
          value: original
        )
      ]
    )
    let nextState = try appliedState(
      HomeContainerProtocolV2Transaction.apply(
        patch: movedPatch,
        current: initialState
      )
    )
    try expect(nextState.snapshot.tabs.first?.sections.map { $0.id } == ["tokens"])
  }

  private static func verifyInvalidLateChangeDoesNotCommitEarlierChanges() throws {
    let snapshotEnvelope = try decoder.decode(
      HomeContainerProtocolV2SnapshotEnvelope.self,
      from: fixtureData("home-container-v2.snapshot.json")
    )
    let initialState = try appliedState(
      HomeContainerProtocolV2Transaction.apply(
        snapshot: snapshotEnvelope,
        current: nil
      )
    )
    let canonicalPatch = try decoder.decode(
      HomeContainerProtocolV2PatchEnvelope.self,
      from: fixtureData("home-container-v2.patch.json")
    )
    guard
      case .replaceShell(let changedHeader) = canonicalPatch.changes.first,
      let originalSection = initialState.snapshot.tabs.first?.sections.first
    else {
      throw ContractError.failedExpectation
    }
    let invalidPatch = HomeContainerProtocolV2PatchEnvelope(
      kind: "patch",
      protocolVersion: 2,
      schemaVersion: 1,
      owner: initialState.owner,
      baseRevision: 7,
      revision: 8,
      changes: [
        .replaceShell(changedHeader),
        .replaceSection(
          tabId: "portfolio",
          sectionId: originalSection.id,
          index: 99,
          value: originalSection
        ),
      ]
    )

    try expectNeedSnapshot(
      HomeContainerProtocolV2Transaction.apply(
        patch: invalidPatch,
        current: initialState
      ),
      reason: .invalidInvariant
    )
    try expect(initialState.snapshot.header.balance == "$100.00")
    try expect(initialState.snapshot.revision == 7)
  }

  private static func verifyDuplicateSnapshotAcknowledgesWithoutReapplying() throws {
    let envelope = try decoder.decode(
      HomeContainerProtocolV2SnapshotEnvelope.self,
      from: fixtureData("home-container-v2.snapshot.json")
    )
    let initialState = try appliedState(
      HomeContainerProtocolV2Transaction.apply(
        snapshot: envelope,
        current: nil
      )
    )
    guard
      case .duplicate(let owner, let revision) = HomeContainerProtocolV2Transaction.apply(
        snapshot: envelope,
        current: initialState
      )
    else {
      throw ContractError.expectedDuplicate
    }
    try expect(owner == initialState.owner)
    try expect(revision == initialState.revision)
  }

  private static func verifyEmptyOwnerAndContentIdentifiersAreRejectedWithoutMutation() throws {
    let canonicalSnapshotData = try fixtureData("home-container-v2.snapshot.json")
    let canonicalEnvelope = try decoder.decode(
      HomeContainerProtocolV2SnapshotEnvelope.self,
      from: canonicalSnapshotData
    )
    let initialState = try appliedState(
      HomeContainerProtocolV2Transaction.apply(
        snapshot: canonicalEnvelope,
        current: nil
      )
    )

    for ownerKey in ["scopeKey", "sessionId"] {
      let data = try mutatedFixtureData("home-container-v2.snapshot.json") { root in
        let owner = try mutableDictionary(root["owner"])
        owner[ownerKey] = ""
      }
      let envelope = try decoder.decode(HomeContainerProtocolV2SnapshotEnvelope.self, from: data)
      try expectNeedSnapshot(
        HomeContainerProtocolV2Transaction.apply(snapshot: envelope, current: initialState),
        reason: .invalidInvariant
      )
      try expectUnchanged(initialState)
    }

    let emptyTabData = try mutatedFixtureData("home-container-v2.snapshot.json") { root in
      let payload = try mutableDictionary(root["payload"])
      let tabs = try mutableArray(payload["tabs"])
      let firstTab = try mutableDictionary(tabs.firstObject)
      firstTab["id"] = ""
      payload["selectedTabId"] = ""
    }
    let emptyTabEnvelope = try decoder.decode(
      HomeContainerProtocolV2SnapshotEnvelope.self,
      from: emptyTabData
    )
    try expectNeedSnapshot(
      HomeContainerProtocolV2Transaction.apply(snapshot: emptyTabEnvelope, current: initialState),
      reason: .invalidInvariant
    )
    try expectUnchanged(initialState)

    let emptySectionData = try mutatedFixtureData("home-container-v2.snapshot.json") { root in
      let payload = try mutableDictionary(root["payload"])
      let tabs = try mutableArray(payload["tabs"])
      let firstTab = try mutableDictionary(tabs.firstObject)
      let sections = try mutableArray(firstTab["sections"])
      let firstSection = try mutableDictionary(sections.firstObject)
      firstSection["id"] = ""
    }
    let emptySectionEnvelope = try decoder.decode(
      HomeContainerProtocolV2SnapshotEnvelope.self,
      from: emptySectionData
    )
    try expectNeedSnapshot(
      HomeContainerProtocolV2Transaction.apply(
        snapshot: emptySectionEnvelope,
        current: initialState
      ),
      reason: .invalidInvariant
    )
    try expectUnchanged(initialState)

    let emptyPatchOwnerData = try mutatedFixtureData("home-container-v2.patch.json") { root in
      let owner = try mutableDictionary(root["owner"])
      owner["sessionId"] = ""
    }
    let emptyPatchOwner = try decoder.decode(
      HomeContainerProtocolV2PatchEnvelope.self,
      from: emptyPatchOwnerData
    )
    try expectNeedSnapshot(
      HomeContainerProtocolV2Transaction.apply(patch: emptyPatchOwner, current: initialState),
      reason: .invalidInvariant
    )
    try expectUnchanged(initialState)

    let emptyChangeIdentifiers = HomeContainerProtocolV2PatchEnvelope(
      kind: "patch",
      protocolVersion: 2,
      schemaVersion: 1,
      owner: initialState.owner,
      baseRevision: initialState.revision,
      revision: initialState.revision + 1,
      changes: [
        .removeSection(tabId: "", sectionId: "tokens"),
        .removeSection(tabId: "portfolio", sectionId: ""),
      ]
    )
    try expectNeedSnapshot(
      HomeContainerProtocolV2Transaction.apply(
        patch: emptyChangeIdentifiers,
        current: initialState
      ),
      reason: .invalidInvariant
    )
    try expectUnchanged(initialState)
  }

  private static func verifyUnsafeIntegersAreRejectedWithoutMutation() throws {
    let initialEnvelope = try decoder.decode(
      HomeContainerProtocolV2SnapshotEnvelope.self,
      from: fixtureData("home-container-v2.snapshot.json")
    )
    let initialState = try appliedState(
      HomeContainerProtocolV2Transaction.apply(snapshot: initialEnvelope, current: nil)
    )
    let unsafeInteger = 9_007_199_254_740_992

    for key in ["protocolVersion", "schemaVersion", "revision"] {
      let data = try mutatedFixtureData("home-container-v2.snapshot.json") { root in
        root[key] = unsafeInteger
      }
      let envelope = try decoder.decode(HomeContainerProtocolV2SnapshotEnvelope.self, from: data)
      try expectNeedSnapshot(
        HomeContainerProtocolV2Transaction.apply(snapshot: envelope, current: initialState),
        reason: .invalidInvariant
      )
      try expectUnchanged(initialState)
    }

    for key in ["protocolVersion", "schemaVersion", "baseRevision", "revision"] {
      let data = try mutatedFixtureData("home-container-v2.patch.json") { root in
        root[key] = unsafeInteger
      }
      let envelope = try decoder.decode(HomeContainerProtocolV2PatchEnvelope.self, from: data)
      try expectNeedSnapshot(
        HomeContainerProtocolV2Transaction.apply(patch: envelope, current: initialState),
        reason: .invalidInvariant
      )
      try expectUnchanged(initialState)
    }

    let unsafeIndexData = try mutatedFixtureData("home-container-v2.patch.json") { root in
      let changes = try mutableArray(root["changes"])
      let replaceSection = try mutableDictionary(changes[2])
      replaceSection["index"] = unsafeInteger
    }
    let unsafeIndexPatch = try decoder.decode(
      HomeContainerProtocolV2PatchEnvelope.self,
      from: unsafeIndexData
    )
    try expectNeedSnapshot(
      HomeContainerProtocolV2Transaction.apply(patch: unsafeIndexPatch, current: initialState),
      reason: .invalidInvariant
    )
    try expectUnchanged(initialState)
  }

  private static func verifyStringAndFractionalNumbersAreDecodeRejections() throws {
    let invalidSnapshotNumbers: [(String, Any)] = [
      ("protocolVersion", "2"),
      ("schemaVersion", "1"),
      ("revision", "7"),
      ("revision", 7.5),
    ]
    for (key, value) in invalidSnapshotNumbers {
      let data = try mutatedFixtureData("home-container-v2.snapshot.json") { root in
        root[key] = value
      }
      try expectDecodeRejected(HomeContainerProtocolV2SnapshotEnvelope.self, from: data)
      let probe = try decoder.decode(HomeContainerTransportProbe.self, from: data)
      try expect(probe.kind == "snapshot")
    }

    let invalidPatchNumbers: [(String, Any)] = [
      ("baseRevision", "7"),
      ("revision", 8.5),
    ]
    for (key, value) in invalidPatchNumbers {
      let data = try mutatedFixtureData("home-container-v2.patch.json") { root in
        root[key] = value
      }
      try expectDecodeRejected(HomeContainerProtocolV2PatchEnvelope.self, from: data)
      let probe = try decoder.decode(HomeContainerTransportProbe.self, from: data)
      try expect(probe.kind == "patch")
    }

    for invalidIndex in ["0" as Any, 0.5 as Any] {
      let data = try mutatedFixtureData("home-container-v2.patch.json") { root in
        let changes = try mutableArray(root["changes"])
        let replaceSection = try mutableDictionary(changes[2])
        replaceSection["index"] = invalidIndex
      }
      try expectDecodeRejected(HomeContainerProtocolV2PatchEnvelope.self, from: data)
      let probe = try decoder.decode(HomeContainerTransportProbe.self, from: data)
      try expect(probe.kind == "patch")
    }
  }

  private static func fixtureData(_ name: String) throws -> Data {
    if let data = fixtureArguments[name] {
      return data
    }
    let fixturesDirectory = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .appendingPathComponent("fixtures", isDirectory: true)
    return try Data(contentsOf: fixturesDirectory.appendingPathComponent(name))
  }

  private static func mutatedFixtureData(
    _ name: String,
    mutate: (NSMutableDictionary) throws -> Void
  ) throws -> Data {
    let object = try JSONSerialization.jsonObject(
      with: fixtureData(name),
      options: [.mutableContainers]
    )
    let root = try mutableDictionary(object)
    try mutate(root)
    return try JSONSerialization.data(withJSONObject: root)
  }

  private static func mutableDictionary(_ value: Any?) throws -> NSMutableDictionary {
    guard let dictionary = value as? NSMutableDictionary else {
      throw ContractError.invalidFixture
    }
    return dictionary
  }

  private static func mutableArray(_ value: Any?) throws -> NSMutableArray {
    guard let array = value as? NSMutableArray else {
      throw ContractError.invalidFixture
    }
    return array
  }

  private static func expectDecodeRejected<T: Decodable>(
    _ type: T.Type,
    from data: Data
  ) throws {
    do {
      _ = try decoder.decode(type, from: data)
      throw ContractError.expectedDecodeRejection
    } catch ContractError.expectedDecodeRejection {
      throw ContractError.expectedDecodeRejection
    } catch {
      return
    }
  }

  private static func expectUnchanged(_ state: HomeContainerProtocolV2State) throws {
    try expect(state.revision == 7)
    try expect(state.snapshot.revision == 7)
    try expect(state.snapshot.header.balance == "$100.00")
    try expect(state.snapshot.tabs.first?.sections.first?.id == "tokens")
  }

  private static func appliedState(
    _ outcome: HomeContainerProtocolV2ApplyOutcome
  ) throws -> HomeContainerProtocolV2State {
    guard case .applied(let state) = outcome else {
      throw ContractError.expectedApplied
    }
    return state
  }

  private static func expectNeedSnapshot(
    _ outcome: HomeContainerProtocolV2ApplyOutcome,
    reason expectedReason: HomeContainerProtocolV2NeedSnapshotReason
  ) throws {
    guard case .needSnapshot(_, _, let reason) = outcome,
      reason == expectedReason
    else {
      throw ContractError.expectedNeedSnapshot
    }
  }

  private static func expect(_ condition: @autoclosure () -> Bool) throws {
    guard condition() else { throw ContractError.failedExpectation }
  }

  private enum ContractError: Error {
    case expectedApplied
    case expectedNeedSnapshot
    case expectedDuplicate
    case expectedDecodeRejection
    case failedExpectation
    case invalidFixture
  }
}
