import Foundation

struct HomeContainerTheme: Decodable {
  let backgroundColor: String
  let cardColor: String
  let strongColor: String?
  let infoBackgroundColor: String?
  let infoTextColor: String?
  let hoverColor: String?
  let activeColor: String?
  let subduedIconColor: String?
  let dividerColor: String
  let primaryTextColor: String
  let secondaryTextColor: String
  let accentColor: String
  let positiveColor: String
  let negativeColor: String
}

struct HomeContainerAction: Decodable {
  let id: String
  let title: String
  let subtitle: String?
  let icon: String?
  let iconUrl: String?
  let actionId: String
}

struct HomeContainerBanner: Decodable {
  let id: String
  let title: String
  let subtitle: String?
  let imageUrl: String?
  let actionId: String?
  let dismissActionId: String?
}

struct HomeContainerSegment: Decodable {
  let id: String
  let title: String
  let imageUrl: String?
  let leadingIcon: String?
  let iconOnly: Bool?
  let selected: Bool?
  let actionId: String
}

struct HomeContainerHeader: Decodable {
  let accountName: String
  let accountSubtitle: String?
  let accountImageUrl: String?
  let accountActionId: String?
  let copyActionId: String?
  let networkName: String?
  let networkImageUrls: [String]?
  let networkCount: Int?
  let networkActionId: String?
  let balance: String
  let balanceSecondary: String?
  let balanceActionId: String?
  let balanceActions: [HomeContainerAction]?
  let actionLayout: String?
  let actionRowHeight: CGFloat?
  let actions: [HomeContainerAction]
  let banners: [HomeContainerBanner]
}

struct HomeContainerItem: Decodable {
  let id: String
  let renderer: String
  let title: String
  let subtitle: String?
  let subtitleDetail: String?
  let subtitleDetailColor: String?
  let value: String?
  let detail: String?
  let imageUrl: String?
  let imageUrls: [String]?
  let secondaryImageUrl: String?
  let titleAccessoryImageUrl: String?
  let titleAccessoryIcon: String?
  let badge: String?
  let badges: [String]?
  let badgeImageUrl: String?
  let communityRecognized: Bool?
  let accentColor: String?
  let buttonTitle: String?
  let leadingIcon: String?
  let showChevron: Bool?
  let actionId: String?
  let favorite: Bool?
  let favoriteActionId: String?
  let favoriteLabel: String?
  let displayHeight: CGFloat?
  let segments: [HomeContainerSegment]?
}

struct HomeContainerSection: Decodable {
  let id: String
  let title: String?
  let actionTitle: String?
  let actionId: String?
  let actionDisabled: Bool?
  let layout: String?
  let items: [HomeContainerItem]
}

enum HomeContainerTabDestination: String, Decodable {
  case inline
  case handoff
}

struct HomeContainerTab: Decodable {
  let id: String
  let title: String
  let destination: HomeContainerTabDestination
  let handoffCommandId: String?
  let toolbarAction: HomeContainerAction?
  let sections: [HomeContainerSection]

  private enum CodingKeys: String, CodingKey {
    case id
    case title
    case destination
    case handoffCommandId
    case toolbarAction
    case sections
  }

  init(
    id: String,
    title: String,
    destination: HomeContainerTabDestination,
    handoffCommandId: String?,
    toolbarAction: HomeContainerAction?,
    sections: [HomeContainerSection]
  ) {
    self.id = id
    self.title = title
    self.destination = destination
    self.handoffCommandId = handoffCommandId
    self.toolbarAction = toolbarAction
    self.sections = sections
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    title = try container.decode(String.self, forKey: .title)
    destination = try container.decode(HomeContainerTabDestination.self, forKey: .destination)
    toolbarAction = try container.decodeIfPresent(
      HomeContainerAction.self,
      forKey: .toolbarAction
    )
    sections = try container.decode([HomeContainerSection].self, forKey: .sections)

    switch destination {
    case .inline:
      guard !container.contains(.handoffCommandId) else {
        throw DecodingError.dataCorruptedError(
          forKey: .handoffCommandId,
          in: container,
          debugDescription: "Inline tabs must not carry a handoff command"
        )
      }
      handoffCommandId = nil
    case .handoff:
      let commandId = try container.decode(String.self, forKey: .handoffCommandId)
      guard !commandId.isEmpty, sections.isEmpty else {
        throw DecodingError.dataCorruptedError(
          forKey: .handoffCommandId,
          in: container,
          debugDescription: "Handoff tabs require a command and must not carry sections"
        )
      }
      handoffCommandId = commandId
    }
  }
}

