import Foundation

private let homeContainerProtocolV3Version = 3
private let homeContainerProtocolV3TabIds = [
  "portfolio", "perps", "defi", "nft", "history",
]
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

struct HomeContainerProtocolV3Identity: Codable, Equatable {
  let scopeKey: String
  let sessionId: String
  let storeCommitId: Int

  var owner: HomeContainerOwner {
    HomeContainerOwner(scopeKey: scopeKey, sessionId: sessionId)
  }

  var isValid: Bool {
    owner.isValid && homeContainerIsNonnegativeSafeInteger(storeCommitId)
  }
}

struct HomeContainerProtocolV3PresentationRevisions: Codable, Equatable {
  let shell: Int
  let navigation: Int
  let surface: Int
  let sections: [String: Int]

  var isValid: Bool {
    homeContainerIsNonnegativeSafeInteger(shell)
      && homeContainerIsNonnegativeSafeInteger(navigation)
      && homeContainerIsNonnegativeSafeInteger(surface)
      && Set(sections.keys) == Set(homeContainerProtocolV3TabIds)
      && sections.values.allSatisfy(homeContainerIsNonnegativeSafeInteger)
  }
}

struct HomeContainerProtocolV3AuthorityRevisions: Codable, Equatable {
  let shellCommands: Int
  let tabApplicability: Int
  let sectionCommands: [String: Int]

  var isValid: Bool {
    homeContainerIsNonnegativeSafeInteger(shellCommands)
      && homeContainerIsNonnegativeSafeInteger(tabApplicability)
      && Set(sectionCommands.keys) == Set(homeContainerProtocolV3SectionIds)
      && sectionCommands.values.allSatisfy(homeContainerIsNonnegativeSafeInteger)
  }
}

struct HomeContainerProtocolV3SnapshotEnvelope: Decodable {
  let kind: String
  let protocolVersion: Int
  let identity: HomeContainerProtocolV3Identity
  let presentationRevisions: HomeContainerProtocolV3PresentationRevisions
  let authorityRevisions: HomeContainerProtocolV3AuthorityRevisions
  let payload: HomeContainerSnapshotPayload
}

struct HomeContainerProtocolV3Navigation: Decodable {
  let selectedTabId: String
  let tabs: [HomeContainerNavigationTab]
}

enum HomeContainerProtocolV3DomainUpdate: Decodable {
  case shell(
    presentationRevision: Int,
    commandRevision: Int,
    value: HomeContainerHeader
  )
  case navigation(
    presentationRevision: Int,
    applicabilityRevision: Int,
    value: HomeContainerProtocolV3Navigation
  )
  case section(
    tabId: String,
    presentationRevision: Int,
    commandRevisions: [String: Int],
    value: [HomeContainerSection]
  )
  case surface(presentationRevision: Int, value: HomeContainerTheme)

  private enum CodingKeys: String, CodingKey {
    case kind
    case tabId
    case presentationRevision
    case commandRevision
    case commandRevisions
    case applicabilityRevision
    case value
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    switch try container.decode(String.self, forKey: .kind) {
    case "shell":
      self = .shell(
        presentationRevision: try container.decode(Int.self, forKey: .presentationRevision),
        commandRevision: try container.decode(Int.self, forKey: .commandRevision),
        value: try container.decode(HomeContainerHeader.self, forKey: .value)
      )
    case "navigation":
      self = .navigation(
        presentationRevision: try container.decode(Int.self, forKey: .presentationRevision),
        applicabilityRevision: try container.decode(Int.self, forKey: .applicabilityRevision),
        value: try container.decode(HomeContainerProtocolV3Navigation.self, forKey: .value)
      )
    case "section":
      self = .section(
        tabId: try container.decode(String.self, forKey: .tabId),
        presentationRevision: try container.decode(Int.self, forKey: .presentationRevision),
        commandRevisions: try container.decode([String: Int].self, forKey: .commandRevisions),
        value: try container.decode([HomeContainerSection].self, forKey: .value)
      )
    case "surface":
      self = .surface(
        presentationRevision: try container.decode(Int.self, forKey: .presentationRevision),
        value: try container.decode(HomeContainerTheme.self, forKey: .value)
      )
    default:
      throw DecodingError.dataCorruptedError(
        forKey: .kind,
        in: container,
        debugDescription: "Unknown HomeContainer domain"
      )
    }
  }

