import NitroModules
import UIKit

final class HybridHomeContainer: HybridHomeContainerSpec {
  private let containerView = HomeContainerView()

  var view: UIView { containerView }

  var state: INativeHomeViewModel?
  var onIntent: ((_ intent: INativeHomeDiagnosticIntent) -> Void)?

  func afterUpdate() {
    containerView.apply(state: state, onIntent: onIntent)
  }

  deinit {
    containerView.dispose()
  }
}
