import Foundation

struct HomeContainerTabSelectionRequest: Equatable {
  let tabId: String
  let animated: Bool
  let notify: Bool
}

struct HomeContainerTabSelectionQueue {
  private(set) var pending: HomeContainerTabSelectionRequest?

  mutating func replacePending(with request: HomeContainerTabSelectionRequest) {
    pending = request
  }

  mutating func takePending() -> HomeContainerTabSelectionRequest? {
    defer { pending = nil }
    return pending
  }
}

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

struct HomeContainerBannerResourceRow: Decodable {
  let label: String
  let value: String
  let progress: CGFloat?
}

struct HomeContainerBanner: Decodable {
  let id: String
  let title: String
  let subtitle: String?
  let imageUrl: String?
  let actionId: String?
  let dismissActionId: String?
  let resourceRows: [HomeContainerBannerResourceRow]?
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
  let showDivider: Bool?
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
}

let homeContainerBusinessSchemaVersion = 2
private let homeContainerMaximumSafeInteger = 9_007_199_254_740_991

func homeContainerIsNonnegativeSafeInteger(_ value: Int) -> Bool {
  value >= 0 && value <= homeContainerMaximumSafeInteger
}

struct HomeContainerOwner: Codable, Equatable {
  let scopeKey: String
  let sessionId: String

  var isValid: Bool {
    !scopeKey.isEmpty && !sessionId.isEmpty
  }
}

struct HomeContainerSnapshotPayload: Decodable {
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

struct HomeContainerNavigationTab: Decodable {
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

  init(
    id: String,
    title: String,
    destination: HomeContainerTabDestination,
    handoffCommandId: String?,
    toolbarAction: HomeContainerAction?
  ) {
    self.id = id
    self.title = title
    self.destination = destination
    self.handoffCommandId = handoffCommandId
    self.toolbarAction = toolbarAction
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
    destination = try container.decode(
      HomeContainerTabDestination.self,
      forKey: .destination
    )
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
      hasValidDestinationShape =
        tab.handoffCommandId?.isEmpty == false && tab.sections.isEmpty
    }
    let sectionIds = tab.sections.map(\.id)
    return hasValidDestinationShape
      && sectionIds.allSatisfy { !$0.isEmpty }
      && Set(sectionIds).count == sectionIds.count
  }
}