struct HomeContainerSnapshot: Decodable {
  let schemaVersion: Int
  let revision: Int
  let selectedTabId: String
  let header: HomeContainerHeader
  let tabs: [HomeContainerTab]
  let theme: HomeContainerTheme

  func applying(_ patch: HomeContainerPatch) -> HomeContainerSnapshot {
    let sectionPatches = Dictionary(
      patch.tabs.map { ($0.tabId, $0.sections) },
      uniquingKeysWith: { _, latest in latest }
    )
    let nextTabs = tabs.map { tab in
      guard let sections = sectionPatches[tab.id] else { return tab }
      return HomeContainerTab(
        id: tab.id,
        title: tab.title,
        destination: tab.destination,
        handoffCommandId: tab.handoffCommandId,
        toolbarAction: tab.toolbarAction,
        sections: sections
      )
    }
    return HomeContainerSnapshot(
      schemaVersion: schemaVersion,
      revision: patch.revision,
      selectedTabId: selectedTabId,
      header: patch.header ?? header,
      tabs: nextTabs,
      theme: theme
    )
  }
}

struct HomeContainerTabPatch: Decodable {
  let tabId: String
  let sections: [HomeContainerSection]
}

struct HomeContainerPatch: Decodable {
  let schemaVersion: Int
  let revision: Int
  let header: HomeContainerHeader?
  let tabs: [HomeContainerTabPatch]
}

let homeContainerProtocolVersion = 2
let homeContainerBusinessSchemaVersion = 2
private let homeContainerMaximumSafeInteger = 9_007_199_254_740_991

private func homeContainerIsSafeInteger(_ value: Int) -> Bool {
  value >= -homeContainerMaximumSafeInteger && value <= homeContainerMaximumSafeInteger
}

func homeContainerIsNonnegativeSafeInteger(_ value: Int) -> Bool {
  value >= 0 && value <= homeContainerMaximumSafeInteger
}

struct HomeContainerTransportProbe: Decodable {
  let kind: String?
  let protocolVersion: Int?
  let schemaVersion: Int?
  let owner: HomeContainerProtocolV2Owner?

  private enum CodingKeys: String, CodingKey {
    case kind
    case protocolVersion
    case schemaVersion
    case owner
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    kind = try? container.decode(String.self, forKey: .kind)
    protocolVersion = (try? container.decode(Int.self, forKey: .protocolVersion))
      .flatMap { homeContainerIsSafeInteger($0) ? $0 : nil }
    schemaVersion = (try? container.decode(Int.self, forKey: .schemaVersion))
      .flatMap { homeContainerIsSafeInteger($0) ? $0 : nil }
    owner = try? container.decode(HomeContainerProtocolV2Owner.self, forKey: .owner)
  }
}

struct HomeContainerProtocolV2Owner: Codable, Equatable {
  let scopeKey: String
  let sessionId: String

  var isValid: Bool {
    !scopeKey.isEmpty && !sessionId.isEmpty
  }
}

struct HomeContainerProtocolV2SnapshotPayload: Decodable {
  let selectedTabId: String
  let header: HomeContainerHeader
  let tabs: [HomeContainerTab]
  let theme: HomeContainerTheme

  func makeSnapshot(revision: Int) -> HomeContainerSnapshot {
    HomeContainerSnapshot(
      schemaVersion: homeContainerBusinessSchemaVersion,
      revision: revision,
      selectedTabId: selectedTabId,
      header: header,
      tabs: tabs,
      theme: theme
    )
  }
}

struct HomeContainerProtocolV2SnapshotEnvelope: Decodable {
  let kind: String
  let protocolVersion: Int
  let schemaVersion: Int
  let owner: HomeContainerProtocolV2Owner
  let revision: Int
  let payload: HomeContainerProtocolV2SnapshotPayload
}

struct HomeContainerProtocolV2NavigationTab: Decodable {
  let id: String
  let title: String
  let destination: HomeContainerTabDestination
  let handoffCommandId: String?
  let toolbarAction: HomeContainerAction?

