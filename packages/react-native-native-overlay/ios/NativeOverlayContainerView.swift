import React
import UIKit

/// One overlay inside a level window: backdrop plus the reparented content.
final class NativeOverlayEntryView: UIView {
  let backdropView = UIView()
  let contentView = UIView()
  var stackOrder = 0
  var blocking = true
  var dismissOnBackPress = true
  var onEscape: (() -> Void)?
  var onBackdropTap: (() -> Void)?

  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .clear
    backdropView.frame = bounds
    backdropView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    backdropView.alpha = 0
    contentView.frame = bounds
    contentView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    contentView.backgroundColor = .clear
    addSubview(backdropView)
    addSubview(contentView)
    let tap = UITapGestureRecognizer(target: self, action: #selector(handleBackdropTap))
    tap.cancelsTouchesInView = false
    backdropView.addGestureRecognizer(tap)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  /// Touches that miss the React content either hit the backdrop (blocking)
  /// or fall through to the windows below (toast, debug).
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    guard let hit = super.hitTest(point, with: event) else { return nil }
    // The React root is `pointerEvents="box-none"`, so Fabric returns nil for
    // it and the plain content view reports itself when nothing was hit.
    if hit === self || hit === contentView || hit === backdropView {
      return blocking ? backdropView : nil
    }
    return hit
  }

  override func accessibilityPerformEscape() -> Bool {
    guard blocking else { return false }
    if dismissOnBackPress {
      onEscape?()
    }
    return true
  }

  @objc private func handleBackdropTap() {
    onBackdropTap?()
  }

  /// Union of the rendered React children; the root React view fills the window.
  func contentExtent() -> CGRect {
    let roots = contentView.subviews
    let rects = roots.flatMap { root in
      root.subviews.map { root.convert($0.frame, to: contentView) }
    }
    guard var union = rects.first else { return bounds }
    rects.dropFirst().forEach { union = union.union($0) }
    return union
  }
}

@objc public final class NativeOverlayContainerView: UIView {
  @objc public var visible = false
  @objc public var level = "modal"
  @objc public var presentation = "center"
  @objc public var stackOrder = 0
  @objc public var blocking = true
  @objc public var dismissOnBackPress = true
  @objc public var dismissOnBackdropPress = false
  @objc public var backdropColor: UIColor?
  @objc public var sheetHeight: CGFloat = 0
  @objc public var sheetCornerRadius: CGFloat = 24
  @objc public var showHandle = false
  @objc public var sheetBackgroundColor: UIColor?
  @objc public var dismissOnPanDown = true
  @objc public var animationConfig = ""
  @objc public var touchHandler: UIGestureRecognizer?
  @objc public var onPresented: RCTDirectEventBlock?
  @objc public var onDismissed: RCTDirectEventBlock?
  @objc public var onRequestDismiss: RCTDirectEventBlock?

  private enum Phase {
    case hidden
    case entering
    case shown
    case exiting
  }

  private var phase: Phase = .hidden
  private weak var contentChild: UIView?
  private var entryView: NativeOverlayEntryView?
  private var sheetController: NativeOverlaySheetController?
  private weak var hostWindow: UIWindow?
  private var isSheet: Bool { presentation == "sheet" }
  private var animator: UIViewPropertyAnimator?
  private var backdropAnimator: UIViewPropertyAnimator?
  private var parsedConfigSource: String?
  private var config = NativeOverlayAnimationConfig()
  /// True between a visible=true commit and the matching onDismissed.
  private var cycleOpen = false

