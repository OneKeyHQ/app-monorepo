import Foundation
import NitroModules
import UIKit

final class HybridHomeContainer: HybridHomeContainerSpec {
  private lazy var containerView: HomeContainerView = {
    let container = HomeContainerView()
    container.onRenderError = { [weak self] code, message in
      self?.onRenderError?(code, message)
    }
    container.onIntent = { [weak self] intentJson in
      self?.onIntent?(intentJson)
    }
    return container
  }()

  var view: UIView { containerView }

  var initialStateJson: String = "" {
    didSet {
      guard !initialStateJson.isEmpty else { return }
      containerView.submitState(initialStateJson)
    }
  }

  var backgroundColor: String = "#FFFFFF" {
    didSet { containerView.setFallbackBackgroundColor(backgroundColor) }
  }

  var debugOverlayEnabled: Bool = false {
    didSet { containerView.setDebugOverlayEnabled(debugOverlayEnabled) }
  }

  var onRenderError: ((_ code: String, _ message: String) -> Void)?
  var onIntent: ((_ intentJson: String) -> Void)? {
    didSet { updateRefreshAvailability() }
  }
  func setState(stateJson: String) throws {
    containerView.submitState(stateJson)
  }

  func completeRefresh(requestId: String) throws {
    containerView.completeRefresh(requestId)
  }

  func selectTab(tabId: String, animated: Bool) throws {
    containerView.selectTab(tabId, animated: animated)
  }

  private func updateRefreshAvailability() {
    containerView.setRefreshEnabled(onIntent != nil)
  }

  deinit {
    containerView.dispose()
  }
}