  private enum CodingKeys: String, CodingKey {
    case id
    case title
    case destination
    case handoffCommandId
    case toolbarAction
    case sections
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    guard !container.contains(.sections) else {
      throw DecodingError.dataCorruptedError(
        forKey: .sections,
        in: container,
        debugDescription: "Navigation tabs must not carry sections"
      )
    }
    id = try container.decode(String.self, forKey: .id)
    title = try container.decode(String.self, forKey: .title)
    destination = try container.decode(HomeContainerTabDestination.self, forKey: .destination)
    toolbarAction = try container.decodeIfPresent(
      HomeContainerAction.self,
      forKey: .toolbarAction
    )
    switch destination {
    case .inline:
      guard !container.contains(.handoffCommandId) else {
        throw DecodingError.dataCorruptedError(
          forKey: .handoffCommandId,
          in: container,
          debugDescription: "Inline tabs must not carry a handoff command"
        )
      }
      handoffCommandId = nil
    case .handoff:
      let commandId = try container.decode(String.self, forKey: .handoffCommandId)
      guard !commandId.isEmpty else {
        throw DecodingError.dataCorruptedError(
          forKey: .handoffCommandId,
          in: container,
          debugDescription: "Handoff tabs require a non-empty command"
        )
      }
      handoffCommandId = commandId
    }
  }
}

struct HomeContainerProtocolV2Navigation: Decodable {
  let selectedTabId: String
  let tabs: [HomeContainerProtocolV2NavigationTab]
}

enum HomeContainerProtocolV2Change: Decodable {
  case replaceShell(HomeContainerHeader)
  case replaceNavigation(HomeContainerProtocolV2Navigation)
  case replaceSection(
    tabId: String,
    sectionId: String,
    index: Int,
    value: HomeContainerSection
  )
  case removeSection(tabId: String, sectionId: String)
  case replaceSurface(HomeContainerTheme)

  private enum CodingKeys: String, CodingKey {
    case kind
    case value
    case tabId
    case sectionId
    case index
  }

  private enum Kind: String, Decodable {
    case replaceShell
    case replaceNavigation
    case replaceSection
    case removeSection
    case replaceSurface
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    let kind = try container.decode(Kind.self, forKey: .kind)
    switch kind {
    case .replaceShell:
      self = .replaceShell(
        try container.decode(HomeContainerHeader.self, forKey: .value)
      )
    case .replaceNavigation:
      self = .replaceNavigation(
        try container.decode(HomeContainerProtocolV2Navigation.self, forKey: .value)
      )
    case .replaceSection:
      self = .replaceSection(
        tabId: try container.decode(String.self, forKey: .tabId),
        sectionId: try container.decode(String.self, forKey: .sectionId),
        index: try container.decode(Int.self, forKey: .index),
        value: try container.decode(HomeContainerSection.self, forKey: .value)
      )
    case .removeSection:
      self = .removeSection(
        tabId: try container.decode(String.self, forKey: .tabId),
        sectionId: try container.decode(String.self, forKey: .sectionId)
      )
    case .replaceSurface:
      self = .replaceSurface(
        try container.decode(HomeContainerTheme.self, forKey: .value)
      )
    }
  }
}

struct HomeContainerProtocolV2PatchEnvelope: Decodable {
  let kind: String
  let protocolVersion: Int
  let schemaVersion: Int
  let owner: HomeContainerProtocolV2Owner
  let baseRevision: Int
  let revision: Int
  let changes: [HomeContainerProtocolV2Change]
}

struct HomeContainerProtocolV2State {
  let owner: HomeContainerProtocolV2Owner
  let revision: Int
  let snapshot: HomeContainerSnapshot
}

enum HomeContainerProtocolV2NeedSnapshotReason: String, Encodable, Equatable {
  case ownerMismatch
  case revisionGap
  case invalidInvariant
  case unsupportedSchema
  case unsupportedProtocol
}

enum HomeContainerProtocolV2ApplyOutcome {
  case applied(HomeContainerProtocolV2State)
  case duplicate(owner: HomeContainerProtocolV2Owner, revision: Int)
  case needSnapshot(
    owner: HomeContainerProtocolV2Owner?,
    currentRevision: Int?,
    reason: HomeContainerProtocolV2NeedSnapshotReason
  )
}

struct HomeContainerProtocolV2TransportResult: Encodable {
  let kind: String
  let owner: HomeContainerProtocolV2Owner?
  let revision: Int?
  let currentRevision: Int?
  let reason: HomeContainerProtocolV2NeedSnapshotReason?

