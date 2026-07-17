import UIKit

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

struct HomeContainerTab: Decodable {
  let id: String
  let title: String
  let toolbarAction: HomeContainerAction?
  let sections: [HomeContainerSection]
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

extension UIColor {
  convenience init(homeContainerColor value: String, fallback: UIColor = .clear) {
    var hex = value.trimmingCharacters(in: .whitespacesAndNewlines)
    if hex.hasPrefix("#") {
      hex.removeFirst()
    }

    guard hex.count == 6 || hex.count == 8,
          let raw = UInt64(hex, radix: 16) else {
      self.init(cgColor: fallback.cgColor)
      return
    }

    let hasAlpha = hex.count == 8
    let red = CGFloat((raw >> (hasAlpha ? 24 : 16)) & 0xFF) / 255
    let green = CGFloat((raw >> (hasAlpha ? 16 : 8)) & 0xFF) / 255
    let blue = CGFloat((raw >> (hasAlpha ? 8 : 0)) & 0xFF) / 255
    let alpha = hasAlpha ? CGFloat(raw & 0xFF) / 255 : 1
    self.init(red: red, green: green, blue: blue, alpha: alpha)
  }
}
