import Foundation

private let homeContainerProtocolV3Version = 3
private let homeContainerProtocolV3SectionIds = [
  "portfolio", "perps", "defi", "nft", "history", "market",
]

func homeContainerHeaderContainsCommand(
  _ header: HomeContainerHeader,
  commandId: String
) -> Bool {
  header.accountActionId == commandId
    || header.copyActionId == commandId
    || header.networkActionId == commandId
    || header.balanceActionId == commandId
    || header.actions.contains(where: { $0.actionId == commandId })
    || (header.balanceActions ?? []).contains(where: { $0.actionId == commandId })
    || header.banners.contains(where: {
      $0.actionId == commandId || $0.dismissActionId == commandId
    })
}

struct HomeContainerProtocolV3Identity: Decodable, Equatable {
  let scopeKey: String
  let sessionId: String
  let storeCommitId: Int

  var owner: HomeContainerProtocolV2Owner {
    HomeContainerProtocolV2Owner(scopeKey: scopeKey, sessionId: sessionId)
  }

  var isValid: Bool {
    owner.isValid && homeContainerIsNonnegativeSafeInteger(storeCommitId)
  }
}

struct HomeContainerProtocolV3PresentationRevisions: Decodable, Equatable {
  let shell: Int
  let navigation: Int
  let sections: [String: Int]

  var isValid: Bool {
    homeContainerIsNonnegativeSafeInteger(shell)
      && homeContainerIsNonnegativeSafeInteger(navigation)
      && Set(sections.keys) == Set(homeContainerProtocolV3SectionIds)
      && homeContainerProtocolV3SectionIds.allSatisfy {
        sections[$0].map(homeContainerIsNonnegativeSafeInteger) == true
      }
  }

  func doesNotRegress(from current: Self) -> Bool {
    shell >= current.shell
      && navigation >= current.navigation
      && homeContainerProtocolV3SectionIds.allSatisfy {
        guard let next = sections[$0], let previous = current.sections[$0] else {
          return false
        }
        return next >= previous
      }
  }
}

struct HomeContainerProtocolV3AuthorityRevisions: Decodable, Equatable {
  let shellCommands: Int
  let tabApplicability: Int
  let sectionCommands: [String: Int]

  var isValid: Bool {
    homeContainerIsNonnegativeSafeInteger(shellCommands)
      && homeContainerIsNonnegativeSafeInteger(tabApplicability)
      && Set(sectionCommands.keys) == Set(homeContainerProtocolV3SectionIds)
      && homeContainerProtocolV3SectionIds.allSatisfy {
        sectionCommands[$0].map(homeContainerIsNonnegativeSafeInteger) == true
      }
  }

  func doesNotRegress(from current: Self) -> Bool {
    shellCommands >= current.shellCommands
      && tabApplicability >= current.tabApplicability
      && homeContainerProtocolV3SectionIds.allSatisfy {
        guard
          let next = sectionCommands[$0],
          let previous = current.sectionCommands[$0]
        else {
          return false
        }
        return next >= previous
      }
  }
}

struct HomeContainerProtocolV3SnapshotEnvelope: Decodable {
  let kind: String
  let protocolVersion: Int
  let identity: HomeContainerProtocolV3Identity
  let transportRevision: Int
  let presentationRevisions: HomeContainerProtocolV3PresentationRevisions
  let authorityRevisions: HomeContainerProtocolV3AuthorityRevisions
  let slotRevisions: [String: Int]
  let payload: HomeContainerProtocolV2SnapshotPayload
}

struct HomeContainerProtocolV3PatchEnvelope: Decodable {
  let kind: String
  let protocolVersion: Int
  let identity: HomeContainerProtocolV3Identity
  let baseTransportRevision: Int
  let transportRevision: Int
  let presentationRevisions: HomeContainerProtocolV3PresentationRevisions
  let authorityRevisions: HomeContainerProtocolV3AuthorityRevisions
  let requiredSlotRevisions: [String: Int]
  let changes: [HomeContainerProtocolV2Change]
}