  static func applied(
    owner: HomeContainerProtocolV2Owner,
    revision: Int
  ) -> HomeContainerProtocolV2TransportResult {
    HomeContainerProtocolV2TransportResult(
      kind: "applied",
      owner: owner,
      revision: revision,
      currentRevision: nil,
      reason: nil
    )
  }

  static func duplicate(
    owner: HomeContainerProtocolV2Owner,
    revision: Int
  ) -> HomeContainerProtocolV2TransportResult {
    HomeContainerProtocolV2TransportResult(
      kind: "duplicate",
      owner: owner,
      revision: revision,
      currentRevision: nil,
      reason: nil
    )
  }

  static func needSnapshot(
    owner: HomeContainerProtocolV2Owner?,
    currentRevision: Int?,
    reason: HomeContainerProtocolV2NeedSnapshotReason
  ) -> HomeContainerProtocolV2TransportResult {
    HomeContainerProtocolV2TransportResult(
      kind: "needSnapshot",
      owner: owner,
      revision: nil,
      currentRevision: currentRevision,
      reason: reason
    )
  }

  var coalescingKey: String {
    [
      kind,
      owner?.scopeKey ?? "",
      owner?.sessionId ?? "",
      currentRevision.map(String.init) ?? "",
      reason?.rawValue ?? "",
    ].joined(separator: "|")
  }
}

struct HomeContainerProtocolV2Intent: Encodable {
  struct Payload: Encodable {
    let kind: String
    let commandId: String?
    let itemId: String?
    let tabId: String?
    let requestId: String?

    static func action(
      commandId: String,
      itemId: String?
    ) -> Payload {
      Payload(
        kind: "action",
        commandId: commandId,
        itemId: itemId,
        tabId: nil,
        requestId: nil
      )
    }

    static func refresh(tabId: String, requestId: String) -> Payload {
      Payload(
        kind: "refresh",
        commandId: nil,
        itemId: nil,
        tabId: tabId,
        requestId: requestId
      )
    }

    static func selectTab(tabId: String) -> Payload {
      Payload(
        kind: "selectTab",
        commandId: nil,
        itemId: nil,
        tabId: tabId,
        requestId: nil
      )
    }

    static func handoff(tabId: String, commandId: String) -> Payload {
      Payload(
        kind: "handoff",
        commandId: commandId,
        itemId: nil,
        tabId: tabId,
        requestId: nil
      )
    }
  }

  let intentId: String
  let owner: HomeContainerProtocolV2Owner
  let renderedRevision: Int
  let intent: Payload
}

enum HomeContainerProtocolV2Transaction {
  static func apply(
    snapshot envelope: HomeContainerProtocolV2SnapshotEnvelope,
    current: HomeContainerProtocolV2State?
  ) -> HomeContainerProtocolV2ApplyOutcome {
    guard homeContainerIsSafeInteger(envelope.protocolVersion) else {
      return .needSnapshot(
        owner: envelope.owner,
        currentRevision: current?.revision,
        reason: .invalidInvariant
      )
    }
    guard envelope.protocolVersion == homeContainerProtocolVersion else {
      return .needSnapshot(
        owner: envelope.owner,
        currentRevision: current?.revision,
        reason: .unsupportedProtocol
      )
    }
    guard homeContainerIsSafeInteger(envelope.schemaVersion) else {
      return .needSnapshot(
        owner: envelope.owner,
        currentRevision: current?.revision,
        reason: .invalidInvariant
      )
    }
    guard envelope.schemaVersion == homeContainerBusinessSchemaVersion else {
      return .needSnapshot(
        owner: envelope.owner,
        currentRevision: current?.revision,
        reason: .unsupportedSchema
      )
    }
    guard envelope.kind == "snapshot",
      envelope.owner.isValid,
      homeContainerIsNonnegativeSafeInteger(envelope.revision)
    else {
      return .needSnapshot(
        owner: envelope.owner,
        currentRevision: current?.revision,
        reason: .invalidInvariant
      )
    }
    let candidate = envelope.payload.makeSnapshot(revision: envelope.revision)
    guard validates(snapshot: candidate) else {
      return .needSnapshot(
        owner: envelope.owner,
        currentRevision: current?.revision,
        reason: .invalidInvariant
      )
    }
    if let current,
      current.owner == envelope.owner,
      envelope.revision <= current.revision
    {
      return .duplicate(owner: envelope.owner, revision: envelope.revision)
    }
    return .applied(
      HomeContainerProtocolV2State(
        owner: envelope.owner,
        revision: envelope.revision,
        snapshot: candidate
      )
    )
  }

