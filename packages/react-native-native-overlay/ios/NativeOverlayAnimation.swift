import UIKit

/// Mirrors `IOverlayMotion` from `src/animation/types.ts`.
enum NativeOverlayMotion {
  case spring(mass: CGFloat, stiffness: CGFloat, damping: CGFloat)
  case timing(duration: TimeInterval, controlPoint1: CGPoint, controlPoint2: CGPoint)

  /// Tamagui `quick` on native.
  static let quick = NativeOverlayMotion.spring(mass: 0.1, stiffness: 100, damping: 20)

  init(json: Any?) {
    guard let dict = json as? [String: Any], let type = dict["type"] as? String else {
      self = .quick
      return
    }
    if type == "timing",
       let timing = dict["timing"] as? [String: Any],
       let durationMs = (timing["durationMs"] as? NSNumber)?.doubleValue {
      let easing = (timing["easing"] as? [NSNumber])?.map { CGFloat($0.doubleValue) } ?? []
      let points = easing.count == 4 ? easing : [0.25, 0.1, 0.25, 1]
      self = .timing(
        duration: durationMs / 1000,
        controlPoint1: CGPoint(x: points[0], y: points[1]),
        controlPoint2: CGPoint(x: points[2], y: points[3])
      )
      return
    }
    if type == "spring", let spring = dict["spring"] as? [String: Any] {
      self = .spring(
        mass: CGFloat((spring["mass"] as? NSNumber)?.doubleValue ?? 1),
        stiffness: CGFloat((spring["stiffness"] as? NSNumber)?.doubleValue ?? 100),
        damping: CGFloat((spring["damping"] as? NSNumber)?.doubleValue ?? 20)
      )
      return
    }
    self = .quick
  }

  func makeAnimator() -> UIViewPropertyAnimator {
    switch self {
    case let .spring(mass, stiffness, damping):
      // (mass:stiffness:damping:) maps 1:1 to Reanimated and, unlike the
      // dampingRatio initializer, accepts ratios above 1 (`quick` is ~3.16).
      let parameters = UISpringTimingParameters(
        mass: mass,
        stiffness: stiffness,
        damping: damping,
        initialVelocity: .zero
      )
      return UIViewPropertyAnimator(duration: 0, timingParameters: parameters)
    case let .timing(duration, controlPoint1, controlPoint2):
      let parameters = UICubicTimingParameters(
        controlPoint1: controlPoint1,
        controlPoint2: controlPoint2
      )
      return UIViewPropertyAnimator(duration: duration, timingParameters: parameters)
    }
  }
}

/// Mirrors `IResolvedOverlayTransition`.
struct NativeOverlayTransition {
  enum Kind: String {
    case none
    case fade
    case slide
    case scale
  }

  enum Edge: String {
    case top
    case bottom
    case left
    case right
  }

  var kind: Kind = .fade
  var edge: Edge = .bottom
  var distance: CGFloat?
  var scale: CGFloat = 0.95
  var offsetY: CGFloat = 0
  var fade = true
  var motion: NativeOverlayMotion = .quick

  init() {}

  init(json: Any?) {
    guard let dict = json as? [String: Any] else { return }
    kind = Kind(rawValue: dict["type"] as? String ?? "") ?? .fade
    edge = Edge(rawValue: dict["edge"] as? String ?? "") ?? .bottom
    distance = (dict["distance"] as? NSNumber).map { CGFloat($0.doubleValue) }
    scale = CGFloat((dict["scale"] as? NSNumber)?.doubleValue ?? 0.95)
    offsetY = CGFloat((dict["offsetY"] as? NSNumber)?.doubleValue ?? 0)
    fade = (dict["fade"] as? NSNumber)?.boolValue ?? (kind == .fade || kind == .scale)
    motion = NativeOverlayMotion(json: dict["motion"])
  }

  /// Reduce Motion keeps the timing but drops movement.
  var accessibilityAdjusted: NativeOverlayTransition {
    guard UIAccessibility.isReduceMotionEnabled, kind != .none else { return self }
    var copy = self
    copy.kind = .fade
    copy.fade = true
    return copy
  }

  var hidesOpacity: Bool { kind == .fade || fade }

  /// The off-stage transform: where enter starts and exit ends.
  func hiddenTransform(contentExtent: CGRect, bounds: CGRect) -> CGAffineTransform {
    switch kind {
    case .none, .fade:
      return .identity
    case .slide:
      let travel: CGFloat
      if let distance {
        travel = distance
      } else {
        switch edge {
        case .top: travel = contentExtent.maxY
        case .bottom: travel = bounds.height - contentExtent.minY
        case .left: travel = contentExtent.maxX
        case .right: travel = bounds.width - contentExtent.minX
        }
      }
      switch edge {
      case .top: return CGAffineTransform(translationX: 0, y: -travel)
      case .bottom: return CGAffineTransform(translationX: 0, y: travel)
      case .left: return CGAffineTransform(translationX: -travel, y: 0)
      case .right: return CGAffineTransform(translationX: travel, y: 0)
      }
    case .scale:
      // Scale around the content's center, not the full-window wrapper's.
      let dx = contentExtent.midX - bounds.midX
      let dy = contentExtent.midY - bounds.midY
      return CGAffineTransform(translationX: dx, y: dy + offsetY)
        .scaledBy(x: scale, y: scale)
        .translatedBy(x: -dx, y: -dy)
    }
  }
}

/// Mirrors `IResolvedOverlayAnimation`.
struct NativeOverlayAnimationConfig {
  var enter = NativeOverlayTransition()
  var exit = NativeOverlayTransition()
  var backdropMotion: NativeOverlayMotion = .quick

  init() {}

  init(jsonString: String) {
    guard !jsonString.isEmpty,
          let data = jsonString.data(using: .utf8),
          let object = try? JSONSerialization.jsonObject(with: data),
          let dict = object as? [String: Any] else { return }
    enter = NativeOverlayTransition(json: dict["enter"])
    exit = dict["exit"] == nil ? enter : NativeOverlayTransition(json: dict["exit"])
    backdropMotion = NativeOverlayMotion(json: (dict["backdrop"] as? [String: Any])?["motion"])
  }
}
