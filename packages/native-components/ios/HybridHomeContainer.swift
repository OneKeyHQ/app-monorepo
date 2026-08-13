import NitroModules
import UIKit

struct HomeContainerSectionUpdate {
  var protocolVersion = false
  var owner = false
  var navigation = false
  var header = false
  var spotTokens = false
  var theme = false
  var onIntent = false
}

final class HybridHomeContainer: HybridHomeContainerSpec {
  private let containerView = HomeContainerView()
  private var update = HomeContainerSectionUpdate()

  var view: UIView { containerView }

  var protocolVersion: Double? { didSet { update.protocolVersion = true } }
  var owner: INativeHomeOwnerToken? { didSet { update.owner = true } }
  var navigation: INativeHomeNavigationViewModel? { didSet { update.navigation = true } }
  var header: INativeHomeHeaderViewModel? { didSet { update.header = true } }
  var spotTokens: INativeHomeSpotTokensViewModel? { didSet { update.spotTokens = true } }
  var theme: INativeHomeThemeViewModel? { didSet { update.theme = true } }
  var onIntent: ((_ intent: INativeHomeIntent) -> Void)? {
    didSet { update.onIntent = true }
  }

  func beforeUpdate() {
    update = HomeContainerSectionUpdate()
  }

  func afterUpdate() {
    containerView.apply(
      protocolVersion: protocolVersion,
      owner: owner,
      navigation: navigation,
      header: header,
      spotTokens: spotTokens,
      theme: theme,
      update: update,
      onIntent: onIntent
    )
  }

  deinit {
    containerView.dispose()
  }
}