  override public func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil {
      commitConfiguration()
    } else if phase != .hidden {
      finishDismiss(reason: "system")
    }
  }

  override public init(frame: CGRect) {
    super.init(frame: frame)
    // The staged child lives in this zero-size view while hidden.
    clipsToBounds = true
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  @objc public func insertChild(_ child: UIView, atIndex index: Int) {
    contentChild = child
    child.removeFromSuperview()
    if let sheetController, sheetController.isViewLoaded {
      sheetController.view.addSubview(child)
    } else if let entryView {
      entryView.contentView.addSubview(child)
    } else {
      stageContent()
    }
  }

  /// Keeps the React child attached (inside this clipped, zero-size view)
  /// while hidden, so Fabric keeps reporting its layout; fitted sheets size
  /// themselves from that measurement before presenting.
  private func stageContent() {
    guard let child = contentChild, child.superview !== self else { return }
    child.removeFromSuperview()
    addSubview(child)
  }

  @objc public func removeChild(_ child: UIView) {
    guard contentChild === child else { return }
    child.removeFromSuperview()
    contentChild = nil
  }

  @objc public func commitConfiguration() {
    if parsedConfigSource != animationConfig {
      parsedConfigSource = animationConfig
      config = NativeOverlayAnimationConfig(jsonString: animationConfig)
    }
    if let entryView {
      applyEntryConfiguration(entryView)
    }
    if let sheetController, phase == .entering || phase == .shown {
      sheetController.update(style: sheetStyle(), animated: phase == .shown)
    }
    if visible {
      cycleOpen = true
      // A sheet that is still animating out is re-presented after it finishes.
      if phase == .hidden || (phase == .exiting && !isSheet) {
        present()
      }
    } else if cycleOpen {
      if phase == .entering || phase == .shown {
        dismiss()
      } else if phase == .hidden {
        cycleOpen = false
        onDismissed?(["reason": "programmatic"])
      }
    }
  }

  @objc public func invalidate() {
    if phase != .hidden {
      finishDismiss(reason: nil)
    }
    onPresented = nil
    onDismissed = nil
    onRequestDismiss = nil
  }

  // MARK: - Presentation

  private func present() {
    guard let appWindow = window,
          let overlayLevel = NativeOverlayLevel(rawValue: level),
          let host = NativeOverlayWindowManager.shared.window(for: overlayLevel, appWindow: appWindow)
    else { return }
    hostWindow = host
    if isSheet {
      presentSheet(in: host)
      return
    }

    let entry = entryView ?? makeEntryView(in: host)
    applyEntryConfiguration(entry)
    insert(entry, into: host)
    if let child = contentChild, child.superview !== entry.contentView {
      entry.contentView.addSubview(child)
    }
    entry.layoutIfNeeded()

    let transition = config.enter.accessibilityAdjusted
    if phase == .hidden {
      entry.contentView.alpha = transition.hidesOpacity ? 0 : 1
      entry.contentView.transform = transition.hiddenTransform(
        contentExtent: entry.contentExtent(),
        bounds: entry.bounds
      )
      entry.backdropView.alpha = 0
    }
    stopAnimators()
    phase = .entering
    if blocking {
      UIAccessibility.post(notification: .screenChanged, argument: entry)
    }

    if transition.kind == .none {
      entry.contentView.alpha = 1
      entry.contentView.transform = .identity
      entry.backdropView.alpha = 1
      phase = .shown
      onPresented?(["stackOrder": stackOrder])
      return
    }
    let contentAnimator = transition.motion.makeAnimator()
    contentAnimator.addAnimations {
      entry.contentView.alpha = 1
      entry.contentView.transform = .identity
    }
    contentAnimator.addCompletion { [weak self] position in
      guard let self, position == .end, self.phase == .entering else { return }
      self.phase = .shown
      self.onPresented?(["stackOrder": self.stackOrder])
    }
    let backdrop = config.backdropMotion.makeAnimator()
    backdrop.addAnimations { entry.backdropView.alpha = 1 }
    animator = contentAnimator
    backdropAnimator = backdrop
    contentAnimator.startAnimation()
    backdrop.startAnimation()
  }

  private func dismiss() {
    if isSheet || sheetController != nil {
      dismissSheet()
      return
    }
    guard let entry = entryView else {
      finishDismiss(reason: "programmatic")
      return
    }
    stopAnimators()
    phase = .exiting
    let transition = config.exit.accessibilityAdjusted
    guard transition.kind != .none else {
      finishDismiss(reason: "programmatic")
      return
    }
    let hiddenTransform = transition.hiddenTransform(
      contentExtent: entry.contentExtent(),
      bounds: entry.bounds
    )
    let contentAnimator = transition.motion.makeAnimator()
    contentAnimator.addAnimations {
      if transition.hidesOpacity {
        entry.contentView.alpha = 0
      }
      entry.contentView.transform = hiddenTransform
    }
    contentAnimator.addCompletion { [weak self] position in
      guard let self, position == .end, self.phase == .exiting else { return }
      self.finishDismiss(reason: "programmatic")
    }
    let backdrop = config.backdropMotion.makeAnimator()
    backdrop.addAnimations { entry.backdropView.alpha = 0 }
    animator = contentAnimator
    backdropAnimator = backdrop
    contentAnimator.startAnimation()
    backdrop.startAnimation()
  }

  /// `reason == nil` tears down without notifying JS (view invalidated).
  private func finishDismiss(reason: String?) {
    stopAnimators()
    phase = .hidden
    teardownSheet()
    if let entry = entryView {
      if let touchHandler, touchHandler.view === entry {
        touchHandler.perform(NSSelectorFromString("detachFromView:"), with: entry)
      }
      stageContent()
      entry.removeFromSuperview()
    }
    entryView = nil
    NativeOverlayWindowManager.shared.entryRemoved(from: hostWindow)
    guard let reason, cycleOpen else { return }
    cycleOpen = visible
    onDismissed?(["reason": reason])
    // Reopened while the exit animation ran; UIKit-initiated dismissals
    // ("system") are left for JS to settle instead.
    if reason == "programmatic", visible, window != nil {
      present()
    }
  }

  private func stopAnimators() {
    // Freeze at the current presentation values so the next run retargets
    // from where the previous one left off.
    [animator, backdropAnimator].forEach { running in
      guard let running, running.state == .active else { return }
      running.stopAnimation(false)
      running.finishAnimation(at: .current)
    }
    animator = nil
    backdropAnimator = nil
  }

  // MARK: - Sheet

  private func sheetStyle() -> NativeOverlaySheetStyle {
    NativeOverlaySheetStyle(
      height: max(sheetHeight, 1),
      backgroundColor: sheetBackgroundColor ?? .systemBackground,
      cornerRadius: max(sheetCornerRadius, 0),
      showHandle: showHandle,
      backdropColor: backdropColor,
      dismissOnBackdropPress: dismissOnBackdropPress,
      enterMotion: config.enter.motion,
      exitMotion: config.exit.motion
    )
  }

  private func presentSheet(in host: UIWindow) {
    guard sheetController == nil,
          let presenter = NativeOverlayWindowManager.shared.presenter(in: host) else { return }
    // UIKit refuses to present while another transition runs in this window.
    if presenter.isBeingPresented || presenter.transitionCoordinator != nil {
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
        guard let self, self.visible, self.phase == .hidden else { return }
        self.present()
      }
      return
    }
    let controller = NativeOverlaySheetController(host: self, style: sheetStyle())
    sheetController = controller
    phase = .entering
    presenter.present(controller, animated: true) { [weak self, weak controller] in
      guard let self, let controller, self.sheetController === controller else { return }
      if self.phase == .entering {
        self.phase = .shown
        self.onPresented?(["stackOrder": self.stackOrder])
      }
      if !self.visible {
        self.dismissSheet()
      }
    }
  }

  private func dismissSheet() {
    guard let controller = sheetController else {
      finishDismiss(reason: "programmatic")
      return
    }
    // Closing mid-presentation is handled by the present completion.
    guard !controller.isBeingPresented, phase != .exiting else { return }
    phase = .exiting
    controller.dismissRequestedByHost = true
    controller.dismiss(animated: true) { [weak self, weak controller] in
      guard let self, self.sheetController === controller else { return }
      self.finishDismiss(reason: "programmatic")
    }
  }

  private func teardownSheet() {
    guard let controller = sheetController else { return }
    if let touchHandler, controller.isViewLoaded, touchHandler.view === controller.view {
      touchHandler.perform(NSSelectorFromString("detachFromView:"), with: controller.view)
    }
    stageContent()
    if controller.presentingViewController != nil, !controller.isBeingDismissed {
      controller.dismissRequestedByHost = true
      controller.dismiss(animated: false)
    }
    sheetController = nil
  }

  // MARK: - Entry view

  private func makeEntryView(in host: UIView) -> NativeOverlayEntryView {
    let entry = NativeOverlayEntryView(frame: host.bounds)
    entry.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    entry.onEscape = { [weak self] in
      self?.onRequestDismiss?(["reason": "back"])
    }
    entry.onBackdropTap = { [weak self] in
      guard let self, self.dismissOnBackdropPress, self.phase != .exiting else { return }
      self.onRequestDismiss?(["reason": "backdrop"])
    }
    if let touchHandler, touchHandler.view == nil {
      touchHandler.perform(NSSelectorFromString("attachToView:"), with: entry)
    }
    entryView = entry
    return entry
  }

  private func applyEntryConfiguration(_ entry: NativeOverlayEntryView) {
    entry.stackOrder = stackOrder
    entry.blocking = blocking
    entry.dismissOnBackPress = dismissOnBackPress
    entry.accessibilityViewIsModal = blocking
    entry.backdropView.backgroundColor = backdropColor ?? .clear
  }

  /// Keeps entries of one level ordered by `stackOrder`.
  private func insert(_ entry: NativeOverlayEntryView, into host: UIView) {
    if entry.superview === host { return }
    entry.frame = host.bounds
    let above = host.subviews
      .compactMap { $0 as? NativeOverlayEntryView }
      .first { $0.stackOrder > entry.stackOrder }
    if let above {
      host.insertSubview(entry, belowSubview: above)
    } else {
      host.addSubview(entry)
    }
  }
}

extension NativeOverlayContainerView: NativeOverlaySheetHost {
  func sheetDidLoad(_ controller: NativeOverlaySheetController) {
    if let touchHandler, touchHandler.view == nil {
      touchHandler.perform(NSSelectorFromString("attachToView:"), with: controller.view)
    }
    if let child = contentChild {
      child.removeFromSuperview()
      controller.view.addSubview(child)
    }
  }

  func sheetDidDismissInteractively(_ controller: NativeOverlaySheetController) {
    guard sheetController === controller else { return }
    // Already off screen: tear down, then let JS close the entry; the next
    // visible=false commit reports onDismissed.
    finishDismiss(reason: nil)
    onRequestDismiss?(["reason": "pan"])
  }

  func sheetDidDisappearUnexpectedly(_ controller: NativeOverlaySheetController) {
    guard sheetController === controller else { return }
    finishDismiss(reason: "system")
  }

  func sheetRequestedDismiss(_ controller: NativeOverlaySheetController, reason: String) {
    guard sheetController === controller, phase != .exiting else { return }
    if reason == "back", !dismissOnBackPress { return }
    onRequestDismiss?(["reason": reason])
  }
}