  static func apply(
    patch: HomeContainerProtocolV2PatchEnvelope,
    current: HomeContainerProtocolV2State?
  ) -> HomeContainerProtocolV2ApplyOutcome {
    guard homeContainerIsSafeInteger(patch.protocolVersion) else {
      return .needSnapshot(
        owner: patch.owner,
        currentRevision: current?.revision,
        reason: .invalidInvariant
      )
    }
    guard patch.protocolVersion == homeContainerProtocolVersion else {
      return .needSnapshot(
        owner: patch.owner,
        currentRevision: current?.revision,
        reason: .unsupportedProtocol
      )
    }
    guard homeContainerIsSafeInteger(patch.schemaVersion) else {
      return .needSnapshot(
        owner: patch.owner,
        currentRevision: current?.revision,
        reason: .invalidInvariant
      )
    }
    guard patch.schemaVersion == homeContainerBusinessSchemaVersion else {
      return .needSnapshot(
        owner: patch.owner,
        currentRevision: current?.revision,
        reason: .unsupportedSchema
      )
    }
    guard patch.kind == "patch",
      patch.owner.isValid,
      homeContainerIsNonnegativeSafeInteger(patch.baseRevision),
      homeContainerIsNonnegativeSafeInteger(patch.revision),
      patch.revision > patch.baseRevision,
      validates(changes: patch.changes)
    else {
      return .needSnapshot(
        owner: patch.owner,
        currentRevision: current?.revision,
        reason: .invalidInvariant
      )
    }
    guard let current else {
      return .needSnapshot(
        owner: patch.owner,
        currentRevision: nil,
        reason: .revisionGap
      )
    }
    guard current.owner == patch.owner else {
      return .needSnapshot(
        owner: patch.owner,
        currentRevision: current.revision,
        reason: .ownerMismatch
      )
    }
    if patch.revision <= current.revision {
      return .duplicate(owner: patch.owner, revision: patch.revision)
    }
    guard patch.baseRevision == current.revision,
      patch.revision == current.revision + 1
    else {
      return .needSnapshot(
        owner: patch.owner,
        currentRevision: current.revision,
        reason: .revisionGap
      )
    }

    guard let candidate = applying(changes: patch.changes, to: current.snapshot),
      validates(snapshot: candidate)
    else {
      return .needSnapshot(
        owner: patch.owner,
        currentRevision: current.revision,
        reason: .invalidInvariant
      )
    }
    let committedSnapshot = HomeContainerSnapshot(
      schemaVersion: homeContainerBusinessSchemaVersion,
      revision: patch.revision,
      selectedTabId: candidate.selectedTabId,
      header: candidate.header,
      tabs: candidate.tabs,
      theme: candidate.theme
    )
    return .applied(
      HomeContainerProtocolV2State(
        owner: patch.owner,
        revision: patch.revision,
        snapshot: committedSnapshot
      )
    )
  }

  static func validates(snapshot: HomeContainerSnapshot) -> Bool {
    homeContainerValidatesBusinessInvariants(snapshot)
  }

  private static func validates(changes: [HomeContainerProtocolV2Change]) -> Bool {
    changes.allSatisfy { change in
      switch change {
      case .replaceShell, .replaceSurface:
        return true
      case .replaceNavigation(let value):
        let tabIds = value.tabs.map(\.id)
        let selectedTab = value.tabs.first(where: { $0.id == value.selectedTabId })
        return !value.selectedTabId.isEmpty
          && !tabIds.isEmpty
          && tabIds.allSatisfy { !$0.isEmpty }
          && Set(tabIds).count == tabIds.count
          && selectedTab?.destination == .inline
          && value.tabs.allSatisfy { tab in
            switch tab.destination {
            case .inline:
              return tab.handoffCommandId == nil
            case .handoff:
              return tab.handoffCommandId?.isEmpty == false
            }
          }
      case .replaceSection(let tabId, let sectionId, let index, let value):
        return !tabId.isEmpty
          && !sectionId.isEmpty
          && value.id == sectionId
          && homeContainerIsNonnegativeSafeInteger(index)
      case .removeSection(let tabId, let sectionId):
        return !tabId.isEmpty && !sectionId.isEmpty
      }
    }
  }