  var domainKey: String {
    switch self {
    case .shell:
      return "shell"
    case .navigation:
      return "navigation"
    case .section(let tabId, _, _, _):
      return "section:\(tabId)"
    case .surface:
      return "surface"
    }
  }
}

struct HomeContainerProtocolV3DomainBatch: Decodable {
  let kind: String
  let protocolVersion: Int
  let identity: HomeContainerProtocolV3Identity
  let updates: [HomeContainerProtocolV3DomainUpdate]
}

struct HomeContainerProtocolV3State {
  let identity: HomeContainerProtocolV3Identity
  let presentationRevisions: HomeContainerProtocolV3PresentationRevisions
  let authorityRevisions: HomeContainerProtocolV3AuthorityRevisions
  let snapshot: HomeContainerSnapshot
}

struct HomeContainerRenderPlan: Equatable {
  let isFullSnapshot: Bool
  let shouldBindHeader: Bool
  let shouldReconcileNavigation: Bool
  let sectionTabIds: Set<String>
  let shouldApplySurface: Bool

  static let fullSnapshot = HomeContainerRenderPlan(
    isFullSnapshot: true,
    shouldBindHeader: true,
    shouldReconcileNavigation: true,
    sectionTabIds: [],
    shouldApplySurface: true
  )

  static func domains(_ domains: [String]) -> HomeContainerRenderPlan {
    HomeContainerRenderPlan(
      isFullSnapshot: false,
      shouldBindHeader: domains.contains("shell"),
      shouldReconcileNavigation: domains.contains("navigation"),
      sectionTabIds: Set(domains.compactMap { domain in
        domain.hasPrefix("section:") ? String(domain.dropFirst("section:".count)) : nil
      }),
      shouldApplySurface: domains.contains("surface")
    )
  }
}

enum HomeContainerProtocolV3ApplyOutcome {
  case applied(HomeContainerProtocolV3State, HomeContainerRenderPlan)
  case ignored
  case invalid(String)
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
  let owner: HomeContainerOwner
  let authority: HomeContainerProtocolV3IntentAuthority
  let intent: HomeContainerProtocolV3IntentPayload
}

enum HomeContainerProtocolV3Transaction {
  static func apply(
    snapshot envelope: HomeContainerProtocolV3SnapshotEnvelope,
    current: HomeContainerProtocolV3State? = nil
  ) -> HomeContainerProtocolV3ApplyOutcome {
    guard envelope.protocolVersion == homeContainerProtocolV3Version else {
      return .invalid("unsupported_protocol")
    }
    guard envelope.kind == "snapshot",
      envelope.identity.isValid,
      envelope.presentationRevisions.isValid,
      envelope.authorityRevisions.isValid
    else {
      return .invalid("invalid_snapshot")
    }
    let snapshot = envelope.payload.makeSnapshot(revision: envelope.identity.storeCommitId)
    guard homeContainerValidatesBusinessInvariants(snapshot) else {
      return .invalid("invalid_snapshot")
    }
    if let current, current.identity.owner == envelope.identity.owner {
      let batch = HomeContainerProtocolV3DomainBatch(
        kind: "domains",
        protocolVersion: homeContainerProtocolV3Version,
        identity: envelope.identity,
        updates: snapshotUpdates(envelope)
      )
      return apply(domains: batch, current: current)
    }
    return .applied(
      HomeContainerProtocolV3State(
        identity: envelope.identity,
        presentationRevisions: envelope.presentationRevisions,
        authorityRevisions: envelope.authorityRevisions,
        snapshot: snapshot
      ),
      .fullSnapshot
    )
  }