struct HomeContainerProtocolV3State {
  let identity: HomeContainerProtocolV3Identity
  let transportRevision: Int
  let presentationRevisions: HomeContainerProtocolV3PresentationRevisions
  let authorityRevisions: HomeContainerProtocolV3AuthorityRevisions
  let slotRevisions: [String: Int]
  let legacyState: HomeContainerProtocolV2State

  var snapshot: HomeContainerSnapshot { legacyState.snapshot }
}

struct HomeContainerProtocolV3MountedSlotMetadata: Equatable {
  let slotId: String
  let owner: HomeContainerProtocolV2Owner
  let slotRevision: Int
  let producedByStoreCommitId: Int

  var isValid: Bool {
    !slotId.isEmpty
      && owner.isValid
      && homeContainerIsNonnegativeSafeInteger(slotRevision)
      && homeContainerIsNonnegativeSafeInteger(producedByStoreCommitId)
  }
}

func homeContainerProtocolV3AvailableSlotRevisions(
  owner: HomeContainerProtocolV2Owner,
  mountedSlots: [HomeContainerProtocolV3MountedSlotMetadata]
) -> [String: Int] {
  let matchingSlots = mountedSlots.filter { $0.isValid && $0.owner == owner }
  let slotsById = Dictionary(grouping: matchingSlots, by: \.slotId)
  return slotsById.reduce(into: [:]) { result, entry in
    guard entry.value.count == 1, let slot = entry.value.first else { return }
    result[entry.key] = slot.slotRevision
  }
}

enum HomeContainerProtocolV3NeedSnapshotReason: String, Equatable {
  case invalidInvariant
  case ownerMismatch
  case revisionGap
  case slotRevisionGap
  case unsupportedProtocol
}

enum HomeContainerProtocolV3ApplyOutcome {
  case applied(HomeContainerProtocolV3State, HomeContainerProtocolV2RenderPlan)
  case duplicate(HomeContainerProtocolV3State)
  case needSnapshot(HomeContainerProtocolV3NeedSnapshotReason)
}

enum HomeContainerProtocolV3IntentAuthority: Codable, Equatable {
  case shellCommands(revision: Int)
  case tabApplicability(revision: Int)
  case sectionCommands(sectionId: String, revision: Int)

  private enum CodingKeys: String, CodingKey {
    case kind
    case revision
    case sectionId
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    let kind = try container.decode(String.self, forKey: .kind)
    let revision = try container.decode(Int.self, forKey: .revision)
    guard homeContainerIsNonnegativeSafeInteger(revision) else {
      throw DecodingError.dataCorruptedError(
        forKey: .revision,
        in: container,
        debugDescription: "Authority revision must be a nonnegative safe integer"
      )
    }
    switch kind {
    case "shellCommands":
      self = .shellCommands(revision: revision)
    case "tabApplicability":
      self = .tabApplicability(revision: revision)
    case "sectionCommands":
      let sectionId = try container.decode(String.self, forKey: .sectionId)
      guard homeContainerProtocolV3SectionIds.contains(sectionId) else {
        throw DecodingError.dataCorruptedError(
          forKey: .sectionId,
          in: container,
          debugDescription: "Unknown Home section authority"
        )
      }
      self = .sectionCommands(sectionId: sectionId, revision: revision)
    default:
      throw DecodingError.dataCorruptedError(
        forKey: .kind,
        in: container,
        debugDescription: "Unknown Home intent authority"
      )
    }
  }

  func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    switch self {
    case .shellCommands(let revision):
      try container.encode("shellCommands", forKey: .kind)
      try container.encode(revision, forKey: .revision)
    case .tabApplicability(let revision):
      try container.encode("tabApplicability", forKey: .kind)
      try container.encode(revision, forKey: .revision)
    case .sectionCommands(let sectionId, let revision):
      try container.encode("sectionCommands", forKey: .kind)
      try container.encode(sectionId, forKey: .sectionId)
      try container.encode(revision, forKey: .revision)
    }
  }
}

enum HomeContainerProtocolV3IntentPayload: Codable, Equatable {
  case action(commandId: String, itemId: String?)
  case handoff(tabId: String, commandId: String)
  case refresh(tabId: String, requestId: String)
  case selectTab(tabId: String)

