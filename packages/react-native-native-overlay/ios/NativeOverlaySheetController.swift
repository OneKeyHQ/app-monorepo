import UIKit

/// Callbacks from a presented sheet back to its `NativeOverlayContainerView`.
protocol NativeOverlaySheetHost: AnyObject {
  var dismissOnPanDown: Bool { get }
  func sheetDidLoad(_ controller: NativeOverlaySheetController)
  func sheetDidDismissInteractively(_ controller: NativeOverlaySheetController)
  /// UIKit dismissed the sheet without being asked, e.g. because a sheet
  /// below it in the same level window was dismissed.
  func sheetDidDisappearUnexpectedly(_ controller: NativeOverlaySheetController)
  func sheetRequestedDismiss(_ controller: NativeOverlaySheetController, reason: String)
}

struct NativeOverlaySheetStyle {
  var height: CGFloat
  var backgroundColor: UIColor
  var cornerRadius: CGFloat
  var showHandle: Bool
  var backdropColor: UIColor?
  var dismissOnBackdropPress: Bool
  var enterMotion: NativeOverlayMotion
  var exitMotion: NativeOverlayMotion
}

/// Slides the sheet with the overlay's own motion instead of UIKit's curve
/// and fades the custom dimming view on the same clock.
private final class NativeOverlaySheetTransitionAnimator: NSObject,
  UIViewControllerAnimatedTransitioning {
  private let presenting: Bool
  private let motion: NativeOverlayMotion
  private var animator: UIViewPropertyAnimator?

  init(presenting: Bool, motion: NativeOverlayMotion) {
    self.presenting = presenting
    self.motion = motion
  }

  func transitionDuration(using transitionContext: UIViewControllerContextTransitioning?) -> TimeInterval {
    motion.makeAnimator().duration
  }

  func animateTransition(using transitionContext: UIViewControllerContextTransitioning) {
    interruptibleAnimator(using: transitionContext).startAnimation()
  }

  func interruptibleAnimator(
    using transitionContext: UIViewControllerContextTransitioning
  ) -> UIViewImplicitlyAnimating {
    if let animator {
      return animator
    }
    let viewKey: UITransitionContextViewKey = presenting ? .to : .from
    let controllerKey: UITransitionContextViewControllerKey = presenting ? .to : .from
    guard let sheetView = transitionContext.view(forKey: viewKey),
          let sheetController = transitionContext.viewController(forKey: controllerKey)
            as? NativeOverlaySheetController else {
      transitionContext.completeTransition(false)
      return motion.makeAnimator()
    }
    let container = transitionContext.containerView
    let finalFrame = presenting ? transitionContext.finalFrame(for: sheetController) : sheetView.frame
    let travel = max(container.bounds.maxY - finalFrame.minY, sheetView.bounds.height)
    let offscreen = CGAffineTransform(translationX: 0, y: travel)
    let reduceMotion = UIAccessibility.isReduceMotionEnabled

    if presenting {
      sheetView.frame = finalFrame
      if reduceMotion {
        sheetView.alpha = 0
      } else {
        sheetView.transform = offscreen
      }
      sheetController.setDimmingAlpha(0)
      if sheetView.superview == nil {
        container.addSubview(sheetView)
      }
    }

    let animator = motion.makeAnimator()
    animator.addAnimations {
      if reduceMotion {
        sheetView.alpha = self.presenting ? 1 : 0
      } else {
        sheetView.transform = self.presenting ? .identity : offscreen
      }
      sheetController.setDimmingAlpha(self.presenting ? 1 : 0)
    }
    animator.addCompletion { position in
      let completed = position == .end && !transitionContext.transitionWasCancelled
      if !completed {
        sheetView.transform = self.presenting ? offscreen : .identity
        sheetController.setDimmingAlpha(self.presenting ? 0 : 1)
      }
      transitionContext.completeTransition(completed)
    }
    self.animator = animator
    return animator
  }

  func animationEnded(_ transitionCompleted: Bool) {
    animator = nil
  }
}