  static func apply(
    domains batch: HomeContainerProtocolV3DomainBatch,
    current: HomeContainerProtocolV3State?
  ) -> HomeContainerProtocolV3ApplyOutcome {
    guard batch.protocolVersion == homeContainerProtocolV3Version else {
      return .invalid("unsupported_protocol")
    }
    guard batch.kind == "domains", batch.identity.isValid, let current else {
      return .invalid("invalid_domains")
    }
    guard batch.identity.owner == current.identity.owner else {
      return .ignored
    }
    guard Set(batch.updates.map(\.domainKey)).count == batch.updates.count else {
      return .invalid("duplicate_domain")
    }

    var snapshot = current.snapshot
    var presentation = current.presentationRevisions
    var authority = current.authorityRevisions
    var appliedDomains = [String]()

    for update in batch.updates {
      switch update {
      case .shell(let revision, let commandRevision, let value):
        guard valid(revision), valid(commandRevision) else {
          return .invalid("invalid_shell_revision")
        }
        guard revision > presentation.shell else { continue }
        guard commandRevision >= authority.shellCommands else {
          return .invalid("regressed_shell_authority")
        }
        snapshot = replacing(snapshot, header: value)
        presentation = .init(
          shell: revision,
          navigation: presentation.navigation,
          surface: presentation.surface,
          sections: presentation.sections
        )
        authority = .init(
          shellCommands: commandRevision,
          tabApplicability: authority.tabApplicability,
          sectionCommands: authority.sectionCommands
        )
      case .navigation(let revision, let applicabilityRevision, let value):
        guard valid(revision), valid(applicabilityRevision) else {
          return .invalid("invalid_navigation_revision")
        }
        guard revision > presentation.navigation else { continue }
        guard applicabilityRevision >= authority.tabApplicability,
          let next = replacing(snapshot, navigation: value)
        else {
          return .invalid("invalid_navigation")
        }
        snapshot = next
        presentation = .init(
          shell: presentation.shell,
          navigation: revision,
          surface: presentation.surface,
          sections: presentation.sections
        )
        authority = .init(
          shellCommands: authority.shellCommands,
          tabApplicability: applicabilityRevision,
          sectionCommands: authority.sectionCommands
        )
      case .section(let tabId, let revision, let commandRevisions, let value):
        guard valid(revision),
          Set(commandRevisions.keys) == Set(homeContainerProtocolV3SectionIds),
          commandRevisions.values.allSatisfy(valid),
          homeContainerProtocolV3TabIds.contains(tabId)
        else {
          return .invalid("invalid_section_revision")
        }
        let currentRevision = presentation.sections[tabId] ?? 0
        guard revision > currentRevision else { continue }
        guard let next = replacing(snapshot, tabId: tabId, sections: value) else {
          return .invalid("invalid_section")
        }
        snapshot = next
        var sectionRevisions = presentation.sections
        sectionRevisions[tabId] = revision
        presentation = .init(
          shell: presentation.shell,
          navigation: presentation.navigation,
          surface: presentation.surface,
          sections: sectionRevisions
        )
        authority = .init(
          shellCommands: authority.shellCommands,
          tabApplicability: authority.tabApplicability,
          sectionCommands: Dictionary(
            uniqueKeysWithValues: homeContainerProtocolV3SectionIds.map { sectionId in
              (
                sectionId,
                max(
                  authority.sectionCommands[sectionId] ?? 0,
                  commandRevisions[sectionId] ?? 0
                )
              )
            }
          )
        )
      case .surface(let revision, let value):
        guard valid(revision) else {
          return .invalid("invalid_surface_revision")
        }
        guard revision > presentation.surface else { continue }
        snapshot = replacing(snapshot, theme: value)
        presentation = .init(
          shell: presentation.shell,
          navigation: presentation.navigation,
          surface: revision,
          sections: presentation.sections
        )
      }
      appliedDomains.append(update.domainKey)
    }

    guard !appliedDomains.isEmpty else { return .ignored }
    guard homeContainerValidatesBusinessInvariants(snapshot) else {
      return .invalid("invalid_result")
    }
    return .applied(
      HomeContainerProtocolV3State(
        identity: HomeContainerProtocolV3Identity(
          scopeKey: current.identity.scopeKey,
          sessionId: current.identity.sessionId,
          storeCommitId: max(current.identity.storeCommitId, batch.identity.storeCommitId)
        ),
        presentationRevisions: presentation,
        authorityRevisions: authority,
        snapshot: snapshot
      ),
      .domains(appliedDomains)
    )
  }

  private static func valid(_ revision: Int) -> Bool {
    homeContainerIsNonnegativeSafeInteger(revision)
  }

