import UIKit

/// Page-scope overlays of one root route render inside this view. It sits
/// in the React tree (last child of the root-route screen), so the surface's
/// own touch handler already dispatches touches to the moved content.
@objc public final class NativeOverlayPageHostView: UIView {
  private struct WeakHost {
    weak var value: NativeOverlayPageHostView?
  }

  private static var registry: [String: WeakHost] = [:]

  static func host(for key: String) -> NativeOverlayPageHostView? {
    registry[key]?.value
  }

  @objc public var hostKey = "" {
    didSet {
      guard hostKey != oldValue else { return }
      if !oldValue.isEmpty, Self.registry[oldValue]?.value === self {
        Self.registry[oldValue] = nil
      }
      if !hostKey.isEmpty {
        Self.registry[hostKey] = WeakHost(value: self)
      }
    }
  }

  private var suspendedOwners: Set<String> = []

  @objc public func setSuspendedOwners(_ joined: String) {
    let owners = Set(joined.split(separator: "\n").map(String.init))
    guard owners != suspendedOwners else { return }
    suspendedOwners = owners
    entries().forEach(applySuspension)
  }

  override public init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .clear
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  @objc public func invalidate() {
    if !hostKey.isEmpty, Self.registry[hostKey]?.value === self {
      Self.registry[hostKey] = nil
    }
  }

  override public func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    let hit = super.hitTest(point, with: event)
    return hit === self ? nil : hit
  }

  override public func layoutSubviews() {
    super.layoutSubviews()
    entries().forEach { $0.frame = bounds }
  }

  /// Orders page entries by level, then by request order.
  func insert(_ entry: NativeOverlayEntryView) {
    if entry.superview !== self {
      entry.removeFromSuperview()
      entry.frame = bounds
      let above = entries().first { Self.sortKey($0) > Self.sortKey(entry) }
      if let above {
        insertSubview(entry, belowSubview: above)
      } else {
        addSubview(entry)
      }
    }
    applySuspension(entry)
  }

  private func applySuspension(_ entry: NativeOverlayEntryView) {
    let hidden = suspendedOwners.contains(entry.ownerKey)
    guard entry.isHidden != hidden else { return }
    if hidden {
      entry.isHidden = true
    } else {
      entry.alpha = 0
      entry.isHidden = false
      UIView.animate(withDuration: 0.15) { entry.alpha = 1 }
    }
  }

  private func entries() -> [NativeOverlayEntryView] {
    subviews.compactMap { $0 as? NativeOverlayEntryView }
  }

  private static func sortKey(_ entry: NativeOverlayEntryView) -> (Int, Int) {
    (entry.levelOrder, entry.stackOrder)
  }
}