/// A `.pageSheet` with one custom detent, ported from native-sheet. It is
/// presented from its level window, so sheets of different levels never
/// share a presentation chain.
final class NativeOverlaySheetController: UIViewController,
  UIAdaptivePresentationControllerDelegate,
  UIViewControllerTransitioningDelegate {
  private weak var host: NativeOverlaySheetHost?
  private let detentIdentifier = UISheetPresentationController.Detent.Identifier(
    "onekey.nativeOverlay.sheet"
  )
  private var style: NativeOverlaySheetStyle
  private let backgroundView = UIView()
  private var dimmingView: UIView?
  private var backdropTap: UITapGestureRecognizer?
  private var heightAnimator: UIViewPropertyAnimator?
  private var shadowSuppressionDisplayLink: CADisplayLink?
  /// Set while the host itself asked UIKit to dismiss.
  var dismissRequestedByHost = false

  init(host: NativeOverlaySheetHost, style: NativeOverlaySheetStyle) {
    self.host = host
    self.style = style
    super.init(nibName: nil, bundle: nil)
    modalPresentationStyle = .pageSheet
    transitioningDelegate = self
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func loadView() {
    let rootView = UIView()
    rootView.backgroundColor = style.backgroundColor
    rootView.clipsToBounds = true
    if #available(iOS 26.0, *) {
      backgroundView.frame = rootView.bounds
      backgroundView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      backgroundView.backgroundColor = style.backgroundColor
      backgroundView.isUserInteractionEnabled = false
      rootView.addSubview(backgroundView)
    }
    view = rootView
  }

  deinit {
    shadowSuppressionDisplayLink?.invalidate()
    dimmingView?.removeFromSuperview()
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    host?.sheetDidLoad(self)
    guard let sheet = sheetPresentationController else { return }
    let detent = UISheetPresentationController.Detent.custom(
      identifier: detentIdentifier
    ) { [weak self] context in
      min(max(self?.style.height ?? 1, 1), context.maximumDetentValue)
    }
    if #available(iOS 26.1, *) {
      let effect = UIColorEffect(color: style.backgroundColor)
      sheet.backgroundEffect = effect
      detent.backgroundEffect = effect
    }
    sheet.detents = [detent]
    sheet.selectedDetentIdentifier = detentIdentifier
    sheet.largestUndimmedDetentIdentifier = detentIdentifier
    sheet.prefersGrabberVisible = style.showHandle
    sheet.preferredCornerRadius = style.cornerRadius
    sheet.prefersScrollingExpandsWhenScrolledToEdge = false
    sheet.prefersEdgeAttachedInCompactHeight = true
    sheet.widthFollowsPreferredContentSizeWhenEdgeAttached = false
    presentationController?.delegate = self
    isModalInPresentation = !(host?.dismissOnPanDown ?? true)
  }

  func update(style next: NativeOverlaySheetStyle, animated: Bool) {
    let previousHeight = style.height
    style.height = max(next.height, 1)
    style.dismissOnBackdropPress = next.dismissOnBackdropPress
    style.backdropColor = next.backdropColor
    style.exitMotion = next.exitMotion
    dimmingView?.backgroundColor = next.backdropColor ?? .clear
    isModalInPresentation = !(host?.dismissOnPanDown ?? true)
    guard abs(style.height - previousHeight) >= 0.5,
          isViewLoaded,
          let sheet = sheetPresentationController else { return }
    let changes = { [weak self, weak sheet] in
      guard let self, let sheet else { return }
      sheet.invalidateDetents()
      sheet.selectedDetentIdentifier = self.detentIdentifier
      sheet.containerView?.layoutIfNeeded()
    }
    guard animated else {
      changes()
      return
    }
    if let heightAnimator {
      heightAnimator.stopAnimation(false)
      heightAnimator.finishAnimation(at: .current)
    }
    sheet.containerView?.layoutIfNeeded()
    let animator = style.enterMotion.makeAnimator()
    heightAnimator = animator
    animator.addAnimations(changes)
    animator.addCompletion { [weak self, weak animator] _ in
      guard let self, self.heightAnimator === animator else { return }
      self.heightAnimator = nil
    }
    animator.startAnimation()
  }

  // MARK: Transitions

  func animationController(
    forPresented presented: UIViewController,
    presenting: UIViewController,
    source: UIViewController
  ) -> UIViewControllerAnimatedTransitioning? {
    NativeOverlaySheetTransitionAnimator(presenting: true, motion: style.enterMotion)
  }

  func animationController(
    forDismissed dismissed: UIViewController
  ) -> UIViewControllerAnimatedTransitioning? {
    NativeOverlaySheetTransitionAnimator(presenting: false, motion: style.exitMotion)
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    installDimmingView()
    startSuppressingPresentationShadow()
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    stopSuppressingPresentationShadow()
  }

  override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    stopSuppressingPresentationShadow()
  }

  override func viewDidDisappear(_ animated: Bool) {
    super.viewDidDisappear(animated)
    if let backdropTap {
      dimmingView?.removeGestureRecognizer(backdropTap)
    }
    backdropTap = nil
    dimmingView?.removeFromSuperview()
    dimmingView = nil
    if presentingViewController == nil && !dismissRequestedByHost {
      host?.sheetDidDisappearUnexpectedly(self)
    }
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    removePresentationShadow()
    if #available(iOS 26.0, *) {
      DispatchQueue.main.async { [weak self] in
        self?.removePresentationShadow()
      }
    }
  }

  override func accessibilityPerformEscape() -> Bool {
    host?.sheetRequestedDismiss(self, reason: "back")
    return true
  }

  func presentationControllerShouldDismiss(_ presentationController: UIPresentationController) -> Bool {
    host?.dismissOnPanDown ?? true
  }

  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    dismissRequestedByHost = true
    host?.sheetDidDismissInteractively(self)
  }

  // MARK: Backdrop

  func setDimmingAlpha(_ alpha: CGFloat) {
    dimmingView?.alpha = alpha
  }

  private func installDimmingView() {
    guard dimmingView == nil, let container = presentationController?.containerView else { return }
    let dimmingView = UIView(frame: container.bounds)
    dimmingView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    dimmingView.backgroundColor = style.backdropColor ?? .clear
    dimmingView.alpha = 0
    // Always swallow backdrop touches; a sheet is blocking even without a tap-to-close.
    dimmingView.isUserInteractionEnabled = true
    container.insertSubview(dimmingView, at: 0)
    let recognizer = UITapGestureRecognizer(target: self, action: #selector(handleBackdropTap(_:)))
    recognizer.cancelsTouchesInView = true
    dimmingView.addGestureRecognizer(recognizer)
    backdropTap = recognizer
    self.dimmingView = dimmingView
  }

  @objc private func handleBackdropTap(_ recognizer: UITapGestureRecognizer) {
    guard recognizer.state == .ended, style.dismissOnBackdropPress else { return }
    host?.sheetRequestedDismiss(self, reason: "backdrop")
  }

  // MARK: Shadow suppression (same approach as native-sheet)

  private func removePresentationShadow() {
    guard let container = presentationController?.containerView else { return }
    var ancestor = view.superview
    while let current = ancestor, current !== container {
      clearShadow(on: current)
      ancestor = current.superview
    }
    removeDropShadowViews(in: container)
  }

  private func removeDropShadowViews(in candidate: UIView) {
    guard candidate !== view else { return }
    let className = NSStringFromClass(type(of: candidate))
    guard className.hasPrefix("UI") || className.hasPrefix("_UI") else { return }
    if className.contains("DropShadowView") {
      clearShadow(on: candidate)
    }
    candidate.subviews.forEach(removeDropShadowViews(in:))
  }

  private func clearShadow(on shadowView: UIView) {
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    if #available(iOS 26.0, *),
       NSStringFromClass(type(of: shadowView)).contains("UIDropShadowView") {
      compensateForPresentationScale(in: shadowView)
    }
    shadowView.layer.shadowOpacity = 0
    shadowView.layer.shadowRadius = 0
    shadowView.layer.shadowColor = UIColor.clear.cgColor
    shadowView.layer.shadowPath = nil
    CATransaction.commit()
  }

  @available(iOS 26.0, *)
  private func compensateForPresentationScale(in shadowView: UIView) {
    guard var surfaceView = view else { return }
    while let parent = surfaceView.superview, parent !== shadowView {
      surfaceView = parent
    }
    guard surfaceView.superview === shadowView else { return }
    let transform = shadowView.transform
    guard abs(transform.a) > 0.001, abs(transform.d) > 0.001 else { return }
    surfaceView.transform = CGAffineTransform(scaleX: 1 / transform.a, y: 1 / transform.d)
  }

  private func startSuppressingPresentationShadow() {
    shadowSuppressionDisplayLink?.invalidate()
    removePresentationShadow()
    let displayLink = CADisplayLink(target: self, selector: #selector(suppressShadowForFrame))
    displayLink.add(to: .main, forMode: .common)
    shadowSuppressionDisplayLink = displayLink
    if let transitionCoordinator {
      transitionCoordinator.animate(alongsideTransition: nil) { [weak self] _ in
        self?.stopSuppressingPresentationShadow()
      }
    } else {
      DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in
        self?.stopSuppressingPresentationShadow()
      }
    }
  }

  private func stopSuppressingPresentationShadow() {
    shadowSuppressionDisplayLink?.invalidate()
    shadowSuppressionDisplayLink = nil
    removePresentationShadow()
  }

  @objc private func suppressShadowForFrame() {
    removePresentationShadow()
  }
}
