import UIKit

/// Levels mirror `OVERLAY_LEVEL_ORDER`. Each active level gets its own
/// window so that order between levels never depends on show order.
enum NativeOverlayLevel: String, CaseIterable {
  case modal
  case hardware
  case secure
  case toast
  case lock
  case debug

  /// Mirrors `OVERLAY_LEVEL_ORDER`.
  var order: Int {
    switch self {
    case .modal: return 100
    case .hardware: return 200
    case .secure: return 300
    case .toast: return 400
    case .lock: return 500
    case .debug: return 900
    }
  }

  var windowLevel: UIWindow.Level {
    switch self {
    // Above the app window (and every VC it presents), below system alerts.
    case .modal: return UIWindow.Level(rawValue: UIWindow.Level.normal.rawValue + 10)
    case .hardware: return UIWindow.Level(rawValue: UIWindow.Level.normal.rawValue + 20)
    case .secure: return UIWindow.Level(rawValue: UIWindow.Level.normal.rawValue + 30)
    case .toast: return UIWindow.Level(rawValue: UIWindow.Level.normal.rawValue + 40)
    // Above React Native's Alert window (alert + 1) and perf overlays.
    case .lock: return UIWindow.Level(rawValue: UIWindow.Level.alert.rawValue + 10)
    case .debug: return UIWindow.Level(rawValue: UIWindow.Level.alert.rawValue + 20)
    }
  }
}

/// Lets touches that miss every overlay fall through to lower windows.
final class NativeOverlayPassthroughWindow: UIWindow {
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    let hit = super.hitTest(point, with: event)
    if hit === self || hit === rootViewController?.view {
      return nil
    }
    return hit
  }
}

/// Status bar and orientation follow the app window underneath, because
/// `childForStatusBarStyle` cannot reach across windows.
final class NativeOverlayRootViewController: UIViewController {
  weak var appWindow: UIWindow?

  private var appTopController: UIViewController? {
    var controller = appWindow?.rootViewController
    while let presented = controller?.presentedViewController, !presented.isBeingDismissed {
      controller = presented
    }
    return controller
  }

  override func loadView() {
    let root = UIView()
    root.backgroundColor = .clear
    view = root
  }

  override var preferredStatusBarStyle: UIStatusBarStyle {
    appTopController?.preferredStatusBarStyle ?? .default
  }

  override var prefersStatusBarHidden: Bool {
    appTopController?.prefersStatusBarHidden ?? false
  }

  override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
    appTopController?.supportedInterfaceOrientations ?? .all
  }
}

final class NativeOverlayWindowManager {
  static let shared = NativeOverlayWindowManager()

  private struct SceneKey: Hashable {
    let id: ObjectIdentifier
  }

  private var windows: [SceneKey: [NativeOverlayLevel: NativeOverlayPassthroughWindow]] = [:]

  /// The level window for `level` in the scene of `appWindow`, shown on demand.
  /// Non-sheet entries are added directly to it so they interleave by insertion
  /// order with UIKit presentation containers of sheets in the same level.
  func window(for level: NativeOverlayLevel, appWindow: UIWindow) -> UIWindow? {
    guard let scene = appWindow.windowScene else { return nil }
    let key = SceneKey(id: ObjectIdentifier(scene))
    pruneDisconnectedScenes()
    var sceneWindows = windows[key] ?? [:]
    let window: NativeOverlayPassthroughWindow
    if let existing = sceneWindows[level] {
      window = existing
    } else {
      window = NativeOverlayPassthroughWindow(windowScene: scene)
      window.windowLevel = level.windowLevel
      window.backgroundColor = .clear
      window.rootViewController = NativeOverlayRootViewController()
      sceneWindows[level] = window
      windows[key] = sceneWindows
    }
    (window.rootViewController as? NativeOverlayRootViewController)?.appWindow = appWindow
    if window.isHidden {
      window.frame = scene.coordinateSpace.bounds
      window.isHidden = false
      window.rootViewController?.setNeedsStatusBarAppearanceUpdate()
    }
    return window
  }

  /// Top of the level window's presentation chain; sheets of one level stack here.
  func presenter(in window: UIWindow) -> UIViewController? {
    var controller = window.rootViewController
    while let presented = controller?.presentedViewController, !presented.isBeingDismissed {
      controller = presented
    }
    return controller
  }

  /// Hides a level window once nothing is shown in it, and hands key status
  /// back to the app window if an input in the overlay had taken it.
  func entryRemoved(from window: UIWindow?) {
    guard let window = window as? NativeOverlayPassthroughWindow,
          let root = window.rootViewController else { return }
    let hasEntries = window.subviews.contains { $0 is NativeOverlayEntryView }
    let presented = root.presentedViewController
    guard !hasEntries, presented == nil || presented?.isBeingDismissed == true else { return }
    let wasKey = window.isKeyWindow
    window.isHidden = true
    if wasKey {
      (root as? NativeOverlayRootViewController)?.appWindow?.makeKey()
    }
  }

  private func pruneDisconnectedScenes() {
    let connected = Set(
      UIApplication.shared.connectedScenes.map { SceneKey(id: ObjectIdentifier($0)) }
    )
    windows = windows.filter { connected.contains($0.key) }
  }
}