  private static func snapshotUpdates(
    _ envelope: HomeContainerProtocolV3SnapshotEnvelope
  ) -> [HomeContainerProtocolV3DomainUpdate] {
    var updates: [HomeContainerProtocolV3DomainUpdate] = [
      .shell(
        presentationRevision: envelope.presentationRevisions.shell,
        commandRevision: envelope.authorityRevisions.shellCommands,
        value: envelope.payload.header
      ),
      .navigation(
        presentationRevision: envelope.presentationRevisions.navigation,
        applicabilityRevision: envelope.authorityRevisions.tabApplicability,
        value: HomeContainerProtocolV3Navigation(
          selectedTabId: envelope.payload.selectedTabId,
          tabs: envelope.payload.tabs.map {
            HomeContainerNavigationTab(
              id: $0.id,
              title: $0.title,
              destination: $0.destination,
              handoffCommandId: $0.handoffCommandId,
              toolbarAction: $0.toolbarAction
            )
          }
        )
      ),
      .surface(
        presentationRevision: envelope.presentationRevisions.surface,
        value: envelope.payload.theme
      ),
    ]
    envelope.payload.tabs.filter { $0.destination == .inline }.forEach { tab in
      updates.append(
        .section(
          tabId: tab.id,
          presentationRevision: envelope.presentationRevisions.sections[tab.id] ?? 0,
          commandRevisions: envelope.authorityRevisions.sectionCommands,
          value: tab.sections
        )
      )
    }
    return updates
  }

  private static func replacing(
    _ snapshot: HomeContainerSnapshot,
    header: HomeContainerHeader
  ) -> HomeContainerSnapshot {
    HomeContainerSnapshot(
      schemaVersion: snapshot.schemaVersion,
      revision: snapshot.revision,
      selectedTabId: snapshot.selectedTabId,
      header: header,
      tabs: snapshot.tabs,
      theme: snapshot.theme
    )
  }

  private static func replacing(
    _ snapshot: HomeContainerSnapshot,
    theme: HomeContainerTheme
  ) -> HomeContainerSnapshot {
    HomeContainerSnapshot(
      schemaVersion: snapshot.schemaVersion,
      revision: snapshot.revision,
      selectedTabId: snapshot.selectedTabId,
      header: snapshot.header,
      tabs: snapshot.tabs,
      theme: theme
    )
  }

  private static func replacing(
    _ snapshot: HomeContainerSnapshot,
    navigation: HomeContainerProtocolV3Navigation
  ) -> HomeContainerSnapshot? {
    let sections = Dictionary(
      uniqueKeysWithValues: snapshot.tabs.map { ($0.id, $0.sections) }
    )
    let tabs = navigation.tabs.map { tab in
      HomeContainerTab(
        id: tab.id,
        title: tab.title,
        destination: tab.destination,
        handoffCommandId: tab.handoffCommandId,
        toolbarAction: tab.toolbarAction,
        sections: tab.destination == .inline ? sections[tab.id] ?? [] : []
      )
    }
    let next = HomeContainerSnapshot(
      schemaVersion: snapshot.schemaVersion,
      revision: snapshot.revision,
      selectedTabId: navigation.selectedTabId,
      header: snapshot.header,
      tabs: tabs,
      theme: snapshot.theme
    )
    return homeContainerValidatesBusinessInvariants(next) ? next : nil
  }

  private static func replacing(
    _ snapshot: HomeContainerSnapshot,
    tabId: String,
    sections: [HomeContainerSection]
  ) -> HomeContainerSnapshot? {
    var replaced = false
    let tabs = snapshot.tabs.map { tab -> HomeContainerTab in
      guard tab.id == tabId, tab.destination == .inline else { return tab }
      replaced = true
      return HomeContainerTab(
        id: tab.id,
        title: tab.title,
        destination: tab.destination,
        handoffCommandId: tab.handoffCommandId,
        toolbarAction: tab.toolbarAction,
        sections: sections
      )
    }
    guard replaced else { return nil }
    return HomeContainerSnapshot(
      schemaVersion: snapshot.schemaVersion,
      revision: snapshot.revision,
      selectedTabId: snapshot.selectedTabId,
      header: snapshot.header,
      tabs: tabs,
      theme: snapshot.theme
    )
  }
}