  private enum CodingKeys: String, CodingKey {
    case kind
    case commandId
    case itemId
    case tabId
    case requestId
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    switch try container.decode(String.self, forKey: .kind) {
    case "action":
      self = .action(
        commandId: try container.decode(String.self, forKey: .commandId),
        itemId: try container.decodeIfPresent(String.self, forKey: .itemId)
      )
    case "handoff":
      self = .handoff(
        tabId: try container.decode(String.self, forKey: .tabId),
        commandId: try container.decode(String.self, forKey: .commandId)
      )
    case "refresh":
      self = .refresh(
        tabId: try container.decode(String.self, forKey: .tabId),
        requestId: try container.decode(String.self, forKey: .requestId)
      )
    case "selectTab":
      self = .selectTab(tabId: try container.decode(String.self, forKey: .tabId))
    default:
      throw DecodingError.dataCorruptedError(
        forKey: .kind,
        in: container,
        debugDescription: "Unknown Home intent kind"
      )
    }
  }

  func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    switch self {
    case .action(let commandId, let itemId):
      try container.encode("action", forKey: .kind)
      try container.encode(commandId, forKey: .commandId)
      try container.encodeIfPresent(itemId, forKey: .itemId)
    case .handoff(let tabId, let commandId):
      try container.encode("handoff", forKey: .kind)
      try container.encode(tabId, forKey: .tabId)
      try container.encode(commandId, forKey: .commandId)
    case .refresh(let tabId, let requestId):
      try container.encode("refresh", forKey: .kind)
      try container.encode(tabId, forKey: .tabId)
      try container.encode(requestId, forKey: .requestId)
    case .selectTab(let tabId):
      try container.encode("selectTab", forKey: .kind)
      try container.encode(tabId, forKey: .tabId)
    }
  }
}

struct HomeContainerProtocolV3Intent: Codable, Equatable {
  let protocolVersion: Int
  let intentId: String
  let owner: HomeContainerProtocolV2Owner
  let authority: HomeContainerProtocolV3IntentAuthority
  let intent: HomeContainerProtocolV3IntentPayload

  func isValid(against state: HomeContainerProtocolV3State) -> Bool {
    guard protocolVersion == homeContainerProtocolV3Version,
      !intentId.isEmpty,
      owner == state.identity.owner
    else {
      return false
    }
    switch (authority, intent) {
    case let (.shellCommands(revision), .action(commandId, _)):
      return !commandId.isEmpty
        && revision == state.authorityRevisions.shellCommands
    case let (
      .sectionCommands(sectionId, revision),
      .action(commandId, _)
    ):
      return !commandId.isEmpty
        && revision == state.authorityRevisions.sectionCommands[sectionId]
    case let (.tabApplicability(revision), .selectTab(tabId)):
      return !tabId.isEmpty
        && revision == state.authorityRevisions.tabApplicability
    case let (.tabApplicability(revision), .handoff(tabId, commandId)):
      return !tabId.isEmpty && !commandId.isEmpty
        && revision == state.authorityRevisions.tabApplicability
    case let (
      .sectionCommands(sectionId, revision),
      .refresh(tabId, requestId)
    ):
      return sectionId == tabId && !requestId.isEmpty
        && revision == state.authorityRevisions.sectionCommands[sectionId]
    default:
      return false
    }
  }
}

enum HomeContainerProtocolV3Transaction {
  static func apply(
    snapshot envelope: HomeContainerProtocolV3SnapshotEnvelope
  ) -> HomeContainerProtocolV3ApplyOutcome {
    guard envelope.protocolVersion == homeContainerProtocolV3Version else {
      return .needSnapshot(.unsupportedProtocol)
    }
    guard envelope.kind == "snapshot",
      envelope.identity.isValid,
      homeContainerIsNonnegativeSafeInteger(envelope.transportRevision),
      envelope.presentationRevisions.isValid,
      envelope.authorityRevisions.isValid,
      revisionsAreValid(envelope.slotRevisions)
    else {
      return .needSnapshot(.invalidInvariant)
    }
    let legacyEnvelope = HomeContainerProtocolV2SnapshotEnvelope(
      kind: "snapshot",
      protocolVersion: homeContainerProtocolVersion,
      schemaVersion: homeContainerBusinessSchemaVersion,
      owner: envelope.identity.owner,
      revision: envelope.transportRevision,
      payload: envelope.payload
    )
    switch HomeContainerProtocolV2Transaction.apply(
      snapshot: legacyEnvelope,
      current: nil
    ) {
    case .applied(let legacyState, let renderPlan):
      return .applied(
        HomeContainerProtocolV3State(
          identity: envelope.identity,
          transportRevision: envelope.transportRevision,
          presentationRevisions: envelope.presentationRevisions,
          authorityRevisions: envelope.authorityRevisions,
          slotRevisions: envelope.slotRevisions,
          legacyState: legacyState
        ),
        renderPlan
      )
    case .duplicate:
      return .needSnapshot(.invalidInvariant)
    case .needSnapshot:
      return .needSnapshot(.invalidInvariant)
    }
  }