  private static func applying(
    changes: [HomeContainerProtocolV2Change],
    to snapshot: HomeContainerSnapshot
  ) -> HomeContainerSnapshot? {
    var selectedTabId = snapshot.selectedTabId
    var header = snapshot.header
    var tabs = snapshot.tabs
    var theme = snapshot.theme

    for change in changes {
      switch change {
      case .replaceShell(let value):
        header = value
      case .replaceNavigation(let value):
        guard !value.selectedTabId.isEmpty,
          value.tabs.allSatisfy({ !$0.id.isEmpty })
        else {
          return nil
        }
        var existingSections: [String: [HomeContainerSection]] = [:]
        for tab in tabs {
          guard existingSections[tab.id] == nil else { return nil }
          existingSections[tab.id] = tab.sections
        }
        selectedTabId = value.selectedTabId
        tabs = value.tabs.map { tab in
          HomeContainerTab(
            id: tab.id,
            title: tab.title,
            destination: tab.destination,
            handoffCommandId: tab.handoffCommandId,
            toolbarAction: tab.toolbarAction,
            sections: tab.destination == .inline
              ? existingSections[tab.id] ?? []
              : []
          )
        }
      case .replaceSection(let tabId, let sectionId, let index, let value):
        guard !tabId.isEmpty,
          !sectionId.isEmpty,
          value.id == sectionId,
          homeContainerIsNonnegativeSafeInteger(index),
          let tabIndex = tabs.firstIndex(where: {
            $0.id == tabId && $0.destination == .inline
          })
        else {
          return nil
        }
        var sections = tabs[tabIndex].sections
        sections.removeAll(where: { $0.id == sectionId })
        guard index <= sections.count else { return nil }
        sections.insert(value, at: index)
        let tab = tabs[tabIndex]
        tabs[tabIndex] = HomeContainerTab(
          id: tab.id,
          title: tab.title,
          destination: tab.destination,
          handoffCommandId: tab.handoffCommandId,
          toolbarAction: tab.toolbarAction,
          sections: sections
        )
      case .removeSection(let tabId, let sectionId):
        guard !tabId.isEmpty,
          !sectionId.isEmpty,
          let tabIndex = tabs.firstIndex(where: {
            $0.id == tabId && $0.destination == .inline
          })
        else {
          return nil
        }
        let tab = tabs[tabIndex]
        tabs[tabIndex] = HomeContainerTab(
          id: tab.id,
          title: tab.title,
          destination: tab.destination,
          handoffCommandId: tab.handoffCommandId,
          toolbarAction: tab.toolbarAction,
          sections: tab.sections.filter { $0.id != sectionId }
        )
      case .replaceSurface(let value):
        theme = value
      }
    }

    return HomeContainerSnapshot(
      schemaVersion: homeContainerBusinessSchemaVersion,
      revision: snapshot.revision,
      selectedTabId: selectedTabId,
      header: header,
      tabs: tabs,
      theme: theme
    )
  }
}

func homeContainerValidatesBusinessInvariants(_ snapshot: HomeContainerSnapshot) -> Bool {
  guard snapshot.schemaVersion == homeContainerBusinessSchemaVersion,
        homeContainerIsNonnegativeSafeInteger(snapshot.revision),
        !snapshot.selectedTabId.isEmpty,
        !snapshot.tabs.isEmpty else {
    return false
  }

  let tabIds = snapshot.tabs.map(\.id)
  guard tabIds.allSatisfy({ !$0.isEmpty }),
        Set(tabIds).count == tabIds.count,
        let selectedTab = snapshot.tabs.first(where: { $0.id == snapshot.selectedTabId }),
        selectedTab.destination == .inline else {
    return false
  }

  return snapshot.tabs.allSatisfy { tab in
    let hasValidDestinationShape: Bool
    switch tab.destination {
    case .inline:
      hasValidDestinationShape = tab.handoffCommandId == nil
    case .handoff:
      hasValidDestinationShape = tab.handoffCommandId?.isEmpty == false && tab.sections.isEmpty
    }
    let sectionIds = tab.sections.map(\.id)
    return hasValidDestinationShape
      && sectionIds.allSatisfy { !$0.isEmpty }
      && Set(sectionIds).count == sectionIds.count
  }
}
