import Foundation
import NitroModules
import UIKit

final class HybridHomeContainer: HybridHomeContainerSpec {
  private lazy var containerView: HomeContainerView = {
    let container = HomeContainerView()
    container.onAction = { [weak self] actionId, itemId, tabId in
      self?.onAction?(actionId, itemId, tabId)
    }
    container.onRefresh = { [weak self] tabId, requestId in
      self?.onRefresh?(tabId, requestId)
    }
    container.onVisibleTabChange = { [weak self] tabId in
      self?.onVisibleTabChange?(tabId)
    }
    container.onRenderError = { [weak self] code, message in
      self?.onRenderError?(code, message)
    }
    container.onIntent = { [weak self] intentJson in
      self?.onIntent?(intentJson)
    }
    container.onTransportResult = { [weak self] resultJson in
      self?.onTransportResult?(resultJson)
    }
    return container
  }()

  var view: UIView { containerView }

  var initialSnapshotJson: String = "" {
    didSet {
      guard !initialSnapshotJson.isEmpty else { return }
      containerView.submitSnapshot(initialSnapshotJson)
    }
  }

  var backgroundColor: String = "#FFFFFF" {
    didSet { containerView.setFallbackBackgroundColor(backgroundColor) }
  }

  var debugOverlayEnabled: Bool = false {
    didSet { containerView.setDebugOverlayEnabled(debugOverlayEnabled) }
  }

  var onAction: ((_ actionId: String, _ itemId: String, _ tabId: String) -> Void)?
  var onRefresh: ((_ tabId: String, _ requestId: String) -> Void)? {
    didSet { updateRefreshAvailability() }
  }
  var onVisibleTabChange: ((_ tabId: String) -> Void)?
  var onRenderError: ((_ code: String, _ message: String) -> Void)?
  var onIntent: ((_ intentJson: String) -> Void)? {
    didSet { updateRefreshAvailability() }
  }
  var onTransportResult: ((_ resultJson: String) -> Void)?

  func setSnapshot(snapshotJson: String) throws {
    containerView.submitSnapshot(snapshotJson)
  }

  func applyPatch(patchJson: String) throws {
    containerView.submitPatch(patchJson)
  }

  func completeRefresh(requestId: String) throws {
    containerView.completeRefresh(requestId)
  }

  func selectTab(tabId: String, animated: Bool) throws {
    containerView.selectTab(tabId, animated: animated)
  }

  func getCapabilities() throws -> String {
    return "{\"schemaVersions\":[2],\"protocolVersions\":[1,2,3],\"preferredProtocol\":3,"
      + "\"tabIds\":[\"portfolio\",\"perps\",\"defi\",\"nft\",\"history\"],"
      + "\"supportsPatches\":true,\"supportsAtomicPatches\":true,"
      + "\"supportsNativeRefresh\":true,\"supportsHorizontalPaging\":true,"
      + "\"supportsSlots\":true}"
  }

  private func updateRefreshAvailability() {
    containerView.setRefreshEnabled(onRefresh != nil || onIntent != nil)
  }

  deinit {
    containerView.dispose()
  }
}