  static func apply(
    patch: HomeContainerProtocolV3PatchEnvelope,
    current: HomeContainerProtocolV3State?,
    availableSlotRevisions: [String: Int]
  ) -> HomeContainerProtocolV3ApplyOutcome {
    guard patch.protocolVersion == homeContainerProtocolV3Version else {
      return .needSnapshot(.unsupportedProtocol)
    }
    guard let current else {
      return .needSnapshot(.revisionGap)
    }
    guard patch.identity.owner == current.identity.owner else {
      return .needSnapshot(.ownerMismatch)
    }
    guard patch.kind == "patch",
      patch.identity.isValid,
      patch.identity.storeCommitId >= current.identity.storeCommitId,
      homeContainerIsNonnegativeSafeInteger(patch.baseTransportRevision),
      homeContainerIsNonnegativeSafeInteger(patch.transportRevision),
      patch.presentationRevisions.isValid,
      patch.authorityRevisions.isValid,
      patch.presentationRevisions.doesNotRegress(
        from: current.presentationRevisions
      ),
      patch.authorityRevisions.doesNotRegress(from: current.authorityRevisions),
      revisionsAreValid(patch.requiredSlotRevisions)
    else {
      return .needSnapshot(.invalidInvariant)
    }
    if patch.transportRevision == current.transportRevision,
      patch.baseTransportRevision < patch.transportRevision
    {
      return .duplicate(current)
    }
    guard patch.baseTransportRevision == current.transportRevision,
      patch.transportRevision == current.transportRevision + 1
    else {
      return .needSnapshot(.revisionGap)
    }
    guard patch.requiredSlotRevisions.allSatisfy({ key, revision in
      availableSlotRevisions[key] == revision
    }) else {
      return .needSnapshot(.slotRevisionGap)
    }
    guard availableSlotRevisions.allSatisfy({ key, revision in
      current.slotRevisions[key].map { revision >= $0 } ?? true
    }) else {
      return .needSnapshot(.invalidInvariant)
    }
    let legacyPatch = HomeContainerProtocolV2PatchEnvelope(
      kind: "patch",
      protocolVersion: homeContainerProtocolVersion,
      schemaVersion: homeContainerBusinessSchemaVersion,
      owner: patch.identity.owner,
      baseRevision: patch.baseTransportRevision,
      revision: patch.transportRevision,
      changes: patch.changes
    )
    switch HomeContainerProtocolV2Transaction.apply(
      patch: legacyPatch,
      current: current.legacyState
    ) {
    case .applied(let legacyState, let renderPlan):
      return .applied(
        HomeContainerProtocolV3State(
          identity: patch.identity,
          transportRevision: patch.transportRevision,
          presentationRevisions: patch.presentationRevisions,
          authorityRevisions: patch.authorityRevisions,
          slotRevisions: patch.requiredSlotRevisions.merging(
            current.slotRevisions,
            uniquingKeysWith: { required, _ in required }
          ),
          legacyState: legacyState
        ),
        renderPlan
      )
    case .duplicate:
      return .duplicate(current)
    case .needSnapshot(_, _, let reason):
      return .needSnapshot(
        reason == .ownerMismatch ? .ownerMismatch
          : reason == .revisionGap ? .revisionGap : .invalidInvariant
      )
    }
  }

  private static func revisionsAreValid(_ revisions: [String: Int]) -> Bool {
    revisions.values.allSatisfy(homeContainerIsNonnegativeSafeInteger)
  }
}
