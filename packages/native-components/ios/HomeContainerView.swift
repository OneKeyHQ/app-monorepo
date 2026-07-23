import UIKit
import Skeleton

private enum HomeContainerMetrics {
  // Provisional same-state Legacy/Native A/B measurements. Debug UI verification remains authoritative.
  static let legacyABUnifiedBottomInsetReduction: CGFloat = 36

  static var contentSizeScale: CGFloat {
    let scaled = UIFontMetrics(forTextStyle: .body).scaledValue(for: 1)
    return min(max(scaled, 1), 1.4)
  }

  static func scaledHeight(_ value: CGFloat, maximumScale: CGFloat = 1.4) -> CGFloat {
    value * min(contentSizeScale, maximumScale)
  }

  static var tabHeight: CGFloat { scaledHeight(60, maximumScale: 1.25) }
  static var compactHeaderHeight: CGFloat { scaledHeight(60, maximumScale: 1.25) }
  static var compactAccountTopInset: CGFloat { scaledHeight(16, maximumScale: 1.25) }
  static var headerBottomPadding: CGFloat { scaledHeight(40, maximumScale: 1.25) }
  static var legacyABZeroBalanceActionTrailingCompaction: CGFloat { scaledHeight(14) }
  static var rowHeight: CGFloat { scaledHeight(68) }
  static var nftRowHeight: CGFloat { scaledHeight(92) }
  static var emptyRowHeight: CGFloat { scaledHeight(108) }
  static var horizontalRowHeight: CGFloat { scaledHeight(132) }
  static var sectionTitleHeight: CGFloat { scaledHeight(56) }
  static var marketSegmentHeight: CGFloat {
    max(scaledHeight(32), ceil(HomeContainerTypography.medium(14).lineHeight) + 12)
  }
  static var marketTabsRowHeight: CGFloat { marketSegmentHeight + scaledHeight(16) }
  static let footerSlotIds = ["upgrade", "support", "historyEnd"]

  static func contentHeaderHeight(tabId: String) -> CGFloat? {
    switch tabId {
    case "portfolio", "defi": return scaledHeight(56)
    case "perps": return scaledHeight(88)
    default: return nil
    }
  }

  static func footerSlotHeight(key: String) -> CGFloat? {
    if key.hasSuffix(".upgrade") { return scaledHeight(152) }
    if key.hasSuffix(".support") { return scaledHeight(371) }
    if key.hasSuffix(".historyEnd") { return scaledHeight(136) }
    return nil
  }
}

private extension UIImage {
  func homeContainerThumbnail(size: CGFloat) -> UIImage {
    if #available(iOS 15.0, *),
       let thumbnail = preparingThumbnail(of: CGSize(width: size, height: size)) {
      return thumbnail
    }
    let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
    return renderer.image { _ in
      draw(in: CGRect(x: 0, y: 0, width: size, height: size))
    }
  }
}

private extension UIColor {
  var homeContainerSignature: String {
    var red: CGFloat = 0
    var green: CGFloat = 0
    var blue: CGFloat = 0
    var alpha: CGFloat = 0
    guard getRed(&red, green: &green, blue: &blue, alpha: &alpha) else {
      return description
    }
    return String(format: "%.4f:%.4f:%.4f:%.4f", red, green, blue, alpha)
  }
}

private func homeContainerSkeletonGradientColors(
  theme: HomeContainerTheme
) -> [String] {
  let background = UIColor(
    homeContainerColor: theme.backgroundColor,
    fallback: .systemBackground
  )
  var red: CGFloat = 0
  var green: CGFloat = 0
  var blue: CGFloat = 0
  var alpha: CGFloat = 0
  let resolved = background.resolvedColor(
    with: UITraitCollection.current
  )
  guard resolved.getRed(&red, green: &green, blue: &blue, alpha: &alpha) else {
    return ["#fafafa", "#cdcdcd"]
  }
  let luminance = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue)
  return luminance < 0.5
    ? ["#111111", "#333333"]
    : ["#fafafa", "#cdcdcd"]
}

private extension SkeletonNativeView {
  func applyHomeContainerSkeletonTheme(_ theme: HomeContainerTheme) {
    configure(
      shimmerSpeed: 3,
      shimmerGradientColors: homeContainerSkeletonGradientColors(theme: theme)
    )
  }
}

private extension UIView {
  func homeContainerEnableDynamicTypeRecursively() {
    if let label = self as? UILabel {
      label.adjustsFontForContentSizeCategory = true
    }
    if let button = self as? UIButton {
      button.titleLabel?.adjustsFontForContentSizeCategory = true
    }
    subviews.forEach { $0.homeContainerEnableDynamicTypeRecursively() }
  }
}

private enum HomeContainerIcons {
  static let lowValueSolid: UIImage = {
    let renderer = UIGraphicsImageRenderer(size: CGSize(width: 40, height: 40))
    return renderer.image { context in
      context.cgContext.translateBy(x: 8, y: 8)
      UIColor.black.setFill()

      let topRing = UIBezierPath(ovalIn: CGRect(x: 8.25, y: 2, width: 7.5, height: 7.5))
      topRing.append(UIBezierPath(ovalIn: CGRect(x: 10.25, y: 4, width: 3.5, height: 3.5)))
      topRing.usesEvenOddFillRule = true
      topRing.fill()

      UIBezierPath(ovalIn: CGRect(x: 2, y: 8.25, width: 7.5, height: 7.5)).fill()
      UIBezierPath(ovalIn: CGRect(x: 14.5, y: 8.25, width: 7.5, height: 7.5)).fill()
      UIBezierPath(ovalIn: CGRect(x: 8.25, y: 14.5, width: 7.5, height: 7.5)).fill()
    }.withRenderingMode(.alwaysTemplate)
  }()

  static let riskSolid: UIImage = {
    let renderer = UIGraphicsImageRenderer(size: CGSize(width: 40, height: 40))
    return renderer.image { context in
      context.cgContext.translateBy(x: 8, y: 8)
      UIColor.black.setFill()

      let path = UIBezierPath()
      path.move(to: CGPoint(x: 23.256, y: 20))
      path.addLine(to: CGPoint(x: 0.742, y: 20))
      path.addLine(to: CGPoint(x: 12, y: 1.041))
      path.close()
      path.move(to: CGPoint(x: 11, y: 15))
      path.addLine(to: CGPoint(x: 11, y: 17))
      path.addLine(to: CGPoint(x: 13, y: 17))
      path.addLine(to: CGPoint(x: 13, y: 15))
      path.close()
      path.move(to: CGPoint(x: 11, y: 9))
      path.addLine(to: CGPoint(x: 11, y: 14))
      path.addLine(to: CGPoint(x: 13, y: 14))
      path.addLine(to: CGPoint(x: 13, y: 9))
      path.close()
      path.usesEvenOddFillRule = true
      path.fill()
    }.withRenderingMode(.alwaysTemplate)
  }()

  static let questionmarkOutline: UIImage = {
    let size: CGFloat = 20
    let scale = size / 24
    let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
    return renderer.image { context in
      context.cgContext.scaleBy(x: scale, y: scale)
      UIColor.black.setFill()

      let question = UIBezierPath()
      question.move(to: CGPoint(x: 13, y: 17.01))
      question.addLine(to: CGPoint(x: 11, y: 17.01))
      question.addLine(to: CGPoint(x: 11, y: 15))
      question.addLine(to: CGPoint(x: 13, y: 15))
      question.close()
      question.move(to: CGPoint(x: 15, y: 11))
      question.addLine(to: CGPoint(x: 13, y: 12.499))
      question.addLine(to: CGPoint(x: 13, y: 14))
      question.addLine(to: CGPoint(x: 11, y: 14))
      question.addLine(to: CGPoint(x: 11, y: 11.5))
      question.addLine(to: CGPoint(x: 13, y: 10))
      question.addLine(to: CGPoint(x: 13, y: 9))
      question.addLine(to: CGPoint(x: 11, y: 9))
      question.addLine(to: CGPoint(x: 11, y: 10))
      question.addLine(to: CGPoint(x: 9, y: 10))
      question.addLine(to: CGPoint(x: 9, y: 7))
      question.addLine(to: CGPoint(x: 15, y: 7))
      question.close()
      question.fill()

      let ring = UIBezierPath(ovalIn: CGRect(x: 2, y: 2, width: 20, height: 20))
      ring.append(UIBezierPath(ovalIn: CGRect(x: 4, y: 4, width: 16, height: 16)))
      ring.usesEvenOddFillRule = true
      ring.fill()
    }.withRenderingMode(.alwaysTemplate)
  }()

  static let arrowRightOutline: UIImage = {
    let size: CGFloat = 20
    let scale = size / 24
    let path = UIBezierPath()
    path.move(to: CGPoint(x: 21.414, y: 12))
    path.addLine(to: CGPoint(x: 14, y: 19.414))
    path.addLine(to: CGPoint(x: 12.586, y: 18))
    path.addLine(to: CGPoint(x: 17.586, y: 13))
    path.addLine(to: CGPoint(x: 3, y: 13))
    path.addLine(to: CGPoint(x: 3, y: 11))
    path.addLine(to: CGPoint(x: 17.586, y: 11))
    path.addLine(to: CGPoint(x: 12.586, y: 6))
    path.addLine(to: CGPoint(x: 14, y: 4.586))
    path.close()

    let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
    return renderer.image { context in
      context.cgContext.scaleBy(x: scale, y: scale)
      UIColor.black.setFill()
      path.fill()
    }.withRenderingMode(.alwaysTemplate)
  }()

  static let gasSolid: UIImage = {
    let size: CGFloat = 20
    let scale = size / 24
    let path = UIBezierPath()
    path.move(to: CGPoint(x: 15 * scale, y: 9 * scale))
    path.addLine(to: CGPoint(x: 19 * scale, y: 9 * scale))
    path.addLine(to: CGPoint(x: 19 * scale, y: 16 * scale))
    path.addLine(to: CGPoint(x: 20 * scale, y: 16 * scale))
    path.addLine(to: CGPoint(x: 20 * scale, y: 8.414 * scale))
    path.addLine(to: CGPoint(x: 17.586 * scale, y: 6 * scale))
    path.addLine(to: CGPoint(x: 19 * scale, y: 4.586 * scale))
    path.addLine(to: CGPoint(x: 22 * scale, y: 7.586 * scale))
    path.addLine(to: CGPoint(x: 22 * scale, y: 18 * scale))
    path.addLine(to: CGPoint(x: 17 * scale, y: 18 * scale))
    path.addLine(to: CGPoint(x: 17 * scale, y: 11 * scale))
    path.addLine(to: CGPoint(x: 15 * scale, y: 11 * scale))
    path.addLine(to: CGPoint(x: 15 * scale, y: 19 * scale))
    path.addLine(to: CGPoint(x: 16 * scale, y: 19 * scale))
    path.addLine(to: CGPoint(x: 16 * scale, y: 21 * scale))
    path.addLine(to: CGPoint(x: 2 * scale, y: 21 * scale))
    path.addLine(to: CGPoint(x: 2 * scale, y: 19 * scale))
    path.addLine(to: CGPoint(x: 3 * scale, y: 19 * scale))
    path.addLine(to: CGPoint(x: 3 * scale, y: 3 * scale))
    path.addLine(to: CGPoint(x: 15 * scale, y: 3 * scale))
    path.close()
    path.move(to: CGPoint(x: 6 * scale, y: 9 * scale))
    path.addLine(to: CGPoint(x: 6 * scale, y: 11 * scale))
    path.addLine(to: CGPoint(x: 12 * scale, y: 11 * scale))
    path.addLine(to: CGPoint(x: 12 * scale, y: 9 * scale))
    path.close()
    path.usesEvenOddFillRule = true

    return UIGraphicsImageRenderer(
      size: CGSize(width: size, height: size)
    ).image { _ in
      UIColor.black.setFill()
      path.fill()
    }.withRenderingMode(.alwaysTemplate)
  }()

  static let plusSmall: UIImage = {
    let size: CGFloat = 18
    let scale = size / 24
    let path = UIBezierPath()
    path.move(to: CGPoint(x: 13 * scale, y: 11 * scale))
    path.addLine(to: CGPoint(x: 18 * scale, y: 11 * scale))
    path.addLine(to: CGPoint(x: 18 * scale, y: 13 * scale))
    path.addLine(to: CGPoint(x: 13 * scale, y: 13 * scale))
    path.addLine(to: CGPoint(x: 13 * scale, y: 18 * scale))
    path.addLine(to: CGPoint(x: 11 * scale, y: 18 * scale))
    path.addLine(to: CGPoint(x: 11 * scale, y: 13 * scale))
    path.addLine(to: CGPoint(x: 6 * scale, y: 13 * scale))
    path.addLine(to: CGPoint(x: 6 * scale, y: 11 * scale))
    path.addLine(to: CGPoint(x: 11 * scale, y: 11 * scale))
    path.addLine(to: CGPoint(x: 11 * scale, y: 6 * scale))
    path.addLine(to: CGPoint(x: 13 * scale, y: 6 * scale))
    path.close()

    let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
    return renderer.image { _ in
      UIColor.black.setFill()
      path.fill()
    }.withRenderingMode(.alwaysTemplate)
  }()

  static let crossedSmall: UIImage = {
    let size: CGFloat = 20
    let scale = size / 24
    let path = UIBezierPath()
    path.move(to: CGPoint(x: 17.414 * scale, y: 8 * scale))
    path.addLine(to: CGPoint(x: 13.414 * scale, y: 12 * scale))
    path.addLine(to: CGPoint(x: 17.414 * scale, y: 16 * scale))
    path.addLine(to: CGPoint(x: 16 * scale, y: 17.414 * scale))
    path.addLine(to: CGPoint(x: 12 * scale, y: 13.414 * scale))
    path.addLine(to: CGPoint(x: 8 * scale, y: 17.414 * scale))
    path.addLine(to: CGPoint(x: 6.586 * scale, y: 16 * scale))
    path.addLine(to: CGPoint(x: 10.586 * scale, y: 12 * scale))
    path.addLine(to: CGPoint(x: 6.586 * scale, y: 8 * scale))
    path.addLine(to: CGPoint(x: 8 * scale, y: 6.586 * scale))
    path.addLine(to: CGPoint(x: 12 * scale, y: 10.586 * scale))
    path.addLine(to: CGPoint(x: 16 * scale, y: 6.586 * scale))
    path.close()

    let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
    return renderer.image { _ in
      UIColor.black.setFill()
      path.fill()
    }.withRenderingMode(.alwaysTemplate)
  }()
}

struct HomeContainerSlotCellUpdatePlan: Equatable {
  let reloadRowIds: [String]
  let reconfigureRowIds: [String]
}

enum HomeContainerSlotCellUpdatePlanner {
  static func stateSlotCellKindChanged(
    previousMountedSlotKeys: Set<String>,
    nextMountedSlotKeys: Set<String>,
    tabId: String
  ) -> Bool {
    previousMountedSlotKeys
      .symmetricDifference(nextMountedSlotKeys)
      .contains("content.state.\(tabId)")
  }

  static func makePlan(
    currentRowIds: [String],
    existingRowIds: Set<String>,
    stateRowIds: Set<String>,
    changedRowIds: Set<String>,
    reloadsStateSlotRows: Bool
  ) -> HomeContainerSlotCellUpdatePlan {
    let currentRowIdSet = Set(currentRowIds)
    let reloadRowIdSet = reloadsStateSlotRows
      ? stateRowIds.intersection(existingRowIds).intersection(currentRowIdSet)
      : []
    let reconfigureRowIdSet = changedRowIds
      .intersection(existingRowIds)
      .intersection(currentRowIdSet)
      .subtracting(reloadRowIdSet)
    return HomeContainerSlotCellUpdatePlan(
      reloadRowIds: currentRowIds.filter(reloadRowIdSet.contains),
      reconfigureRowIds: currentRowIds.filter(reconfigureRowIdSet.contains)
    )
  }
}

private enum HomeContainerAccessibilityIdentifier {
  static func tabIdentifier(for tabId: String) -> String {
    switch tabId {
    case "portfolio": return "native-home-tab-spot"
    case "perps": return "native-home-tab-perps"
    case "defi": return "native-home-tab-defi"
    case "nft": return "native-home-tab-nft"
    case "history": return "native-home-tab-history"
    default: return "native-home-tab-\(tabId)"
    }
  }
}

private struct HomeContainerRow {
  enum Kind {
    case grid([HomeContainerItem])
    case horizontal(HomeContainerSection)
    case item(HomeContainerItem)
    case marketRecommendations([HomeContainerItem])
    case sectionTitle(HomeContainerSection)
    case contentHeader(String)
    case footerSlot(String)
  }

  let id: String
  let kind: Kind

  var contentSignature: String {
    switch kind {
    case .grid(let items):
      return items.map { item in
        [
          item.id,
          item.title,
          item.subtitle ?? "",
          item.subtitleDetail ?? "",
          item.value ?? "",
          item.imageUrl ?? "",
          item.imageUrls?.joined(separator: ",") ?? "",
          item.secondaryImageUrl ?? "",
          item.badgeImageUrl ?? "",
          item.titleAccessoryImageUrl ?? "",
          item.titleAccessoryIcon ?? "",
          item.badges?.joined(separator: ",") ?? "",
        ].joined(separator: ":")
      }.joined(separator: "|")
    case .marketRecommendations(let items):
      return items.map { item in
        [
          item.id,
          item.title,
          item.subtitle ?? "",
          item.imageUrl ?? "",
          item.imageUrls?.joined(separator: ",") ?? "",
          item.badgeImageUrl ?? "",
          item.titleAccessoryImageUrl ?? "",
          item.communityRecognized == true ? "recognized" : "",
          item.favorite == true ? "selected" : "unselected",
          item.actionId ?? "",
        ].joined(separator: ":")
      }.joined(separator: "|")
    case .horizontal(let section):
      return section.items.map { item in
        [
          item.id,
          item.renderer,
          item.title,
          item.subtitle ?? "",
          item.value ?? "",
          item.imageUrl ?? "",
          item.imageUrls?.joined(separator: ",") ?? "",
        ]
          .joined(separator: ":")
      }.joined(separator: "|")
    case .sectionTitle(let section):
      return [
        "section",
        section.title ?? "",
        section.actionTitle ?? "",
        section.actionId ?? "",
        section.actionDisabled == true ? "disabled" : "enabled",
        section.layout ?? "",
      ].joined(separator: "|")
    case .contentHeader(let tabId):
      return "content-header|\(tabId)"
    case .footerSlot(let key):
      return "footer-slot|\(key)"
    case .item(let item):
      let segmentSignature = item.segments?.map { segment in
        [
          segment.id,
          segment.title,
          segment.imageUrl ?? "",
          segment.leadingIcon ?? "",
          segment.iconOnly == true ? "1" : "0",
          segment.selected == true ? "1" : "0",
          segment.actionId,
        ].joined(separator: ":")
      }.joined(separator: ",") ?? ""
      let fields: [String] = [
        item.renderer,
        item.title,
        item.subtitle ?? "",
        item.subtitleDetail ?? "",
        item.subtitleDetailColor ?? "",
        item.value ?? "",
        item.detail ?? "",
        item.imageUrl ?? "",
        item.imageUrls?.joined(separator: ",") ?? "",
        item.secondaryImageUrl ?? "",
        item.badge ?? "",
        item.badges?.joined(separator: ",") ?? "",
        item.badgeImageUrl ?? "",
        item.titleAccessoryImageUrl ?? "",
        item.titleAccessoryIcon ?? "",
        item.communityRecognized == true ? "1" : "0",
        item.accentColor ?? "",
        item.buttonTitle ?? "",
        item.leadingIcon ?? "",
        item.showChevron == true ? "1" : "0",
        item.showDivider == true ? "1" : "0",
        item.actionId ?? "",
        item.favorite == true ? "1" : "0",
        item.favoriteActionId ?? "",
        item.favoriteLabel ?? "",
        segmentSignature,
      ]
      return fields.joined(separator: "|")
    }
  }
}

private extension HomeContainerTheme {
  var contentSignature: String {
    [
      backgroundColor,
      cardColor,
      strongColor ?? "",
      infoBackgroundColor ?? "",
      infoTextColor ?? "",
      hoverColor ?? "",
      activeColor ?? "",
      subduedIconColor ?? "",
      dividerColor,
      primaryTextColor,
      secondaryTextColor,
      accentColor,
      positiveColor,
      negativeColor,
    ].joined(separator: "|")
  }
}

private final class HomeContainerSlotHostView: UIView {
  override init(frame: CGRect) {
    super.init(frame: frame)
    clipsToBounds = true
    // Fabric paragraphs walk native ancestors while resolving coopted labels.
    // Stop that lookup before it reaches UITableView's recursive accessibility label.
    accessibilityLabel = ""
    isAccessibilityElement = false
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    subviews.forEach { $0.frame = bounds }
  }
}

private final class HomeContainerNestedScrollView: UIScrollView, UIGestureRecognizerDelegate {
  override init(frame: CGRect) {
    super.init(frame: frame)
    panGestureRecognizer.delegate = self
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func touchesShouldCancel(in view: UIView) -> Bool {
    true
  }

  override func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
    guard gestureRecognizer === panGestureRecognizer else { return true }
    let velocity = panGestureRecognizer.velocity(in: self)
    return abs(velocity.y) >= abs(velocity.x)
  }

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    otherGestureRecognizer.view is HomeContainerNestedTableView ||
      otherGestureRecognizer.view is HomeContainerHorizontalScrollView ||
      // The native surface lives below React Native's root touch handler. The
      // outer vertical driver must coexist with it so a pan cancels row taps.
      NSStringFromClass(type(of: otherGestureRecognizer)).hasSuffix("RCTSurfaceTouchHandler")
  }
}

private final class HomeContainerNestedTableView: UITableView, UIGestureRecognizerDelegate {
  override init(frame: CGRect, style: UITableView.Style) {
    super.init(frame: frame, style: style)
    panGestureRecognizer.delegate = self
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
    guard gestureRecognizer === panGestureRecognizer else { return true }
    let velocity = panGestureRecognizer.velocity(in: self)
    return abs(velocity.y) >= abs(velocity.x)
  }

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    otherGestureRecognizer.view is HomeContainerNestedScrollView ||
      otherGestureRecognizer.view is HomeContainerHorizontalScrollView
  }
}

private final class HomeContainerVerticalGateGestureRecognizer: UIGestureRecognizer {
  private weak var trackedTouch: UITouch?
  private var initialPoint = CGPoint.zero

  override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
    guard trackedTouch == nil, let touch = touches.first, touches.count == 1 else {
      state = .failed
      return
    }
    trackedTouch = touch
    initialPoint = touch.location(in: view)
  }

  override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
    guard let trackedTouch, touches.contains(trackedTouch) else { return }
    if state == .began || state == .changed {
      state = .changed
      return
    }
    guard state == .possible else { return }
    let point = trackedTouch.location(in: view)
    let deltaX = point.x - initialPoint.x
    let deltaY = point.y - initialPoint.y
    guard max(abs(deltaX), abs(deltaY)) >= 4 else { return }
    state = abs(deltaY) > abs(deltaX) ? .began : .failed
  }

  override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
    guard let trackedTouch, touches.contains(trackedTouch) else { return }
    if state == .began || state == .changed {
      state = .ended
    } else {
      state = .failed
    }
  }

  override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
    state = state == .possible ? .failed : .cancelled
  }

  override func reset() {
    trackedTouch = nil
    initialPoint = .zero
    super.reset()
  }
}

private final class HomeContainerPagerScrollView: UIScrollView, UIGestureRecognizerDelegate {
  let verticalGateGestureRecognizer = HomeContainerVerticalGateGestureRecognizer()

  override init(frame: CGRect) {
    super.init(frame: frame)
    panGestureRecognizer.delegate = self
    verticalGateGestureRecognizer.cancelsTouchesInView = false
    verticalGateGestureRecognizer.delegate = self
    addGestureRecognizer(verticalGateGestureRecognizer)
    panGestureRecognizer.require(toFail: verticalGateGestureRecognizer)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    guard gestureRecognizer === verticalGateGestureRecognizer else { return false }
    return otherGestureRecognizer.view is HomeContainerNestedScrollView ||
      otherGestureRecognizer.view is HomeContainerNestedTableView
  }
}

private class HomeContainerHorizontalScrollView: UIScrollView, UIGestureRecognizerDelegate {
  private let verticalGateGestureRecognizer = HomeContainerVerticalGateGestureRecognizer()

  override init(frame: CGRect) {
    super.init(frame: frame)
    verticalGateGestureRecognizer.cancelsTouchesInView = false
    verticalGateGestureRecognizer.delegate = self
    addGestureRecognizer(verticalGateGestureRecognizer)
    panGestureRecognizer.require(toFail: verticalGateGestureRecognizer)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func touchesShouldCancel(in view: UIView) -> Bool {
    true
  }

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    guard gestureRecognizer === verticalGateGestureRecognizer else { return false }
    return otherGestureRecognizer.view is HomeContainerNestedScrollView ||
      otherGestureRecognizer.view is HomeContainerNestedTableView
  }
}

private final class HomeContainerPagerChildHorizontalScrollView:
  HomeContainerHorizontalScrollView
{
  override init(frame: CGRect) {
    super.init(frame: frame)
    panGestureRecognizer.delegate = self
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    guard window != nil else { return }
    var current = superview
    while let view = current {
      if let scrollView = view as? HomeContainerPagerScrollView {
        scrollView.panGestureRecognizer.require(toFail: panGestureRecognizer)
      }
      current = view.superview
    }
  }

  override func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
    guard gestureRecognizer === panGestureRecognizer else { return true }
    let maximumOffset = max(0, contentSize.width - bounds.width)
    guard maximumOffset > 1 else { return false }
    let velocity = panGestureRecognizer.velocity(in: self)
    // UIScrollView may ask its delegate before a replacement drag has produced
    // a velocity sample. Preserve native deceleration takeover in that state.
    guard max(abs(velocity.x), abs(velocity.y)) > 0.5 else { return true }
    guard abs(velocity.x) > abs(velocity.y) else { return false }
    if contentOffset.x <= 0.5, velocity.x > 0 {
      return false
    }
    if contentOffset.x >= maximumOffset - 0.5, velocity.x < 0 {
      return false
    }
    return true
  }
}

final class HomeContainerView: UIView, UIScrollViewDelegate {
  private enum PagerTransitionState: Equatable {
    case idle
    case dragging(startIndex: Int)
    case settling(targetIndex: Int)
  }

  private enum VerticalScrollOwner {
    case header
    case body
  }

  var onAction: ((String, String, String) -> Void)?
  var onRefresh: ((String, String) -> Void)?
  var onVisibleTabChange: ((String) -> Void)?
  var onRenderError: ((String, String) -> Void)?
  var onIntent: ((String) -> Void)?
  var onTransportResult: ((String) -> Void)?
  @objc dynamic var slotLayoutDidChange: (() -> Void)?

  private let outerScrollView = HomeContainerNestedScrollView()
  private let pager = HomeContainerPagerScrollView()
  private let headerView = HomeContainerHeaderView()
  private let tabsView = HomeContainerTabsView()
  private let refreshControl = UIRefreshControl()
  private let parsingQueue = DispatchQueue(
    label: "so.onekey.home-container.decode",
    qos: .userInitiated
  )
  private let decoder = JSONDecoder()
  private let encoder = JSONEncoder()
  private let lifecycleLock = NSLock()
  private var snapshot: HomeContainerSnapshot?
  private var protocolV2State: HomeContainerProtocolV2State?
  private var protocolV3State: HomeContainerProtocolV3State?
  private var renderedProtocolV2State: HomeContainerProtocolV2State?
  private var renderedProtocolV3State: HomeContainerProtocolV3State?
  private var pendingProtocolV3Patch: HomeContainerProtocolV3PatchEnvelope?
  private var pendingProtocolV3PatchRetryScheduled = false
  private var lastNeedSnapshotResultKey: String?
  private var pages: [HomeContainerPageView] = []
  private var refreshRequestIds = Set<String>()
  private var selectedTabId = ""
  private var disposed = false
  private var debugOverlayEnabled = false
  private var refreshEnabled = false
  private var headerHeight: CGFloat = 0
  private var mountedSlotKeys = Set<String>()
  private var mountedSlotMetadata = [HomeContainerProtocolV3MountedSlotMetadata]()
  private var pagerTransitionState = PagerTransitionState.idle
  private var pendingPagerNotify = false
  private var tabSelectionQueue = HomeContainerTabSelectionQueue()
  private var isCoordinatingNestedScroll = false
  private var isSynchronizingUnifiedVerticalPage = false
  private var pinnedMarketMutationOuterContentOffsetY: CGFloat?
  private var verticalScrollOwner = VerticalScrollOwner.header
  private var isVerticalGestureActive = false

  private var maximumHeaderOffset: CGFloat {
    max(0, headerHeight - HomeContainerMetrics.compactHeaderHeight)
  }

  private var usesUnifiedVerticalDriver: Bool {
    if #available(iOS 17.4, *) {
      return true
    }
    // Older systems intentionally keep the legacy nested-scroll fallback.
    // The stronger single-driver inertia behavior is scoped to iOS 17.4 and newer.
    return false
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    clipsToBounds = true
    outerScrollView.alwaysBounceVertical = true
    outerScrollView.showsVerticalScrollIndicator = false
    outerScrollView.contentInsetAdjustmentBehavior = .never
    outerScrollView.delegate = self
    refreshControl.addTarget(self, action: #selector(refreshRequested), for: .valueChanged)
    outerScrollView.refreshControl = refreshControl
    pager.isPagingEnabled = true
    pager.bounces = false
    pager.showsHorizontalScrollIndicator = false
    pager.isDirectionalLockEnabled = true
    pager.contentInsetAdjustmentBehavior = .never
    pager.delegate = self
    if !usesUnifiedVerticalDriver {
      outerScrollView.panGestureRecognizer.require(toFail: pager.panGestureRecognizer)
    }
    addSubview(outerScrollView)
    outerScrollView.addSubview(headerView)
    outerScrollView.addSubview(pager)
    outerScrollView.addSubview(tabsView)
    headerView.onAction = { [weak self] actionId, itemId in
      guard let self else { return }
      self.emitAction(actionId: actionId, itemId: itemId, tabId: self.selectedTabId)
    }
    tabsView.onSelect = { [weak self] tabId in
      self?.selectTabFromControl(tabId)
    }
    tabsView.onAction = { [weak self] actionId, itemId in
      guard let self else { return }
      self.emitAction(actionId: actionId, itemId: itemId, tabId: self.selectedTabId)
    }
    headerView.onSlotLayoutChange = { [weak self] in
      self?.slotLayoutDidChange?()
    }
    tabsView.onSlotLayoutChange = { [weak self] in
      self?.slotLayoutDidChange?()
    }
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(contentSizeCategoryDidChange),
      name: UIContentSizeCategory.didChangeNotification,
      object: nil
    )
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  @objc private func contentSizeCategoryDidChange() {
    headerView.contentSizeCategoryDidChange()
    headerHeight = headerView.preferredHeight
    homeContainerEnableDynamicTypeRecursively()
    pages.forEach { $0.contentSizeCategoryDidChange() }
    setNeedsLayout()
    layoutIfNeeded()
    slotLayoutDidChange?()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    if usesUnifiedVerticalDriver {
      headerView.transform = .identity
      tabsView.transform = .identity
      pager.transform = .identity
    }
    outerScrollView.frame = bounds
    headerView.frame = CGRect(x: 0, y: 0, width: bounds.width, height: headerHeight)
    let pagerHeight = max(0, bounds.height - HomeContainerMetrics.tabHeight)
    pager.frame = CGRect(
      x: 0,
      y: headerHeight + HomeContainerMetrics.tabHeight,
      width: bounds.width,
      height: pagerHeight
    )
    for (index, page) in pages.enumerated() {
      page.frame = CGRect(
        x: CGFloat(index) * bounds.width,
        y: 0,
        width: bounds.width,
        height: pagerHeight
      )
    }
    pager.contentSize = CGSize(
      width: CGFloat(pages.count) * bounds.width,
      height: pagerHeight
    )
    if let page = pages.first(where: { $0.tabId == selectedTabId }),
       usesUnifiedVerticalDriver {
      updateUnifiedVerticalContentSize(source: page)
    } else {
      outerScrollView.contentSize = CGSize(
        width: bounds.width,
        height: headerHeight + bounds.height
      )
    }
    updateSharedChromeLayout()

    guard pagerTransitionState == .idle,
          let index = pages.firstIndex(where: { $0.tabId == selectedTabId }) else {
      return
    }
    #if DEBUG
    if let value = ProcessInfo.processInfo.environment["ONEKEY_HOME_DEBUG_PAGER_PROGRESS"],
       let progress = Double(value),
       progress > 0,
       progress < 1,
       index + 1 < pages.count {
      pager.contentOffset.x = (CGFloat(index) + CGFloat(progress)) * bounds.width
    } else {
      pager.contentOffset.x = CGFloat(index) * bounds.width
    }
    #else
    pager.contentOffset.x = CGFloat(index) * bounds.width
    #endif
    slotLayoutDidChange?()
  }

  func submitSnapshot(_ json: String) {
    parsingQueue.async { [weak self] in
      guard let self, !self.isDisposed() else { return }
      let data = Data(json.utf8)
      do {
        let probe = try? self.decoder.decode(HomeContainerTransportProbe.self, from: data)
        if probe?.protocolVersion != nil || probe?.kind == "snapshot" {
          if probe?.protocolVersion == 3 {
            let envelope = try self.decoder.decode(
              HomeContainerProtocolV3SnapshotEnvelope.self,
              from: data
            )
            DispatchQueue.main.async { [weak self] in
              self?.pendingProtocolV3Patch = nil
              self?.handleProtocolV3Outcome(
                HomeContainerProtocolV3Transaction.apply(snapshot: envelope)
              )
            }
            return
          }
          guard probe?.protocolVersion == homeContainerProtocolVersion else {
            DispatchQueue.main.async { [weak self] in
              self?.emitNeedSnapshot(
                owner: probe?.owner,
                currentRevision: self?.protocolV2State?.revision,
                reason: .unsupportedProtocol
              )
            }
            return
          }
          guard probe?.schemaVersion == homeContainerBusinessSchemaVersion else {
            DispatchQueue.main.async { [weak self] in
              self?.emitNeedSnapshot(
                owner: probe?.owner,
                currentRevision: self?.protocolV2State?.revision,
                reason: .unsupportedSchema
              )
            }
            return
          }
          let envelope = try self.decoder.decode(
            HomeContainerProtocolV2SnapshotEnvelope.self,
            from: data
          )
          DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.protocolV3State = nil
            self.pendingProtocolV3Patch = nil
            self.handleProtocolV2Outcome(
              HomeContainerProtocolV2Transaction.apply(
                snapshot: envelope,
                current: self.protocolV2State
              )
            )
          }
          return
        }
        let next = try self.decoder.decode(
          HomeContainerSnapshot.self,
          from: data
        )
        guard next.schemaVersion == homeContainerBusinessSchemaVersion else {
          self.reportError(
            code: "unsupported_schema",
            message: "HomeContainer schema \(next.schemaVersion) is not supported"
          )
          return
        }
        guard homeContainerValidatesBusinessInvariants(next) else {
          self.reportError(
            code: "invalid_snapshot",
            message: "HomeContainer snapshot violates business invariants"
          )
          return
        }
        DispatchQueue.main.async { [weak self] in
          guard let self else { return }
          self.protocolV2State = nil
          self.protocolV3State = nil
          self.pendingProtocolV3Patch = nil
          self.lastNeedSnapshotResultKey = nil
          self.applySnapshot(
            next,
            allowsMissingSelectedTabFallback: true,
            enforcesMonotonicRevision: true
          )
        }
      } catch {
        let probe = try? self.decoder.decode(HomeContainerTransportProbe.self, from: data)
        if probe?.protocolVersion != nil || probe?.kind == "snapshot" {
          DispatchQueue.main.async { [weak self] in
            self?.emitNeedSnapshot(
              owner: nil,
              currentRevision: self?.protocolV2State?.revision,
              reason: .invalidInvariant
            )
          }
        } else {
          self.reportError(code: "snapshot_decode_failed", message: error.localizedDescription)
        }
      }
    }
  }

  func submitPatch(_ json: String) {
    parsingQueue.async { [weak self] in
      guard let self, !self.isDisposed() else { return }
      let data = Data(json.utf8)
      do {
        let probe = try? self.decoder.decode(HomeContainerTransportProbe.self, from: data)
        if probe?.protocolVersion != nil || probe?.kind == "patch" {
          if probe?.protocolVersion == 3 {
            let patch = try self.decoder.decode(
              HomeContainerProtocolV3PatchEnvelope.self,
              from: data
            )
            DispatchQueue.main.async { [weak self] in
              guard let self else { return }
              self.applyProtocolV3PatchOrDefer(patch)
            }
            return
          }
          guard probe?.protocolVersion == homeContainerProtocolVersion else {
            DispatchQueue.main.async { [weak self] in
              self?.emitNeedSnapshot(
                owner: probe?.owner,
                currentRevision: self?.protocolV2State?.revision,
                reason: .unsupportedProtocol
              )
            }
            return
          }
          guard probe?.schemaVersion == homeContainerBusinessSchemaVersion else {
            DispatchQueue.main.async { [weak self] in
              self?.emitNeedSnapshot(
                owner: probe?.owner,
                currentRevision: self?.protocolV2State?.revision,
                reason: .unsupportedSchema
              )
            }
            return
          }
          let patch = try self.decoder.decode(
            HomeContainerProtocolV2PatchEnvelope.self,
            from: data
          )
          DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.protocolV3State = nil
            self.pendingProtocolV3Patch = nil
            self.handleProtocolV2Outcome(
              HomeContainerProtocolV2Transaction.apply(
                patch: patch,
                current: self.protocolV2State
              )
            )
          }
          return
        }
        let patch = try self.decoder.decode(
          HomeContainerPatch.self,
          from: data
        )
        guard patch.schemaVersion == homeContainerBusinessSchemaVersion else {
          self.reportError(
            code: "unsupported_schema",
            message: "HomeContainer patch schema \(patch.schemaVersion) is not supported"
          )
          return
        }
        DispatchQueue.main.async { [weak self] in
          self?.applyPatch(patch)
        }
      } catch {
        let probe = try? self.decoder.decode(HomeContainerTransportProbe.self, from: data)
        if probe?.protocolVersion != nil || probe?.kind == "patch" {
          DispatchQueue.main.async { [weak self] in
            self?.emitNeedSnapshot(
              owner: nil,
              currentRevision: self?.protocolV2State?.revision,
              reason: .invalidInvariant
            )
          }
        } else {
          self.reportError(code: "patch_decode_failed", message: error.localizedDescription)
        }
      }
    }
  }

  func completeRefresh(_ requestId: String) {
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      if self.refreshRequestIds.remove(requestId) != nil {
        self.refreshControl.endRefreshing()
      }
    }
  }

  func selectTab(_ tabId: String, animated: Bool) {
    DispatchQueue.main.async { [weak self] in
      self?.moveToTab(tabId, animated: animated, notify: false)
    }
  }

  @objc(setMountedSlotKeys:)
  func setMountedSlotKeys(_ keys: [String]) {
    let nextKeys = Set(keys)
    guard nextKeys != mountedSlotKeys else { return }
    mountedSlotKeys = nextKeys
    headerView.setMountedSlotKeys(nextKeys)
    tabsView.setMountedSlotKeys(nextKeys)
    pages.forEach { $0.setMountedSlotKeys(nextKeys) }
    setNeedsLayout()
    slotLayoutDidChange?()
  }

  @objc(setMountedSlotMetadata:)
  func setMountedSlotMetadata(_ entries: [[String: Any]]) {
    let metadata = entries.compactMap { entry -> HomeContainerProtocolV3MountedSlotMetadata? in
      guard let slotId = entry["slotId"] as? String,
            let ownerScopeKey = entry["ownerScopeKey"] as? String,
            let ownerSessionId = entry["ownerSessionId"] as? String,
            let slotRevisionNumber = entry["slotRevision"] as? NSNumber,
            let producedByStoreCommitIdNumber =
              entry["producedByStoreCommitId"] as? NSNumber,
            let slotRevision = Int(exactly: slotRevisionNumber.doubleValue),
            let producedByStoreCommitId = Int(
              exactly: producedByStoreCommitIdNumber.doubleValue
            )
      else { return nil }
      return HomeContainerProtocolV3MountedSlotMetadata(
        slotId: slotId,
        owner: HomeContainerProtocolV2Owner(
          scopeKey: ownerScopeKey,
          sessionId: ownerSessionId
        ),
        slotRevision: slotRevision,
        producedByStoreCommitId: producedByStoreCommitId
      )
    }
    mountedSlotMetadata = metadata
    setMountedSlotKeys(entries.compactMap { $0["slotId"] as? String })
    schedulePendingProtocolV3PatchRetry()
  }

  private func availableProtocolV3SlotRevisions() -> [String: Int] {
    guard let owner = protocolV3State?.identity.owner else { return [:] }
    return homeContainerProtocolV3AvailableSlotRevisions(
      owner: owner,
      mountedSlots: mountedSlotMetadata
    )
  }

  private func applyProtocolV3PatchOrDefer(
    _ patch: HomeContainerProtocolV3PatchEnvelope
  ) {
    let outcome = HomeContainerProtocolV3Transaction.apply(
      patch: patch,
      current: protocolV3State,
      availableSlotRevisions: availableProtocolV3SlotRevisions()
    )
    if case .needSnapshot(.slotRevisionGap) = outcome {
      pendingProtocolV3Patch = patch
      return
    }
    pendingProtocolV3Patch = nil
    handleProtocolV3Outcome(outcome)
  }

  private func schedulePendingProtocolV3PatchRetry() {
    guard pendingProtocolV3Patch != nil,
          !pendingProtocolV3PatchRetryScheduled else { return }
    pendingProtocolV3PatchRetryScheduled = true
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.pendingProtocolV3PatchRetryScheduled = false
      guard let patch = self.pendingProtocolV3Patch else { return }
      self.applyProtocolV3PatchOrDefer(patch)
    }
  }

  @objc(slotFrameForKey:)
  func slotFrame(forKey key: String) -> NSValue {
    layoutIfNeeded()
    if let host = slotHostView(forKey: key) {
      return NSValue(cgRect: host.convert(host.bounds, to: self))
    }
    return NSValue(cgRect: .zero)
  }

  @objc(slotHostViewForKey:)
  func slotHostView(forKey key: String) -> UIView? {
    if key.hasPrefix("header.") {
      return headerView.slotHostView(forKey: key)
    }
    if key.hasPrefix("tab.") {
      return tabsView.slotHostView(forKey: key)
    }
    if key.hasPrefix("content.") {
      return pages.lazy.compactMap { $0.slotHostView(forKey: key) }.first
    }
    return nil
  }

  func setFallbackBackgroundColor(_ value: String) {
    DispatchQueue.main.async { [weak self] in
      guard let self, self.snapshot == nil else { return }
      let color = UIColor(homeContainerColor: value, fallback: .systemBackground)
      self.backgroundColor = color
      self.pager.backgroundColor = color
    }
  }

  func setDebugOverlayEnabled(_ enabled: Bool) {
    DispatchQueue.main.async { [weak self] in
      self?.debugOverlayEnabled = enabled
      self?.layer.borderWidth = enabled ? 1 : 0
      self?.layer.borderColor = enabled ? UIColor.systemPink.cgColor : nil
    }
  }

  func setRefreshEnabled(_ enabled: Bool) {
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.refreshEnabled = enabled
      self.refreshControl.isEnabled = self.usesUnifiedVerticalDriver
        ? enabled
        : enabled && self.verticalScrollOwner == .header
    }
  }

  func dispose() {
    lifecycleLock.lock()
    disposed = true
    lifecycleLock.unlock()
  }

  private func applySnapshot(
    _ next: HomeContainerSnapshot,
    allowsMissingSelectedTabFallback: Bool,
    enforcesMonotonicRevision: Bool,
    completion: (() -> Void)? = nil
  ) {
    guard !isDisposed() else { return }
    guard homeContainerValidatesBusinessInvariants(next) else { return }
    if enforcesMonotonicRevision,
       let current = snapshot,
       next.revision < current.revision {
      return
    }
    if !allowsMissingSelectedTabFallback,
       !next.tabs.contains(where: { $0.id == next.selectedTabId }) {
      return
    }

    snapshot = next
    backgroundColor = UIColor(
      homeContainerColor: next.theme.backgroundColor,
      fallback: .systemBackground
    )
    pager.backgroundColor = backgroundColor

    headerView.apply(header: next.header, theme: next.theme)
    headerHeight = headerView.preferredHeight
    tabsView.apply(tabs: next.tabs, selectedTabId: next.selectedTabId, theme: next.theme)

    var oldPages: [String: HomeContainerPageView] = [:]
    for page in pages where oldPages[page.tabId] == nil {
      oldPages[page.tabId] = page
    }
    var nextPages: [HomeContainerPageView] = []
    let inlineTabs = next.tabs.filter { $0.destination == .inline }
    let renderGroup = DispatchGroup()
    for tab in inlineTabs {
      let page = oldPages[tab.id] ?? makePage(tabId: tab.id)
      renderGroup.enter()
      page.apply(
        tab: tab,
        theme: next.theme,
        completion: renderGroup.leave
      )
      nextPages.append(page)
      if page.superview == nil {
        pager.addSubview(page)
      }
    }

    let nextIds = Set(nextPages.map(\.tabId))
    for page in pages where !nextIds.contains(page.tabId) {
      page.removeFromSuperview()
    }
    pages = nextPages

    let requestedTab: String
    if inlineTabs.contains(where: { $0.id == next.selectedTabId }) {
      requestedTab = next.selectedTabId
    } else if allowsMissingSelectedTabFallback {
      requestedTab = inlineTabs.first?.id ?? ""
    } else {
      return
    }
    selectedTabId = requestedTab
    updateSelectedTab(requestedTab)
    homeContainerEnableDynamicTypeRecursively()
    setNeedsLayout()
    layoutIfNeeded()
    if let completion {
      renderGroup.notify(queue: .main, execute: completion)
    }
  }

  private func applyPatch(_ patch: HomeContainerPatch) {
    guard let current = snapshot, patch.revision >= current.revision else {
      return
    }
    let validTabIds = Set(
      current.tabs.lazy.filter { $0.destination == .inline }.map(\.id)
    )
    let patchedTabIds = patch.tabs.map(\.tabId)
    guard Set(patchedTabIds).count == patchedTabIds.count,
          patch.tabs.allSatisfy({ validTabIds.contains($0.tabId) }) else { return }

    let next = current.applying(patch)
    guard homeContainerValidatesBusinessInvariants(next) else { return }
    snapshot = next
    if let header = patch.header {
      let previousHeaderHeight = headerHeight
      headerView.apply(header: header, theme: next.theme)
      headerHeight = headerView.preferredHeight
      if abs(previousHeaderHeight - headerHeight) > 0.5 {
        setNeedsLayout()
      }
      updateSharedChromeLayout()
    }
    for tabPatch in patch.tabs {
      guard let page = pages.first(where: { $0.tabId == tabPatch.tabId }) else { continue }
      page.updateSections(tabPatch.sections)
    }
  }

  private func applyProtocolV2Patch(
    _ next: HomeContainerSnapshot,
    renderPlan: HomeContainerProtocolV2RenderPlan,
    completion: @escaping () -> Void
  ) {
    guard !isDisposed(), homeContainerValidatesBusinessInvariants(next) else { return }
    snapshot = next

    if renderPlan.shouldApplySurface {
      let nextBackgroundColor = UIColor(
        homeContainerColor: next.theme.backgroundColor,
        fallback: .systemBackground
      )
      backgroundColor = nextBackgroundColor
      pager.backgroundColor = nextBackgroundColor
    }

    if renderPlan.shouldBindHeader || renderPlan.shouldApplySurface {
      let previousHeaderHeight = headerHeight
      headerView.apply(header: next.header, theme: next.theme)
      headerHeight = headerView.preferredHeight
      if abs(previousHeaderHeight - headerHeight) > 0.5 {
        setNeedsLayout()
      }
    }
    if renderPlan.shouldReconcileNavigation || renderPlan.shouldApplySurface {
      tabsView.apply(
        tabs: next.tabs,
        selectedTabId: next.selectedTabId,
        theme: next.theme
      )
    }

    let renderGroup = DispatchGroup()
    if renderPlan.shouldReconcileNavigation {
      let oldPages = Dictionary(
        pages.map { ($0.tabId, $0) },
        uniquingKeysWith: { first, _ in first }
      )
      var nextPages = [HomeContainerPageView]()
      for tab in next.tabs where tab.destination == .inline {
        let existingPage = oldPages[tab.id]
        let page = existingPage ?? makePage(tabId: tab.id)
        if existingPage == nil || renderPlan.shouldApplySurface ||
          renderPlan.sectionTabIds.contains(tab.id)
        {
          renderGroup.enter()
          page.apply(tab: tab, theme: next.theme, completion: renderGroup.leave)
        }
        if page.superview == nil {
          pager.addSubview(page)
        }
        nextPages.append(page)
      }
      let nextIds = Set(nextPages.map(\.tabId))
      pages.filter { !nextIds.contains($0.tabId) }.forEach { $0.removeFromSuperview() }
      pages = nextPages
      selectedTabId = next.selectedTabId
      updateSelectedTab(next.selectedTabId)
      homeContainerEnableDynamicTypeRecursively()
    } else if renderPlan.shouldApplySurface {
      let tabsById = Dictionary(
        uniqueKeysWithValues: next.tabs.map { ($0.id, $0) }
      )
      pages.forEach { page in
        guard let tab = tabsById[page.tabId] else { return }
        renderGroup.enter()
        page.apply(tab: tab, theme: next.theme, completion: renderGroup.leave)
      }
    } else {
      renderPlan.sectionTabIds.forEach { tabId in
        guard let tab = next.tabs.first(where: { $0.id == tabId }),
              let page = pages.first(where: { $0.tabId == tabId })
        else { return }
        renderGroup.enter()
        page.updateSections(tab.sections, completion: renderGroup.leave)
      }
    }

    if renderPlan.shouldBindHeader || renderPlan.shouldReconcileNavigation ||
      renderPlan.shouldApplySurface
    {
      updateSharedChromeLayout()
    }
    setNeedsLayout()
    layoutIfNeeded()
    renderGroup.notify(queue: .main, execute: completion)
  }

  private func makePage(tabId: String) -> HomeContainerPageView {
    let page = HomeContainerPageView(tabId: tabId)
    page.setUnifiedVerticalDriverEnabled(usesUnifiedVerticalDriver)
    page.requirePagerPanToFail(pager.panGestureRecognizer)
    page.setMountedSlotKeys(mountedSlotKeys)
    page.onAction = { [weak self] actionId, itemId, sourceTabId in
      self?.emitAction(actionId: actionId, itemId: itemId, tabId: sourceTabId)
    }
    if !usesUnifiedVerticalDriver {
      page.onContentOffsetChange = { [weak self] source in
        self?.coordinateNestedScroll(source: source)
      }
      page.onBeginDragging = { [weak self] source in
        self?.beginVerticalGesture(source: source)
      }
      page.onEndDragging = { [weak self] source in
        self?.endVerticalGesture(source: source)
      }
    }
    page.onSlotLayoutChange = { [weak self, weak page] in
      if let page {
        self?.updateUnifiedVerticalContentSize(source: page)
      }
      self?.slotLayoutDidChange?()
    }
    page.onContentSizeChange = { [weak self, weak page] in
      guard let self, let page else { return }
      self.updateUnifiedVerticalContentSize(source: page)
    }
    page.onMarketMutationPinChange = { [weak self, weak page] isPinned in
      guard let self, let page else { return }
      if isPinned {
        self.beginUnifiedMarketMutationPin(source: page)
      } else {
        self.finishUnifiedMarketMutationPin(source: page)
      }
    }
    return page
  }

  private func moveToTab(_ tabId: String, animated: Bool, notify: Bool) {
    guard let tab = snapshot?.tabs.first(where: { $0.id == tabId }) else { return }
    if tab.destination == .handoff {
      emitHandoff(tab: tab)
      return
    }
    guard let index = pages.firstIndex(where: { $0.tabId == tabId }) else { return }
    guard pagerTransitionState == .idle else {
      tabSelectionQueue.replacePending(
        with: HomeContainerTabSelectionRequest(
          tabId: tabId,
          animated: animated,
          notify: notify
        )
      )
      return
    }
    let targetPage = pages[index]
    preparePagesForPagerTransition()
    pagerTransitionState = .settling(targetIndex: index)
    pendingPagerNotify = notify
    if usesUnifiedVerticalDriver {
      updateUnifiedVerticalContentSize(source: targetPage)
    }
    let targetOffset = CGPoint(x: CGFloat(index) * pager.bounds.width, y: 0)
    pager.setContentOffset(targetOffset, animated: animated)
    if !animated || abs(pager.contentOffset.x - targetOffset.x) <= 0.5 {
      finishPaging(notify: notify)
    }
  }

  private func selectTabFromControl(_ tabId: String) {
    guard let tab = snapshot?.tabs.first(where: { $0.id == tabId }) else { return }
    if tab.destination == .handoff {
      emitHandoff(tab: tab)
      return
    }
    guard pages.contains(where: { $0.tabId == tabId }) else { return }
    if pagerTransitionState == .idle, selectedTabId == tabId {
      return
    }
    emitTabSelection(tabId: tabId)
    moveToTab(tabId, animated: true, notify: false)
  }

  private func preparePagesForPagerTransition() {
    pages.forEach { $0.layoutIfNeeded() }
  }

  private func updateSelectedTab(_ tabId: String) {
    tabsView.setSelectedTab(tabId)
  }

  func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
    if scrollView === outerScrollView {
      pinnedMarketMutationOuterContentOffsetY = nil
      pages.first(where: { $0.tabId == selectedTabId })?
        .cancelMarketMutationContentOffsetPin()
      if !usesUnifiedVerticalDriver,
         let page = pages.first(where: { $0.tabId == selectedTabId }) {
        beginVerticalGesture(source: page)
      }
      return
    }
    guard scrollView === pager,
          let startIndex = pages.firstIndex(where: { $0.tabId == selectedTabId }) else { return }
    pagerTransitionState = .dragging(startIndex: startIndex)
    pendingPagerNotify = true
    preparePagesForPagerTransition()
  }

  func scrollViewDidScroll(_ scrollView: UIScrollView) {
    guard scrollView === outerScrollView else { return }
    coordinateOuterScroll()
  }

  func scrollViewDidEndDragging(_ scrollView: UIScrollView, willDecelerate decelerate: Bool) {
    if scrollView === outerScrollView {
      if usesUnifiedVerticalDriver {
        if !decelerate {
          settleUnifiedVerticalOffsetIfNeeded()
        }
      } else if let page = pages.first(where: { $0.tabId == selectedTabId }) {
        endVerticalGesture(source: page)
      }
      return
    }
    if scrollView === pager, !decelerate {
      finishPaging(notify: pendingPagerNotify)
    }
  }

  func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) {
    if scrollView === outerScrollView {
      settleUnifiedVerticalOffsetIfNeeded()
      return
    }
    if scrollView === pager {
      finishPaging(notify: pendingPagerNotify)
    }
  }

  func scrollViewDidEndScrollingAnimation(_ scrollView: UIScrollView) {
    if scrollView === pager {
      finishPaging(notify: pendingPagerNotify)
    }
  }

  private func finishPaging(notify: Bool) {
    guard pager.bounds.width > 0,
          !pages.isEmpty else { return }
    let index = max(
      0,
      min(pages.count - 1, Int(round(pager.contentOffset.x / pager.bounds.width)))
    )
    let targetPage = pages[index]
    targetPage.layoutIfNeeded()
    let preservedTargetBodyOffset = max(
      0,
      min(targetPage.bodyContentOffset, targetPage.maximumBodyContentOffset)
    )
    let nextTabId = targetPage.tabId
    let didChangeTab = nextTabId != selectedTabId
    pagerTransitionState = .idle
    pendingPagerNotify = false
    selectedTabId = nextTabId
    updateSelectedTab(nextTabId)
    if usesUnifiedVerticalDriver {
      synchronizeUnifiedVerticalPage(
        source: targetPage,
        preservedBodyOffset: preservedTargetBodyOffset
      )
    } else {
      synchronizeVerticalScrollOwner(source: pages[index])
      coordinateNestedScroll(source: pages[index])
    }
    slotLayoutDidChange?()
    if notify, didChangeTab {
      emitTabSelection(tabId: nextTabId)
    }
    if let pendingSelection = tabSelectionQueue.takePending(),
       pendingSelection.tabId != nextTabId {
      moveToTab(
        pendingSelection.tabId,
        animated: pendingSelection.animated,
        notify: pendingSelection.notify
      )
    }
  }

  private func updateSharedChromeLayout() {
    tabsView.transform = .identity
    let combinedOffset = outerScrollView.contentOffset.y
    let pinnedOffset = max(0, min(combinedOffset, maximumHeaderOffset))
    headerView.setPinnedOffset(pinnedOffset)
    tabsView.frame = CGRect(
      x: 0,
      y: headerHeight,
      width: bounds.width,
      height: HomeContainerMetrics.tabHeight
    )
    if usesUnifiedVerticalDriver {
      let bodyOffset = max(0, combinedOffset - maximumHeaderOffset)
      let compensation = CGAffineTransform(translationX: 0, y: bodyOffset)
      headerView.transform = compensation
      tabsView.transform = compensation
      pager.transform = compensation
      if !isSynchronizingUnifiedVerticalPage {
        pages.first(where: { $0.tabId == selectedTabId })?.setBodyContentOffset(bodyOffset)
      }
    }
    outerScrollView.bringSubviewToFront(tabsView)
  }

  private func updateUnifiedVerticalContentSize(source: HomeContainerPageView) {
    guard usesUnifiedVerticalDriver,
          bounds.height > 0 else { return }
    let bodyRange: CGFloat
    switch pagerTransitionState {
    case .idle:
      guard source.tabId == selectedTabId else { return }
      source.layoutIfNeeded()
      bodyRange = source.maximumBodyContentOffset
    case .dragging, .settling:
      pages.forEach { $0.layoutIfNeeded() }
      bodyRange = pages.map(\.maximumBodyContentOffset).max() ?? 0
    }
    let requiredPinnedContentHeight = pinnedMarketMutationOuterContentOffsetY.map {
      bounds.height + $0
    } ?? 0
    outerScrollView.contentSize = CGSize(
      width: bounds.width,
      height: max(
        bounds.height + maximumHeaderOffset + bodyRange,
        requiredPinnedContentHeight
      )
    )
    if let pinnedOffsetY = pinnedMarketMutationOuterContentOffsetY {
      if abs(outerScrollView.contentOffset.y - pinnedOffsetY) > 0.5 {
        outerScrollView.contentOffset.y = pinnedOffsetY
        updateSharedChromeLayout()
      }
      return
    }
    let maximumOffset = max(0, outerScrollView.contentSize.height - outerScrollView.bounds.height)
    if pagerTransitionState == .idle,
       !outerScrollView.isTracking,
       !outerScrollView.isDragging,
       !outerScrollView.isDecelerating,
       outerScrollView.contentOffset.y > maximumOffset {
      outerScrollView.contentOffset.y = maximumOffset
      updateSharedChromeLayout()
    }
  }

  private func settleUnifiedVerticalOffsetIfNeeded() {
    guard usesUnifiedVerticalDriver,
          let page = pages.first(where: { $0.tabId == selectedTabId }) else { return }
    updateUnifiedVerticalContentSize(source: page)
  }

  private func beginUnifiedMarketMutationPin(source: HomeContainerPageView) {
    guard usesUnifiedVerticalDriver,
          source.tabId == selectedTabId,
          pinnedMarketMutationOuterContentOffsetY == nil,
          !outerScrollView.isTracking,
          !outerScrollView.isDragging,
          !outerScrollView.isDecelerating else { return }
    pinnedMarketMutationOuterContentOffsetY = outerScrollView.contentOffset.y
  }

  private func finishUnifiedMarketMutationPin(source: HomeContainerPageView) {
    guard usesUnifiedVerticalDriver,
          source.tabId == selectedTabId,
          let pinnedOffsetY = pinnedMarketMutationOuterContentOffsetY else { return }
    pinnedMarketMutationOuterContentOffsetY = nil
    updateUnifiedVerticalContentSize(source: source)
    let maximumOffset = max(
      0,
      outerScrollView.contentSize.height - outerScrollView.bounds.height
    )
    outerScrollView.contentOffset.y = min(pinnedOffsetY, maximumOffset)
    updateSharedChromeLayout()
  }

  private func synchronizeUnifiedVerticalPage(
    source: HomeContainerPageView,
    preservedBodyOffset: CGFloat? = nil
  ) {
    guard usesUnifiedVerticalDriver, source.tabId == selectedTabId else { return }
    isSynchronizingUnifiedVerticalPage = true
    defer { isSynchronizingUnifiedVerticalPage = false }
    updateUnifiedVerticalContentSize(source: source)
    let bodyOffset = max(
      0,
      min(preservedBodyOffset ?? source.bodyContentOffset, source.maximumBodyContentOffset)
    )
    let headerOffset = bodyOffset > 0.5
      ? maximumHeaderOffset
      : max(0, min(outerScrollView.contentOffset.y, maximumHeaderOffset))
    source.setBodyContentOffset(bodyOffset)
    outerScrollView.contentOffset.y = headerOffset + bodyOffset
    updateSharedChromeLayout()
  }

  private func coordinateOuterScroll() {
    if usesUnifiedVerticalDriver {
      updateSharedChromeLayout()
      return
    }
    guard !isCoordinatingNestedScroll else { return }
    isCoordinatingNestedScroll = true
    defer { isCoordinatingNestedScroll = false }
    let maximumOffset = maximumHeaderOffset
    guard let page = pages.first(where: { $0.tabId == selectedTabId }) else {
      updateSharedChromeLayout()
      return
    }
    var targetOffset = outerScrollView.contentOffset.y
    let velocityY = outerScrollView.panGestureRecognizer.velocity(in: outerScrollView).y
    switch verticalScrollOwner {
    case .header:
      if targetOffset > maximumOffset {
        targetOffset = maximumOffset
      }
      if targetOffset >= maximumOffset - 0.5, velocityY < 0 {
        targetOffset = maximumOffset
        verticalScrollOwner = .body
        refreshControl.isEnabled = false
      }
    case .body:
      if page.bodyContentOffset <= 0.5,
         velocityY > 0 {
        verticalScrollOwner = .header
        refreshControl.isEnabled = refreshEnabled
        targetOffset = min(targetOffset, maximumOffset)
      } else {
        targetOffset = maximumOffset
      }
    }
    if abs(targetOffset - outerScrollView.contentOffset.y) > 0.5 {
      outerScrollView.contentOffset.y = targetOffset
    }
    updateSharedChromeLayout()
  }

  private func coordinateNestedScroll(source: HomeContainerPageView) {
    guard source.tabId == selectedTabId, !isCoordinatingNestedScroll else { return }
    isCoordinatingNestedScroll = true
    defer { isCoordinatingNestedScroll = false }
    let maximumOffset = maximumHeaderOffset
    let pageVelocity = source.panVelocityY
    if source.bodyContentOffset < 0 {
      source.setBodyContentOffset(0)
    }
    switch verticalScrollOwner {
    case .header:
      if source.bodyContentOffset > 0.5 {
        source.setBodyContentOffset(0)
      }
      if outerScrollView.contentOffset.y >= maximumOffset - 0.5,
         pageVelocity < 0 {
        outerScrollView.contentOffset.y = maximumOffset
        verticalScrollOwner = .body
        refreshControl.isEnabled = false
      }
    case .body:
      if outerScrollView.contentOffset.y < maximumOffset - 0.5 {
        outerScrollView.contentOffset.y = maximumOffset
      }
      if source.bodyContentOffset <= 0.5, pageVelocity > 0 {
        source.setBodyContentOffset(0)
        verticalScrollOwner = .header
        refreshControl.isEnabled = refreshEnabled
      }
    }
    updateSharedChromeLayout()
  }

  private func beginVerticalGesture(source: HomeContainerPageView) {
    guard source.tabId == selectedTabId, !isVerticalGestureActive else { return }
    isVerticalGestureActive = true
    let maximumOffset = maximumHeaderOffset
    let outerVelocity = outerScrollView.panGestureRecognizer.velocity(in: outerScrollView).y
    let bodyVelocity = source.panVelocityY
    let velocityY = abs(bodyVelocity) > abs(outerVelocity) ? bodyVelocity : outerVelocity
    if source.bodyContentOffset > 0.5 {
      verticalScrollOwner = .body
    } else if outerScrollView.contentOffset.y < maximumOffset - 0.5 {
      verticalScrollOwner = .header
    } else {
      verticalScrollOwner = velocityY > 0 ? .header : .body
    }
    refreshControl.isEnabled = refreshEnabled && verticalScrollOwner == .header
  }

  private func endVerticalGesture(source: HomeContainerPageView) {
    guard source.tabId == selectedTabId else { return }
    isVerticalGestureActive = false
    refreshControl.isEnabled = refreshEnabled && verticalScrollOwner == .header
  }

  private func synchronizeVerticalScrollOwner(source: HomeContainerPageView) {
    isVerticalGestureActive = false
    if source.bodyContentOffset > 0.5 {
      verticalScrollOwner = .body
    } else if outerScrollView.contentOffset.y < maximumHeaderOffset - 0.5 {
      verticalScrollOwner = .header
    }
    refreshControl.isEnabled = refreshEnabled && verticalScrollOwner == .header
  }

  @objc private func refreshRequested() {
    let bodyContentOffset = pages.first(where: {
      $0.tabId == selectedTabId
    })?.bodyContentOffset ?? 0
    let canRefresh = usesUnifiedVerticalDriver
      ? outerScrollView.contentOffset.y <= 0.5
      : verticalScrollOwner == .header && bodyContentOffset <= 0.5
    guard refreshEnabled, canRefresh else {
      refreshControl.endRefreshing()
      return
    }
    let requestId = UUID().uuidString
    refreshRequestIds.insert(requestId)
    emitRefresh(tabId: selectedTabId, requestId: requestId)
  }

  private func handleProtocolV3Outcome(_ outcome: HomeContainerProtocolV3ApplyOutcome) {
    guard !isDisposed() else { return }
    switch outcome {
    case .applied(let state, let renderPlan):
      if renderPlan.isFullSnapshot {
        pendingProtocolV3Patch = nil
      }
      if protocolV3State?.identity.owner != state.identity.owner {
        renderedProtocolV2State = nil
        renderedProtocolV3State = nil
      }
      protocolV3State = state
      protocolV2State = state.legacyState
      lastNeedSnapshotResultKey = nil
      let completion = { [weak self] in
        guard let self,
              self.protocolV3State?.identity == state.identity,
              self.protocolV3State?.transportRevision == state.transportRevision
        else { return }
        self.renderedProtocolV2State = state.legacyState
        self.renderedProtocolV3State = state
        self.emitTransportResult(
          .applied(owner: state.identity.owner, revision: state.transportRevision)
        )
      }
      if renderPlan.isFullSnapshot {
        applySnapshot(
          state.snapshot,
          allowsMissingSelectedTabFallback: false,
          enforcesMonotonicRevision: false,
          completion: completion
        )
      } else {
        applyProtocolV2Patch(
          state.snapshot,
          renderPlan: renderPlan,
          completion: completion
        )
      }
    case .duplicate(let state):
      guard renderedProtocolV3State?.identity == state.identity,
            renderedProtocolV3State?.transportRevision == state.transportRevision
      else { return }
      emitTransportResult(
        .duplicate(owner: state.identity.owner, revision: state.transportRevision)
      )
    case .needSnapshot(let reason):
      pendingProtocolV3Patch = nil
      renderedProtocolV2State = nil
      renderedProtocolV3State = nil
      let legacyReason: HomeContainerProtocolV2NeedSnapshotReason
      switch reason {
      case .ownerMismatch:
        legacyReason = .ownerMismatch
      case .revisionGap:
        legacyReason = .revisionGap
      case .unsupportedProtocol:
        legacyReason = .unsupportedProtocol
      case .invalidInvariant, .slotRevisionGap:
        legacyReason = .invalidInvariant
      }
      emitNeedSnapshot(
        owner: protocolV3State?.identity.owner,
        currentRevision: protocolV3State?.transportRevision,
        reason: legacyReason
      )
    }
  }

  private func handleProtocolV2Outcome(_ outcome: HomeContainerProtocolV2ApplyOutcome) {
    guard !isDisposed() else { return }
    switch outcome {
    case .applied(let state, let renderPlan):
      if protocolV2State?.owner != state.owner {
        renderedProtocolV2State = nil
      }
      protocolV2State = state
      lastNeedSnapshotResultKey = nil
      let completion = { [weak self] in
        guard let self,
              self.protocolV2State?.owner == state.owner,
              self.protocolV2State?.revision == state.revision
        else { return }
        self.renderedProtocolV2State = state
        self.emitTransportResult(.applied(owner: state.owner, revision: state.revision))
      }
      if renderPlan.isFullSnapshot {
        applySnapshot(
          state.snapshot,
          allowsMissingSelectedTabFallback: false,
          enforcesMonotonicRevision: false,
          completion: completion
        )
      } else {
        applyProtocolV2Patch(
          state.snapshot,
          renderPlan: renderPlan,
          completion: completion
        )
      }
    case let .duplicate(owner, revision):
      guard renderedProtocolV2State?.owner == owner,
            renderedProtocolV2State?.revision == revision
      else { return }
      emitTransportResult(.duplicate(owner: owner, revision: revision))
    case let .needSnapshot(owner, currentRevision, reason):
      renderedProtocolV2State = nil
      emitNeedSnapshot(
        owner: owner,
        currentRevision: currentRevision,
        reason: reason
      )
    }
  }

  private func emitAction(actionId: String, itemId: String, tabId: String) {
    if let state = renderedProtocolV3State {
      let authority: HomeContainerProtocolV3IntentAuthority
      if homeContainerHeaderContainsCommand(state.snapshot.header, commandId: actionId) {
        authority = .shellCommands(
          revision: state.authorityRevisions.shellCommands
        )
      } else {
        let sectionId =
          actionId.hasPrefix("home.widget.market") || actionId.hasPrefix("home.market.")
          ? "market" : tabId
        guard
          let revision = state.authorityRevisions.sectionCommands[sectionId]
        else {
          return
        }
        authority = .sectionCommands(sectionId: sectionId, revision: revision)
      }
      emitProtocolV3Intent(
        state: state,
        authority: authority,
        payload: .action(commandId: actionId, itemId: itemId)
      )
      return
    }
    guard let state = renderedProtocolV2State else {
      onAction?(actionId, itemId, tabId)
      return
    }
    emitIntent(
      state: state,
      payload: .action(commandId: actionId, itemId: itemId)
    )
  }

  private func emitRefresh(tabId: String, requestId: String) {
    if let state = renderedProtocolV3State,
      let revision = state.authorityRevisions.sectionCommands[tabId]
    {
      emitProtocolV3Intent(
        state: state,
        authority: .sectionCommands(sectionId: tabId, revision: revision),
        payload: .refresh(tabId: tabId, requestId: requestId)
      )
      return
    }
    guard let state = renderedProtocolV2State else {
      onRefresh?(tabId, requestId)
      return
    }
    emitIntent(
      state: state,
      payload: .refresh(tabId: tabId, requestId: requestId)
    )
  }

  private func emitTabSelection(tabId: String) {
    guard let currentState = renderedProtocolV2State else {
      onVisibleTabChange?(tabId)
      return
    }
    guard currentState.snapshot.tabs.contains(where: {
      $0.id == tabId && $0.destination == .inline
    }) else {
      return
    }
    let selectedSnapshot = HomeContainerSnapshot(
      schemaVersion: currentState.snapshot.schemaVersion,
      revision: currentState.snapshot.revision,
      selectedTabId: tabId,
      header: currentState.snapshot.header,
      tabs: currentState.snapshot.tabs,
      theme: currentState.snapshot.theme
    )
    let selectedState = HomeContainerProtocolV2State(
      owner: currentState.owner,
      revision: currentState.revision,
      snapshot: selectedSnapshot
    )
    snapshot = selectedSnapshot
    protocolV2State = selectedState
    renderedProtocolV2State = selectedState
    if let state = renderedProtocolV3State {
      let selectedV3State = HomeContainerProtocolV3State(
        identity: state.identity,
        transportRevision: state.transportRevision,
        presentationRevisions: state.presentationRevisions,
        authorityRevisions: state.authorityRevisions,
        slotRevisions: state.slotRevisions,
        legacyState: selectedState
      )
      protocolV3State = selectedV3State
      renderedProtocolV3State = selectedV3State
      emitProtocolV3Intent(
        state: state,
        authority: .tabApplicability(
          revision: state.authorityRevisions.tabApplicability
        ),
        payload: .selectTab(tabId: tabId)
      )
      return
    }
    emitIntent(state: selectedState, payload: .selectTab(tabId: tabId))
  }

  private func emitHandoff(tab: HomeContainerTab) {
    guard tab.destination == .handoff,
          let commandId = tab.handoffCommandId,
          !commandId.isEmpty else { return }
    if let state = renderedProtocolV3State {
      emitProtocolV3Intent(
        state: state,
        authority: .tabApplicability(
          revision: state.authorityRevisions.tabApplicability
        ),
        payload: .handoff(tabId: tab.id, commandId: commandId)
      )
      return
    }
    guard let state = renderedProtocolV2State else {
      onAction?(commandId, tab.id, selectedTabId)
      return
    }
    emitIntent(
      state: state,
      payload: .handoff(tabId: tab.id, commandId: commandId)
    )
  }

  private func emitIntent(
    state: HomeContainerProtocolV2State,
    payload: HomeContainerProtocolV2Intent.Payload
  ) {
    let intent = HomeContainerProtocolV2Intent(
      intentId: UUID().uuidString,
      owner: state.owner,
      renderedRevision: state.revision,
      intent: payload
    )
    guard let data = try? encoder.encode(intent),
          let json = String(data: data, encoding: .utf8) else {
      reportError(code: "intent_encode_failed", message: "Unable to encode native intent")
      return
    }
    onIntent?(json)
  }

  private func emitProtocolV3Intent(
    state: HomeContainerProtocolV3State,
    authority: HomeContainerProtocolV3IntentAuthority,
    payload: HomeContainerProtocolV3IntentPayload
  ) {
    let intent = HomeContainerProtocolV3Intent(
      protocolVersion: 3,
      intentId: UUID().uuidString,
      owner: state.identity.owner,
      authority: authority,
      intent: payload
    )
    guard intent.isValid(against: state),
          let data = try? encoder.encode(intent),
          let json = String(data: data, encoding: .utf8) else {
      reportError(code: "intent_encode_failed", message: "Unable to encode native intent")
      return
    }
    onIntent?(json)
  }

  private func emitNeedSnapshot(
    owner: HomeContainerProtocolV2Owner?,
    currentRevision: Int?,
    reason: HomeContainerProtocolV2NeedSnapshotReason
  ) {
    let result = HomeContainerProtocolV2TransportResult.needSnapshot(
      owner: owner,
      currentRevision: currentRevision,
      reason: reason
    )
    guard result.coalescingKey != lastNeedSnapshotResultKey else { return }
    lastNeedSnapshotResultKey = result.coalescingKey
    emitTransportResult(result)
  }

  private func emitTransportResult(_ result: HomeContainerProtocolV2TransportResult) {
    guard let data = try? encoder.encode(result),
          let json = String(data: data, encoding: .utf8) else {
      reportError(
        code: "transport_result_encode_failed",
        message: "Unable to encode native transport result"
      )
      return
    }
    onTransportResult?(json)
  }

  private func reportError(code: String, message: String) {
    DispatchQueue.main.async { [weak self] in
      self?.onRenderError?(code, message)
    }
  }

  private func isDisposed() -> Bool {
    lifecycleLock.lock()
    defer { lifecycleLock.unlock() }
    return disposed
  }
}

private final class HomeContainerPageView: UIView, UITableViewDelegate {
  let tabId: String
  var onAction: ((String, String, String) -> Void)?
  var onContentOffsetChange: ((HomeContainerPageView) -> Void)?
  var onBeginDragging: ((HomeContainerPageView) -> Void)?
  var onEndDragging: ((HomeContainerPageView) -> Void)?
  var onSlotLayoutChange: (() -> Void)?
  var onContentSizeChange: (() -> Void)?
  var onMarketMutationPinChange: ((Bool) -> Void)?

  private let tableView = HomeContainerNestedTableView(frame: .zero, style: .plain)
  private var rowsById: [String: HomeContainerRow] = [:]
  private lazy var dataSource = makeDataSource()
  private var theme: HomeContainerTheme?
  private var themeSignature = ""
  private var sections: [HomeContainerSection] = []
  private var suppressContentOffsetCallback = false
  private var marketMutationContentOffsetPinDepth = 0
  private var pinnedMarketMutationContentOffsetY: CGFloat?
  private var mountedSlotKeys = Set<String>()
  private var visibleSlotHosts: [String: HomeContainerSlotHostView] = [:]
  private var contentSizeObservation: NSKeyValueObservation?

  var bodyContentOffset: CGFloat {
    tableView.contentOffset.y
  }

  var maximumBodyContentOffset: CGFloat {
    max(
      0,
      tableView.contentSize.height + tableView.adjustedContentInset.bottom - tableView.bounds.height
    )
  }

  var panVelocityY: CGFloat {
    tableView.panGestureRecognizer.velocity(in: tableView).y
  }

  init(tabId: String) {
    self.tabId = tabId
    super.init(frame: .zero)
    tableView.backgroundColor = .clear
    tableView.separatorStyle = .none
    tableView.showsVerticalScrollIndicator = false
    tableView.alwaysBounceVertical = false
    tableView.bounces = false
    tableView.contentInsetAdjustmentBehavior = .never
    tableView.contentInset.bottom = 112
    tableView.verticalScrollIndicatorInsets.bottom = 112
    tableView.delegate = self
    if #available(iOS 15.0, *) {
      tableView.sectionHeaderTopPadding = 0
    }
    tableView.register(HomeContainerItemCell.self, forCellReuseIdentifier: "item")
    tableView.register(HomeContainerSectionTitleCell.self, forCellReuseIdentifier: "section")
    tableView.register(HomeContainerHorizontalCell.self, forCellReuseIdentifier: "horizontal")
    tableView.register(HomeContainerNFTGridCell.self, forCellReuseIdentifier: "grid")
    tableView.register(
      HomeContainerMarketRecommendationGridCell.self,
      forCellReuseIdentifier: "market-recommendations"
    )
    tableView.register(HomeContainerSlotHostCell.self, forCellReuseIdentifier: "slot-host")
    addSubview(tableView)
    _ = dataSource
    contentSizeObservation = tableView.observe(\.contentSize, options: [.new]) {
      [weak self] _, _ in
      DispatchQueue.main.async { [weak self] in
        self?.onContentSizeChange?()
      }
    }
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    tableView.frame = bounds
  }

  func apply(
    tab: HomeContainerTab,
    theme: HomeContainerTheme,
    completion: (() -> Void)? = nil
  ) {
    let nextThemeSignature = theme.contentSignature
    let shouldReconfigureAllRows = !themeSignature.isEmpty && themeSignature != nextThemeSignature
    themeSignature = nextThemeSignature
    self.theme = theme
    backgroundColor = UIColor(
      homeContainerColor: theme.backgroundColor,
      fallback: .systemBackground
    )
    updateSections(
      tab.sections,
      forceReconfigureAll: shouldReconfigureAllRows,
      completion: completion
    )
  }

  func updateSections(
    _ sections: [HomeContainerSection],
    forceReconfigureAll: Bool = false,
    completion: (() -> Void)? = nil
  ) {
    self.sections = sections
    rebuildRows(forceReconfigureAll: forceReconfigureAll, completion: completion)
  }

  func setMountedSlotKeys(_ keys: Set<String>) {
    guard mountedSlotKeys != keys else { return }
    let reloadsStateSlotRows = HomeContainerSlotCellUpdatePlanner.stateSlotCellKindChanged(
      previousMountedSlotKeys: mountedSlotKeys,
      nextMountedSlotKeys: keys,
      tabId: tabId
    )
    if reloadsStateSlotRows {
      visibleSlotHosts.removeValue(forKey: "content.state.\(tabId)")
    }
    mountedSlotKeys = keys
    rebuildRows(reloadsStateSlotRows: reloadsStateSlotRows)
  }

  private func rebuildRows(
    forceReconfigureAll: Bool = false,
    reloadsStateSlotRows: Bool = false,
    completion: (() -> Void)? = nil
  ) {
    var rows: [HomeContainerRow] = []
    if mountedSlotKeys.contains("content.header.\(tabId)"),
       HomeContainerMetrics.contentHeaderHeight(tabId: tabId) != nil {
      rows.append(HomeContainerRow(id: "content-header:\(tabId)", kind: .contentHeader(tabId)))
    }
    rows.append(contentsOf: sections.flatMap { section -> [HomeContainerRow] in
      var result: [HomeContainerRow] = []
      if let title = section.title, !title.isEmpty {
        result.append(HomeContainerRow(id: "section:\(section.id)", kind: .sectionTitle(section)))
      }
      if section.layout == "marketRecommendations" {
        var itemIndex = 0
        while itemIndex < section.items.count {
          let item = section.items[itemIndex]
          guard item.renderer == "market" else {
            result.append(HomeContainerRow(
              id: "item:\(section.id):\(item.id)",
              kind: .item(item)
            ))
            itemIndex += 1
            continue
          }
          var recommendationItems = [item]
          if section.items.indices.contains(itemIndex + 1),
             section.items[itemIndex + 1].renderer == "market" {
            recommendationItems.append(section.items[itemIndex + 1])
          }
          result.append(HomeContainerRow(
            id: "market-recommendations:\(section.id):\(itemIndex)",
            kind: .marketRecommendations(recommendationItems)
          ))
          itemIndex += recommendationItems.count
        }
      } else if section.layout == "grid" {
        var itemIndex = 0
        while itemIndex < section.items.count {
          let endIndex = min(itemIndex + 2, section.items.count)
          result.append(HomeContainerRow(
            id: "grid:\(section.id):\(itemIndex / 2)",
            kind: .grid(Array(section.items[itemIndex..<endIndex]))
          ))
          itemIndex += 2
        }
      } else if section.layout == "horizontal" {
        result.append(HomeContainerRow(id: "horizontal:\(section.id)", kind: .horizontal(section)))
      } else {
        result.append(contentsOf: section.items.map {
          HomeContainerRow(id: "item:\(section.id):\($0.id)", kind: .item($0))
        })
      }
      return result
    })
    HomeContainerMetrics.footerSlotIds.forEach { footerId in
      let key = "content.footer.\(tabId).\(footerId)"
      if mountedSlotKeys.contains(key), HomeContainerMetrics.footerSlotHeight(key: key) != nil {
        rows.append(HomeContainerRow(id: "footer-slot:\(key)", kind: .footerSlot(key)))
      }
    }
    let previousRows = rowsById
    rowsById = Dictionary(uniqueKeysWithValues: rows.map { ($0.id, $0) })
    var nextSnapshot = NSDiffableDataSourceSnapshot<Int, String>()
    nextSnapshot.appendSections([0])
    nextSnapshot.appendItems(rows.map(\.id), toSection: 0)
    let changedIds = rows.compactMap { row -> String? in
      if forceReconfigureAll {
        return previousRows[row.id] == nil ? nil : row.id
      }
      guard let previous = previousRows[row.id],
            previous.contentSignature != row.contentSignature else { return nil }
      return row.id
    }
    let existingRowIds = Set(dataSource.snapshot().itemIdentifiers)
    let stateRowIds = Set(rows.compactMap { row -> String? in
      guard case .item(let item) = row.kind,
            item.renderer == "empty" || item.renderer == "loading" else { return nil }
      return row.id
    })
    let cellUpdatePlan = HomeContainerSlotCellUpdatePlanner.makePlan(
      currentRowIds: rows.map(\.id),
      existingRowIds: existingRowIds,
      stateRowIds: stateRowIds,
      changedRowIds: Set(changedIds),
      reloadsStateSlotRows: reloadsStateSlotRows
    )
    if #available(iOS 15.0, *) {
      nextSnapshot.reloadItems(cellUpdatePlan.reloadRowIds)
      nextSnapshot.reconfigureItems(cellUpdatePlan.reconfigureRowIds)
    } else {
      nextSnapshot.reloadItems(
        cellUpdatePlan.reloadRowIds + cellUpdatePlan.reconfigureRowIds
      )
    }
    let isMarketMutation = shouldAnimateMarketMutation(
      previousRows: previousRows,
      nextRows: rowsById,
      changedIds: changedIds
    )
    // Keep the original smooth transition for both category selection and
    // favorite mutations while pinning the outer content offset.
    let animatesMarketMutation = isMarketMutation
    // DeFi data settles after the initial single-network portfolio snapshot.
    // Animate its structural rows so Market moves in one continuous direction
    // instead of being replaced by the inserted section in a single frame.
    let animatesPortfolioDeFiMutation = shouldAnimatePortfolioDeFiMutation(
      previousRows: previousRows,
      nextRows: rowsById
    )
    let animatesPortfolioAssetsMutation = shouldAnimatePortfolioAssetsMutation(
      previousRows: previousRows,
      nextRows: rowsById
    )
    let updatesStateRowHeight = stateRowHeightChanged(
      previousRows: previousRows,
      nextRows: rowsById
    )
    let pinsMarketMutationContentOffset = isMarketMutation &&
      !tableView.isTracking &&
      !tableView.isDragging &&
      !tableView.isDecelerating
    if pinsMarketMutationContentOffset {
      beginMarketMutationContentOffsetPin()
    }
    dataSource.apply(
      nextSnapshot,
      animatingDifferences: cellUpdatePlan.reloadRowIds.isEmpty &&
        (
          animatesMarketMutation ||
            animatesPortfolioDeFiMutation ||
            animatesPortfolioAssetsMutation
        )
    ) { [weak self] in
      DispatchQueue.main.async {
        guard let self else { return }
        self.restorePinnedMarketMutationContentOffset()
        self.pinnedMarketMutationContentOffsetY = nil
        if updatesStateRowHeight {
          UIView.performWithoutAnimation {
            self.tableView.beginUpdates()
            self.tableView.endUpdates()
          }
        }
        self.tableView.layoutIfNeeded()
        self.refreshVisibleSlotHosts()
        self.onSlotLayoutChange?()
        if pinsMarketMutationContentOffset {
          self.finishMarketMutationContentOffsetPin()
        }
        completion?()
      }
    }
    restorePinnedMarketMutationContentOffset()
  }

  private func shouldAnimateMarketMutation(
    previousRows: [String: HomeContainerRow],
    nextRows: [String: HomeContainerRow],
    changedIds: [String]
  ) -> Bool {
    let previousIds = Set(previousRows.keys)
    let nextIds = Set(nextRows.keys)
    let structuralIds = previousIds.symmetricDifference(nextIds)
    let hasFavoriteMutation = changedIds.contains { id in
      guard isMarketMutationRowId(id),
            case .item(let previousItem) = previousRows[id]?.kind,
            case .item(let nextItem) = nextRows[id]?.kind else { return false }
      return previousItem.favorite != nextItem.favorite
    }
    guard !structuralIds.isEmpty || hasFavoriteMutation,
          structuralIds.allSatisfy(isMarketMutationRowId) else { return false }
    // Unified Store refreshes may reconfigure prices and Earn rows in the
    // same snapshot. Only structural changes can affect the Market height.
    return true
  }

  private func shouldAnimatePortfolioDeFiMutation(
    previousRows: [String: HomeContainerRow],
    nextRows: [String: HomeContainerRow]
  ) -> Bool {
    let structuralIds = Set(previousRows.keys).symmetricDifference(nextRows.keys)
    return !structuralIds.isEmpty && structuralIds.allSatisfy(isPortfolioDeFiMutationRowId)
  }

  private func shouldAnimatePortfolioAssetsMutation(
    previousRows: [String: HomeContainerRow],
    nextRows: [String: HomeContainerRow]
  ) -> Bool {
    let structuralIds = Set(previousRows.keys).symmetricDifference(nextRows.keys)
    return !structuralIds.isEmpty && structuralIds.allSatisfy(isPortfolioAssetsMutationRowId)
  }

  private func stateRowHeightChanged(
    previousRows: [String: HomeContainerRow],
    nextRows: [String: HomeContainerRow]
  ) -> Bool {
    nextRows.contains { id, nextRow in
      guard let previousRow = previousRows[id],
            case .item(let previousItem) = previousRow.kind,
            case .item(let nextItem) = nextRow.kind,
            previousItem.renderer == "empty" || previousItem.renderer == "loading",
            nextItem.renderer == "empty" || nextItem.renderer == "loading" else {
        return false
      }
      let previousHeight = previousItem.displayHeight ?? HomeContainerMetrics.emptyRowHeight
      let nextHeight = nextItem.displayHeight ?? HomeContainerMetrics.emptyRowHeight
      return abs(previousHeight - nextHeight) > 0.5
    }
  }

  private func isMarketMutationRowId(_ id: String) -> Bool {
    id.hasPrefix("item:portfolio-market:market:") ||
      id.hasPrefix("item:portfolio-market:spot:") ||
      id.hasPrefix("item:portfolio-market:perps:") ||
      id == "item:portfolio-market:market-tabs" ||
      id == "item:portfolio-market:market-show-more" ||
      id.hasPrefix("market-recommendations:portfolio-market:")
  }

  private func isPortfolioDeFiMutationRowId(_ id: String) -> Bool {
    id.hasPrefix("section:portfolio-defi-") ||
      id.hasPrefix("item:portfolio-defi-")
  }

  private func isPortfolioAssetsMutationRowId(_ id: String) -> Bool {
    id.hasPrefix("item:portfolio-assets:") ||
      id.hasPrefix("item:portfolio-assets-hidden-groups:") ||
      id == "item:portfolio-assets-add-token:portfolio-assets-add-token" ||
      id == "item:portfolio-assets-toggle:portfolio-assets-toggle"
  }

  private func restorePinnedMarketMutationContentOffset() {
    guard let offsetY = pinnedMarketMutationContentOffsetY,
          abs(tableView.contentOffset.y - offsetY) > 0.5 else { return }
    suppressContentOffsetCallback = true
    tableView.contentOffset.y = offsetY
    suppressContentOffsetCallback = false
  }

  private func beginMarketMutationContentOffsetPin() {
    marketMutationContentOffsetPinDepth += 1
    guard marketMutationContentOffsetPinDepth == 1 else { return }
    pinnedMarketMutationContentOffsetY = tableView.contentOffset.y
    onMarketMutationPinChange?(true)
  }

  private func finishMarketMutationContentOffsetPin() {
    guard marketMutationContentOffsetPinDepth > 0 else { return }
    marketMutationContentOffsetPinDepth -= 1
    guard marketMutationContentOffsetPinDepth == 0 else { return }
    restorePinnedMarketMutationContentOffset()
    pinnedMarketMutationContentOffsetY = nil
    onMarketMutationPinChange?(false)
  }

  func cancelMarketMutationContentOffsetPin() {
    guard marketMutationContentOffsetPinDepth > 0 else { return }
    marketMutationContentOffsetPinDepth = 0
    pinnedMarketMutationContentOffsetY = nil
    onMarketMutationPinChange?(false)
  }

  private func refreshVisibleSlotHosts() {
    var nextVisibleSlotHosts: [String: HomeContainerSlotHostView] = [:]
    tableView.visibleCells.forEach { cell in
      guard let slotCell = cell as? HomeContainerSlotHostCell,
            !slotCell.slotKey.isEmpty,
            mountedSlotKeys.contains(slotCell.slotKey) else { return }
      nextVisibleSlotHosts[slotCell.slotKey] = slotCell.slotHostView
    }
    visibleSlotHosts = nextVisibleSlotHosts
  }

  func slotHostView(forKey key: String) -> UIView? {
    guard key.contains(".\(tabId)") else { return nil }
    return visibleSlotHosts[key]
  }

  func setBodyContentOffset(_ value: CGFloat) {
    let clampedValue = max(0, min(value, maximumBodyContentOffset))
    guard abs(tableView.contentOffset.y - clampedValue) > 0.5 else { return }
    suppressContentOffsetCallback = true
    tableView.contentOffset.y = clampedValue
    suppressContentOffsetCallback = false
  }

  func contentSizeCategoryDidChange() {
    homeContainerEnableDynamicTypeRecursively()
    tableView.reloadData()
    tableView.layoutIfNeeded()
    onContentSizeChange?()
  }

  func setUnifiedVerticalDriverEnabled(_ enabled: Bool) {
    // Keep the floating-tab-bar clearance, but do not reserve the entire compact
    // header again. The unified viewport already accounts for most of that
    // collapsed region; only the measured residual is needed at the settled end.
    let unifiedInset = max(
      112,
      112 + HomeContainerMetrics.compactHeaderHeight -
        HomeContainerMetrics.legacyABUnifiedBottomInsetReduction
    )
    let bottomInset = enabled ? unifiedInset : 112
    tableView.contentInset.bottom = bottomInset
    tableView.verticalScrollIndicatorInsets.bottom = bottomInset
    tableView.isScrollEnabled = !enabled
    tableView.scrollsToTop = !enabled
  }

  func requirePagerPanToFail(_ pagerPan: UIPanGestureRecognizer) {
    tableView.panGestureRecognizer.require(toFail: pagerPan)
  }

  private func slotKey(for row: HomeContainerRow) -> String? {
    switch row.kind {
    case .contentHeader(let tabId):
      return "content.header.\(tabId)"
    case .footerSlot(let key):
      return key
    case .item(let item):
      let key = "content.state.\(tabId)"
      guard mountedSlotKeys.contains(key),
            item.renderer == "empty" || item.renderer == "loading" else { return nil }
      return key
    default:
      return nil
    }
  }

  func tableView(_ tableView: UITableView, heightForRowAt indexPath: IndexPath) -> CGFloat {
    guard let rowId = dataSource.itemIdentifier(for: indexPath),
          let row = rowsById[rowId] else { return HomeContainerMetrics.rowHeight }
    switch row.kind {
    case .contentHeader(let tabId):
      return HomeContainerMetrics.contentHeaderHeight(tabId: tabId) ?? 0
    case .footerSlot(let key):
      return HomeContainerMetrics.footerSlotHeight(key: key) ?? 0
    case .grid:
      return tableView.bounds.width / 2 + HomeContainerMetrics.scaledHeight(54)
    case .marketRecommendations:
      return HomeContainerMetrics.scaledHeight(68)
    case .horizontal(let section):
      return section.items.first?.renderer == "supportPromo"
        ? HomeContainerMetrics.scaledHeight(163)
        : HomeContainerMetrics.horizontalRowHeight
    case .sectionTitle:
      if row.id.hasPrefix("section:history:") {
        return HomeContainerMetrics.scaledHeight(
          row.id.hasPrefix("section:history:0:") ? 44 : 52
        )
      }
      return HomeContainerMetrics.sectionTitleHeight
    case .item(let item):
      switch item.renderer {
      case "nft": return HomeContainerMetrics.nftRowHeight
      case "history": return HomeContainerMetrics.scaledHeight(68)
      case "defi": return HomeContainerMetrics.scaledHeight(64)
      case "marketTabs": return HomeContainerMetrics.marketTabsRowHeight
      case "showMore": return HomeContainerMetrics.scaledHeight(48)
      case "asset":
        return item.displayHeight ?? HomeContainerMetrics.scaledHeight(60)
      case "addToken":
        return item.displayHeight ?? HomeContainerMetrics.scaledHeight(56)
      case "earn", "market": return HomeContainerMetrics.scaledHeight(56)
      case "supportAction": return HomeContainerMetrics.scaledHeight(76)
      case "upgrade": return HomeContainerMetrics.scaledHeight(96)
      case "empty", "loading": return item.displayHeight ?? HomeContainerMetrics.emptyRowHeight
      default: return HomeContainerMetrics.rowHeight
      }
    }
  }

  func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    tableView.deselectRow(at: indexPath, animated: true)
    guard let rowId = dataSource.itemIdentifier(for: indexPath),
          let row = rowsById[rowId],
          case .item(let item) = row.kind,
          let actionId = item.actionId,
          !actionId.isEmpty else { return }
    onAction?(actionId, item.id, tabId)
  }

  func tableView(
    _ tableView: UITableView,
    willDisplay cell: UITableViewCell,
    forRowAt indexPath: IndexPath
  ) {
    cell.homeContainerEnableDynamicTypeRecursively()
    if let slotCell = cell as? HomeContainerSlotHostCell,
       !slotCell.slotKey.isEmpty,
       mountedSlotKeys.contains(slotCell.slotKey) {
      visibleSlotHosts[slotCell.slotKey] = slotCell.slotHostView
      DispatchQueue.main.async { [weak self] in
        self?.onSlotLayoutChange?()
      }
    }
    guard let rowId = dataSource.itemIdentifier(for: indexPath),
          let request = loadMoreRequest(for: rowId) else { return }
    onAction?(request.actionId, request.itemId, tabId)
  }

  func tableView(
    _ tableView: UITableView,
    didEndDisplaying cell: UITableViewCell,
    forRowAt indexPath: IndexPath
  ) {
    if let slotCell = cell as? HomeContainerSlotHostCell,
       let visibleKey = visibleSlotHosts.first(where: {
         $0.value === slotCell.slotHostView
       })?.key {
      visibleSlotHosts.removeValue(forKey: visibleKey)
      DispatchQueue.main.async { [weak self] in
        self?.onSlotLayoutChange?()
      }
    }
  }

  private func loadMoreRequest(for rowId: String) -> (actionId: String, itemId: String)? {
    for section in sections {
      guard let actionId = section.actionId,
            actionId.hasSuffix(".loadMore"),
            let lastItem = section.items.last,
            rowId == "item:\(section.id):\(lastItem.id)" else { continue }
      return (actionId, lastItem.id)
    }
    return nil
  }

  func scrollViewDidScroll(_ scrollView: UIScrollView) {
    guard !suppressContentOffsetCallback else { return }
    if pinnedMarketMutationContentOffsetY != nil {
      if tableView.isTracking || tableView.isDragging || tableView.isDecelerating {
        cancelMarketMutationContentOffsetPin()
      } else {
        restorePinnedMarketMutationContentOffset()
        return
      }
    }
    onContentOffsetChange?(self)
  }

  func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
    onBeginDragging?(self)
  }

  func scrollViewDidEndDragging(_ scrollView: UIScrollView, willDecelerate decelerate: Bool) {
    onEndDragging?(self)
  }

  private func makeDataSource() -> UITableViewDiffableDataSource<Int, String> {
    UITableViewDiffableDataSource<Int, String>(tableView: tableView) {
      [weak self] tableView, indexPath, rowId in
      guard let self,
            let row = self.rowsById[rowId],
            let theme = self.theme else { return UITableViewCell() }
      switch row.kind {
      case .contentHeader, .footerSlot:
        let cell = tableView.dequeueReusableCell(withIdentifier: "slot-host", for: indexPath)
          as! HomeContainerSlotHostCell
        if let key = self.slotKey(for: row) {
          cell.apply(slotKey: key, theme: theme)
        }
        return cell
      case .grid(let items):
        let cell = tableView.dequeueReusableCell(withIdentifier: "grid", for: indexPath)
          as! HomeContainerNFTGridCell
        cell.apply(items: items, theme: theme) { [weak self] actionId, itemId in
          guard let self else { return }
          self.onAction?(actionId, itemId, self.tabId)
        }
        return cell
      case .marketRecommendations(let items):
        let cell = tableView.dequeueReusableCell(
          withIdentifier: "market-recommendations",
          for: indexPath
        ) as! HomeContainerMarketRecommendationGridCell
        cell.apply(items: items, theme: theme) { [weak self] actionId, itemId in
          guard let self else { return }
          self.onAction?(actionId, itemId, self.tabId)
        }
        return cell
      case .horizontal(let section):
        let cell = tableView.dequeueReusableCell(withIdentifier: "horizontal", for: indexPath)
          as! HomeContainerHorizontalCell
        cell.apply(section: section, theme: theme) { [weak self] actionId, itemId in
          guard let self else { return }
          self.onAction?(actionId, itemId, self.tabId)
        }
        return cell
      case .sectionTitle(let section):
        let cell = tableView.dequeueReusableCell(withIdentifier: "section", for: indexPath)
          as! HomeContainerSectionTitleCell
        cell.apply(section: section, sectionId: row.id, theme: theme) { [weak self] in
          guard let self,
                let actionId = section.actionId,
                !actionId.isEmpty else { return }
          self.onAction?(actionId, section.id, self.tabId)
        }
        return cell
      case .item(let item):
        if let key = self.slotKey(for: row) {
          let cell = tableView.dequeueReusableCell(withIdentifier: "slot-host", for: indexPath)
            as! HomeContainerSlotHostCell
          cell.apply(slotKey: key, theme: theme)
          return cell
        }
        let cell = tableView.dequeueReusableCell(withIdentifier: "item", for: indexPath)
          as! HomeContainerItemCell
        cell.apply(item: item, theme: theme) { [weak self] actionId, itemId in
          guard let self else { return }
          self.onAction?(actionId, itemId, self.tabId)
        }
        return cell
      }
    }
  }
}

private final class HomeContainerSlotHostCell: UITableViewCell {
  let slotHostView = HomeContainerSlotHostView()
  private(set) var slotKey = ""

  override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
    super.init(style: style, reuseIdentifier: reuseIdentifier)
    selectionStyle = .none
    backgroundColor = .clear
    contentView.backgroundColor = .clear
    contentView.addSubview(slotHostView)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    slotHostView.frame = contentView.bounds
  }

  override func prepareForReuse() {
    super.prepareForReuse()
    slotKey = ""
  }

  func apply(slotKey: String, theme: HomeContainerTheme) {
    self.slotKey = slotKey
    let color = UIColor(
      homeContainerColor: theme.backgroundColor,
      fallback: .systemBackground
    )
    backgroundColor = color
    contentView.backgroundColor = color
    slotHostView.backgroundColor = color
  }
}

private final class HomeContainerHeaderView: UIView {
  var onAction: ((String, String) -> Void)?
  var onSlotLayoutChange: (() -> Void)?
  private let contentStack = UIStackView()
  private let compactBackdropView = UIView()
  private let accountButton = UIButton(type: .system)
  private let copyButton = UIButton(type: .system)
  private let networkSelectorControl = HomeContainerTapControl()
  private lazy var accountRow = UIStackView(
    arrangedSubviews: [accountButton, copyButton, UIView(), networkSelectorControl]
  )
  private let networkIconsStack = UIStackView()
  private let networkIconViews = [UIImageView(), UIImageView()]
  private let networkButton = UIButton(type: .system)
  private let balanceButton = UIButton(type: .system)
  private var balanceSkeletonView: SkeletonNativeView?
  private let balanceActionsStack = UIStackView()
  private let actionsScroll = HomeContainerHorizontalScrollView()
  private let actionsStack = UIStackView()
  private let bannersScroll = HomeContainerHorizontalScrollView()
  private let bannersStack = UIStackView()
  private let accountSlotHost = HomeContainerSlotHostView()
  private let balanceSlotHost = HomeContainerSlotHostView()
  private let actionRowSlotHost = HomeContainerSlotHostView()
  private var actionControls: [String: HomeContainerActionControl] = [:]
  private var balanceActionButtons: [String: HomeContainerInteractiveButton] = [:]
  private var bannerControls: [String: HomeContainerBannerControl] = [:]
  private var accountImageTask: HomeContainerImageRequest?
  private var networkImageTask: HomeContainerImageRequest?
  private var networkGroupImageTasks: [HomeContainerImageRequest] = []
  private var representedAccountImageURL: URL?
  private var representedNetworkImageURL: URL?
  private var representedNetworkGroupImageValues: [String] = []
  private var header: HomeContainerHeader?
  private var currentTheme: HomeContainerTheme?
  private var mountedSlotKeys = Set<String>()
  private var accountRowHeightConstraint: NSLayoutConstraint!
  private var balanceHeightConstraint: NSLayoutConstraint!
  private var balanceActionsHeightConstraint: NSLayoutConstraint!
  private var actionsScrollHeightConstraint: NSLayoutConstraint!
  private var bannersScrollHeightConstraint: NSLayoutConstraint!
  private(set) var preferredHeight: CGFloat = HomeContainerMetrics.scaledHeight(216)
  private var pinnedOffset: CGFloat = 0

  override init(frame: CGRect) {
    super.init(frame: frame)
    contentStack.axis = .vertical
    contentStack.spacing = 10
    contentStack.translatesAutoresizingMaskIntoConstraints = false
    addSubview(contentStack)
    NSLayoutConstraint.activate([
      contentStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 20),
      contentStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -20),
      contentStack.topAnchor.constraint(equalTo: topAnchor, constant: 16),
    ])

    accountRow.axis = .horizontal
    accountRow.alignment = .center
    accountRow.spacing = 8
    accountRowHeightConstraint = accountRow.heightAnchor.constraint(
      equalToConstant: HomeContainerMetrics.scaledHeight(32)
    )
    accountRowHeightConstraint.isActive = true
    accountButton.titleLabel?.font = HomeContainerTypography.system(
      17,
      weight: .semibold,
      textStyle: .headline
    )
    accountButton.titleLabel?.numberOfLines = 1
    accountButton.titleLabel?.lineBreakMode = .byTruncatingTail
    accountButton.contentHorizontalAlignment = .leading
    accountButton.setImage(UIImage(systemName: "person.crop.circle.fill"), for: .normal)
    accountButton.configuration = .plain()
    accountButton.configuration?.imagePadding = 8
    accountButton.configuration?.contentInsets = .zero
    accountButton.configuration?.titleLineBreakMode = .byTruncatingTail
    accountButton.titleLabel?.numberOfLines = 1
    accountButton.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
    accountButton.imageView?.contentMode = .scaleAspectFill
    accountButton.imageView?.layer.cornerRadius = 12
    accountButton.imageView?.clipsToBounds = true
    accountButton.addAction(UIAction { [weak self] _ in
      guard let self, let actionId = self.header?.accountActionId, !actionId.isEmpty else { return }
      self.onAction?(actionId, "account")
    }, for: .touchUpInside)
    copyButton.setImage(UIImage(systemName: "square.on.square"), for: .normal)
    copyButton.addAction(UIAction { [weak self] _ in
      guard let self, let actionId = self.header?.copyActionId, !actionId.isEmpty else { return }
      self.onAction?(actionId, "copy")
    }, for: .touchUpInside)
    networkIconsStack.axis = .horizontal
    networkIconsStack.alignment = .center
    networkIconsStack.spacing = -7
    networkIconViews.forEach { imageView in
      imageView.contentMode = .scaleAspectFill
      imageView.layer.cornerRadius = 11
      imageView.layer.borderWidth = 1.5
      imageView.layer.borderColor = UIColor.systemBackground.cgColor
      imageView.clipsToBounds = true
      imageView.translatesAutoresizingMaskIntoConstraints = false
      NSLayoutConstraint.activate([
        imageView.widthAnchor.constraint(equalToConstant: 22),
        imageView.heightAnchor.constraint(equalToConstant: 22),
      ])
      networkIconsStack.addArrangedSubview(imageView)
    }
    let networkSelectorStack = UIStackView(
      arrangedSubviews: [networkIconsStack, networkButton]
    )
    networkSelectorStack.axis = .horizontal
    networkSelectorStack.alignment = .center
    networkSelectorStack.spacing = 5
    networkSelectorStack.translatesAutoresizingMaskIntoConstraints = false
    networkSelectorControl.addSubview(networkSelectorStack)
    NSLayoutConstraint.activate([
      networkSelectorStack.leadingAnchor.constraint(equalTo: networkSelectorControl.leadingAnchor),
      networkSelectorStack.trailingAnchor.constraint(equalTo: networkSelectorControl.trailingAnchor),
      networkSelectorStack.topAnchor.constraint(equalTo: networkSelectorControl.topAnchor),
      networkSelectorStack.bottomAnchor.constraint(equalTo: networkSelectorControl.bottomAnchor),
    ])
    networkButton.isUserInteractionEnabled = false
    networkButton.titleLabel?.font = HomeContainerTypography.system(15, weight: .medium)
    networkButton.titleLabel?.numberOfLines = 1
    networkButton.titleLabel?.lineBreakMode = .byTruncatingTail
    networkButton.titleLabel?.numberOfLines = 1
    networkButton.titleLabel?.lineBreakMode = .byTruncatingTail
    networkButton.contentEdgeInsets = .zero
    networkButton.setContentCompressionResistancePriority(.required, for: .horizontal)
    networkButton.imageView?.contentMode = .scaleAspectFill
    networkButton.imageView?.layer.cornerRadius = 10
    networkButton.imageView?.clipsToBounds = true
    networkButton.setImage(UIImage(systemName: "network"), for: .normal)
    networkSelectorControl.onPress = { [weak self] in
      guard let self, let actionId = self.header?.networkActionId, !actionId.isEmpty else { return }
      self.onAction?(actionId, "network")
    }
    contentStack.addArrangedSubview(accountRow)

    accountButton.alpha = 0
    accountButton.isUserInteractionEnabled = false
    copyButton.alpha = 0
    copyButton.isUserInteractionEnabled = false
    networkSelectorControl.alpha = 0
    networkSelectorControl.isUserInteractionEnabled = false

    balanceButton.titleLabel?.font = HomeContainerTypography.system(
      48,
      weight: .medium,
      textStyle: .largeTitle,
      maximumScale: 1.3
    )
    balanceButton.titleLabel?.adjustsFontSizeToFitWidth = true
    balanceButton.titleLabel?.minimumScaleFactor = 0.6
    balanceButton.contentHorizontalAlignment = .leading
    balanceHeightConstraint = balanceButton.heightAnchor.constraint(
      equalToConstant: HomeContainerMetrics.scaledHeight(58, maximumScale: 1.3)
    )
    balanceHeightConstraint.isActive = true
    balanceButton.addAction(UIAction { [weak self] _ in
      guard let self, let actionId = self.header?.balanceActionId, !actionId.isEmpty else { return }
      self.onAction?(actionId, "balance")
    }, for: .touchUpInside)
    balanceButton.alpha = 0
    balanceButton.isUserInteractionEnabled = false
    contentStack.addArrangedSubview(balanceButton)

    balanceActionsStack.axis = .horizontal
    balanceActionsStack.alignment = .leading
    balanceActionsStack.spacing = 8
    balanceActionsHeightConstraint = balanceActionsStack.heightAnchor.constraint(
      equalToConstant: HomeContainerMetrics.scaledHeight(28)
    )
    balanceActionsHeightConstraint.isActive = true
    contentStack.addArrangedSubview(balanceActionsStack)

    actionsScrollHeightConstraint = configureHorizontalStrip(
      scrollView: actionsScroll,
      stack: actionsStack,
      height: 62
    )
    bannersScrollHeightConstraint = configureHorizontalStrip(
      scrollView: bannersScroll,
      stack: bannersStack,
      height: 88
    )
    contentStack.addArrangedSubview(actionsScroll)
    contentStack.addArrangedSubview(bannersScroll)
    contentStack.setCustomSpacing(26, after: balanceButton)
    contentStack.setCustomSpacing(21, after: actionsScroll)
    addSubview(compactBackdropView)
    addSubview(accountSlotHost)
    addSubview(balanceSlotHost)
    addSubview(actionRowSlotHost)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func apply(header: HomeContainerHeader, theme: HomeContainerTheme) {
    self.header = header
    currentTheme = theme
    backgroundColor = .clear
    compactBackdropView.backgroundColor = UIColor(
      homeContainerColor: theme.backgroundColor,
      fallback: .systemBackground
    )
    let primaryColor = UIColor(homeContainerColor: theme.primaryTextColor, fallback: .label)
    let secondaryColor = UIColor(homeContainerColor: theme.secondaryTextColor, fallback: .secondaryLabel)
    networkSelectorControl.configureInteractiveColors(
      normal: .clear,
      hover: UIColor(
        homeContainerColor: theme.hoverColor ?? theme.cardColor,
        fallback: .tertiarySystemBackground
      ),
      active: UIColor(
        homeContainerColor: theme.activeColor ?? theme.cardColor,
        fallback: .systemGray5
      )
    )
    accountButton.setTitle("\(header.accountName) ⌄", for: .normal)
    accountButton.setTitleColor(primaryColor, for: .normal)
    accountButton.tintColor = primaryColor
    copyButton.tintColor = secondaryColor
    networkIconViews.forEach { imageView in
      imageView.tintColor = secondaryColor
      imageView.backgroundColor = UIColor(
        homeContainerColor: theme.cardColor,
        fallback: .secondarySystemBackground
      )
      imageView.layer.borderColor = UIColor(
        homeContainerColor: theme.backgroundColor,
        fallback: .systemBackground
      ).cgColor
    }
    copyButton.isHidden = header.copyActionId?.isEmpty != false
    let networkCount = header.networkCount ?? 0
    let isNetworkGroup = networkCount > 1 && !(header.networkImageUrls ?? []).isEmpty
    let networkTitle = (header.networkName?.isEmpty == false ? header.networkName : header.accountSubtitle) ?? ""
    networkButton.setTitle(
      isNetworkGroup
        ? (networkCount > 2 ? "+\(networkCount - 2) ⌄" : "⌄")
        : (networkTitle.isEmpty ? "" : "\(networkTitle) ⌄"),
      for: .normal
    )
    networkButton.setTitleColor(primaryColor, for: .normal)
    networkIconsStack.isHidden = !isNetworkGroup
    networkSelectorControl.isHidden = !isNetworkGroup && networkTitle.isEmpty
    let balanceSecondary = header.balanceSecondary ?? ""
    let balanceTitle = NSMutableAttributedString(
      string: header.balance,
      attributes: [.foregroundColor: primaryColor]
    )
    if !balanceSecondary.isEmpty {
      balanceTitle.append(NSAttributedString(
        string: balanceSecondary,
        attributes: [.foregroundColor: secondaryColor]
      ))
    }
    balanceButton.setAttributedTitle(balanceTitle, for: .normal)
    loadAccountImage(header.accountImageUrl)
    if isNetworkGroup {
      networkImageTask?.cancel()
      networkImageTask = nil
      representedNetworkImageURL = nil
      networkButton.setImage(nil, for: .normal)
      loadNetworkGroupImages(header.networkImageUrls ?? [])
    } else {
      clearNetworkGroupImages()
      loadNetworkImage(header.networkImageUrls?.first)
    }

    updateBalanceActions(header.balanceActions ?? [], theme: theme)
    updateActions(header.actions, theme: theme)
    updateBanners(header.banners, theme: theme)
    updateNativeOwnershipVisibility()
    let actionRowHeight = max(0, header.actionRowHeight ?? 62)
    actionsScrollHeightConstraint.constant = HomeContainerMetrics.scaledHeight(actionRowHeight)
    updateActionRowVisibility()
    bannersScroll.isHidden = header.banners.isEmpty
    let balanceActionsHeight: CGFloat = (header.balanceActions ?? []).isEmpty ? 0 : 38
    let actionHeightAdjustment = preferredHeightAdjustment(for: header)
    preferredHeight = HomeContainerMetrics.scaledHeight(
      header.banners.isEmpty ? 216 : 310
    ) + HomeContainerMetrics.scaledHeight(balanceActionsHeight) +
      HomeContainerMetrics.headerBottomPadding + actionHeightAdjustment
    homeContainerEnableDynamicTypeRecursively()
  }

  func contentSizeCategoryDidChange() {
    accountRowHeightConstraint.constant = HomeContainerMetrics.scaledHeight(32)
    balanceHeightConstraint.constant = HomeContainerMetrics.scaledHeight(58, maximumScale: 1.3)
    balanceActionsHeightConstraint.constant = HomeContainerMetrics.scaledHeight(28)
    actionsScrollHeightConstraint.constant = HomeContainerMetrics.scaledHeight(
      max(0, header?.actionRowHeight ?? 62)
    )
    bannersScrollHeightConstraint.constant = HomeContainerMetrics.scaledHeight(88)
    if let header {
      let balanceActionsHeight: CGFloat = (header.balanceActions ?? []).isEmpty ? 0 : 38
      let actionHeightAdjustment = preferredHeightAdjustment(for: header)
      preferredHeight = HomeContainerMetrics.scaledHeight(
        header.banners.isEmpty ? 216 : 310
      ) + HomeContainerMetrics.scaledHeight(balanceActionsHeight) +
        HomeContainerMetrics.headerBottomPadding + actionHeightAdjustment
    }
    homeContainerEnableDynamicTypeRecursively()
    setNeedsLayout()
  }

  private func preferredHeightAdjustment(for header: HomeContainerHeader) -> CGFloat {
    let actionHeightDelta = HomeContainerMetrics.scaledHeight(
      max(0, (header.actionRowHeight ?? 62) - 62)
    )
    guard header.actionLayout == "zeroBalance" || header.actionLayout == "loading" else {
      return actionHeightDelta
    }
    return max(
      0,
      actionHeightDelta -
        HomeContainerMetrics.legacyABZeroBalanceActionTrailingCompaction
    )
  }

  deinit {
    accountImageTask?.cancel()
    networkImageTask?.cancel()
    networkGroupImageTasks.forEach { $0.cancel() }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    updatePinnedAccountRow()
    layoutSlotHost(accountSlotHost, target: accountRow)
    layoutSlotHost(balanceSlotHost, target: balanceButton)
    layoutSlotHost(actionRowSlotHost, target: actionsScroll)
    if let balanceSkeletonView {
      let skeletonHeight = min(balanceButton.bounds.height, 40)
      balanceSkeletonView.frame = CGRect(
        x: 0,
        y: max(0, (balanceButton.bounds.height - skeletonHeight) / 2),
        width: min(balanceButton.bounds.width, 209),
        height: skeletonHeight
      )
    }
    bringSubviewToFront(compactBackdropView)
    bringSubviewToFront(accountSlotHost)
  }

  func setPinnedOffset(_ offset: CGFloat) {
    let nextOffset = max(0, offset)
    guard abs(nextOffset - pinnedOffset) > 0.5 else { return }
    pinnedOffset = nextOffset
    updatePinnedAccountRow()
    layoutSlotHost(accountSlotHost, target: accountRow)
    bringSubviewToFront(compactBackdropView)
    bringSubviewToFront(accountSlotHost)
    onSlotLayoutChange?()
  }

  func setMountedSlotKeys(_ keys: Set<String>) {
    guard mountedSlotKeys != keys else { return }
    mountedSlotKeys = keys
    updateNativeOwnershipVisibility()
    updateActionRowVisibility()
    setNeedsLayout()
    onSlotLayoutChange?()
  }

  private func updateActionRowVisibility() {
    guard let header else { return }
    let hasMountedSlot = mountedSlotKeys.contains("header.action-row")
    actionsScroll.isHidden =
      !hasMountedSlot && header.actions.isEmpty && header.actionLayout != "loading"
  }

  func slotHostView(forKey key: String) -> UIView? {
    layoutIfNeeded()
    switch key {
    case "header.account-row":
      return accountRow.isHidden ? nil : accountSlotHost
    case "header.balance":
      return balanceButton.isHidden ? nil : balanceSlotHost
    case "header.action-row":
      return actionsScroll.isHidden ? nil : actionRowSlotHost
    default:
      return nil
    }
  }

  func slotFrame(forKey key: String) -> CGRect? {
    layoutIfNeeded()
    let target: UIView?
    switch key {
    case "header.account-row":
      target = accountRow
    case "header.balance":
      target = balanceButton
    case "header.action-row":
      target = actionsScroll
    default:
      target = nil
    }
    guard let target, !target.isHidden, target.bounds.width > 0, target.bounds.height > 0 else {
      return nil
    }
    return target.convert(target.bounds, to: self)
  }

  private func layoutSlotHost(_ host: UIView, target: UIView) {
    guard !target.isHidden, target.bounds.width > 0, target.bounds.height > 0 else {
      host.frame = .zero
      host.isHidden = true
      return
    }
    host.isHidden = false
    host.frame = target.convert(target.bounds, to: self)
    bringSubviewToFront(host)
  }

  private func updatePinnedAccountRow() {
    accountRow.transform = .identity
    let naturalFrame = accountRow.convert(accountRow.bounds, to: self)
    let translationY = max(
      0,
      pinnedOffset + HomeContainerMetrics.compactAccountTopInset - naturalFrame.minY
    )
    accountRow.transform = CGAffineTransform(translationX: 0, y: translationY)
    let pinnedAccountFrame = accountRow.convert(accountRow.bounds, to: self)
    compactBackdropView.frame = CGRect(
      x: 0,
      y: 0,
      width: bounds.width,
      height: max(0, pinnedAccountFrame.maxY)
    )
    compactBackdropView.isHidden = accountRow.isHidden
  }

  private func loadAccountImage(_ value: String?) {
    let url = value.flatMap(URL.init(string:)).flatMap {
      $0.scheme == "https" || $0.scheme == "http" || $0.isFileURL ? $0 : nil
    }
    guard representedAccountImageURL != url else { return }
    guard let url else {
      accountImageTask?.cancel()
      accountImageTask = nil
      representedAccountImageURL = nil
      accountButton.setImage(UIImage(systemName: "person.crop.circle.fill"), for: .normal)
      return
    }
    accountImageTask?.cancel()
    representedAccountImageURL = url
    accountButton.setImage(UIImage(systemName: "person.crop.circle.fill"), for: .normal)
    accountImageTask = HomeContainerImageLoader.shared.load(url: url) { [weak self] image in
      guard let self, self.representedAccountImageURL == url else { return }
      self.accountButton.setImage(
        image?.homeContainerThumbnail(size: 26) ?? UIImage(systemName: "person.crop.circle.fill"),
        for: .normal
      )
    }
  }

  private func loadNetworkImage(_ value: String?) {
    let url = value.flatMap(URL.init(string:)).flatMap {
      $0.scheme == "https" || $0.scheme == "http" || $0.isFileURL ? $0 : nil
    }
    guard representedNetworkImageURL != url else { return }
    guard let url else {
      networkImageTask?.cancel()
      networkImageTask = nil
      representedNetworkImageURL = nil
      networkButton.setImage(UIImage(systemName: "network"), for: .normal)
      return
    }
    networkImageTask?.cancel()
    representedNetworkImageURL = url
    networkButton.setImage(UIImage(systemName: "network"), for: .normal)
    networkImageTask = HomeContainerImageLoader.shared.load(url: url) { [weak self] image in
      guard let self, self.representedNetworkImageURL == url else { return }
      self.networkButton.setImage(
        image?.homeContainerThumbnail(size: 22) ?? UIImage(systemName: "network"),
        for: .normal
      )
    }
  }

  private func loadNetworkGroupImages(_ values: [String]) {
    let imageValues = Array(values.prefix(networkIconViews.count))
    guard representedNetworkGroupImageValues != imageValues else { return }
    clearNetworkGroupImages()
    representedNetworkGroupImageValues = imageValues
    for (index, value) in imageValues.enumerated() {
      let url = URL(string: value).flatMap {
        $0.scheme == "https" || $0.scheme == "http" || $0.isFileURL ? $0 : nil
      }
      networkIconViews[index].isHidden = false
      applyNetworkGroupFallback(at: index)
      guard let url else { continue }
      let task = HomeContainerImageLoader.shared.load(url: url) { [weak self] image in
        guard let self,
              self.representedNetworkGroupImageValues.indices.contains(index),
              self.representedNetworkGroupImageValues[index] == value else { return }
        if let image {
          self.networkIconViews[index].contentMode = .scaleAspectFill
          self.networkIconViews[index].image = image.homeContainerThumbnail(size: 22)
        } else {
          self.applyNetworkGroupFallback(at: index)
        }
      }
      if let task {
        networkGroupImageTasks.append(task)
      }
    }
  }

  private func clearNetworkGroupImages() {
    networkGroupImageTasks.forEach { $0.cancel() }
    networkGroupImageTasks.removeAll()
    representedNetworkGroupImageValues.removeAll()
    networkIconViews.forEach {
      $0.image = nil
      $0.isHidden = true
    }
  }

  private func applyNetworkGroupFallback(at index: Int) {
    guard networkIconViews.indices.contains(index) else { return }
    let imageView = networkIconViews[index]
    imageView.contentMode = .scaleAspectFit
    imageView.image = UIImage(systemName: "network")
  }

  private func configureHorizontalStrip(
    scrollView: UIScrollView,
    stack: UIStackView,
    height: CGFloat
  ) -> NSLayoutConstraint {
    scrollView.showsHorizontalScrollIndicator = false
    scrollView.alwaysBounceHorizontal = true
    scrollView.isDirectionalLockEnabled = true
    let heightConstraint = scrollView.heightAnchor.constraint(
      equalToConstant: HomeContainerMetrics.scaledHeight(height)
    )
    heightConstraint.isActive = true
    stack.axis = .horizontal
    stack.spacing = scrollView === bannersScroll ? 12 : 10
    stack.translatesAutoresizingMaskIntoConstraints = false
    scrollView.addSubview(stack)
    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
      stack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
      stack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
      stack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
      stack.heightAnchor.constraint(equalTo: scrollView.frameLayoutGuide.heightAnchor),
    ])
    return heightConstraint
  }

  private func updateActions(_ actions: [HomeContainerAction], theme: HomeContainerTheme) {
    let ids = actions.map(\.id)
    if ids != actionsStack.arrangedSubviews.compactMap { ($0 as? HomeContainerActionControl)?.itemId } {
      actionsStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
      actionControls.removeAll()
      for action in actions {
        let control = HomeContainerActionControl(action: action, theme: theme)
        control.alpha = 0
        control.isUserInteractionEnabled = false
        actionControls[action.id] = control
        actionsStack.addArrangedSubview(control)
      }
    } else {
      actions.forEach { actionControls[$0.id]?.apply(action: $0, theme: theme) }
    }
    updateNativeOwnershipVisibility()
  }

  private func updateNativeOwnershipVisibility() {
    let ownsAccountRow = !mountedSlotKeys.contains("header.account-row")
    accountButton.alpha = ownsAccountRow ? 1 : 0
    accountButton.isUserInteractionEnabled = ownsAccountRow
    copyButton.alpha = ownsAccountRow ? 1 : 0
    copyButton.isUserInteractionEnabled = ownsAccountRow
    networkSelectorControl.alpha = ownsAccountRow ? 1 : 0
    networkSelectorControl.isUserInteractionEnabled = ownsAccountRow
    accountSlotHost.isUserInteractionEnabled = !ownsAccountRow

    let ownsBalance = !mountedSlotKeys.contains("header.balance")
    balanceButton.alpha = ownsBalance ? 1 : 0
    balanceButton.isUserInteractionEnabled = ownsBalance
    balanceSlotHost.isUserInteractionEnabled = !ownsBalance
    updateBalanceSkeleton()

    let ownsActionRow = !mountedSlotKeys.contains("header.action-row")
    actionControls.values.forEach { control in
      control.alpha = ownsActionRow ? 1 : 0
      control.isUserInteractionEnabled = ownsActionRow
    }
    actionRowSlotHost.isUserInteractionEnabled = !ownsActionRow
  }

  private func updateBalanceSkeleton() {
    let shouldShow = !mountedSlotKeys.contains("header.balance") &&
      header?.actionLayout == "loading" &&
      header?.balance.isEmpty == true &&
      header?.balanceSecondary?.isEmpty != false
    guard shouldShow, let currentTheme else {
      balanceSkeletonView?.removeFromSuperview()
      balanceSkeletonView = nil
      return
    }
    let skeleton = balanceSkeletonView ?? SkeletonNativeView(frame: .zero)
    if skeleton.superview == nil {
      skeleton.isUserInteractionEnabled = false
      skeleton.accessibilityElementsHidden = true
      skeleton.layer.cornerRadius = 8
      skeleton.clipsToBounds = true
      balanceButton.addSubview(skeleton)
    }
    skeleton.applyHomeContainerSkeletonTheme(currentTheme)
    balanceSkeletonView = skeleton
    setNeedsLayout()
  }

  private func updateBalanceActions(
    _ actions: [HomeContainerAction],
    theme: HomeContainerTheme
  ) {
    let ids = actions.map(\.id)
    let existingIds = balanceActionsStack.arrangedSubviews.compactMap { $0.accessibilityIdentifier }
    if ids != existingIds {
      balanceActionsStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
      balanceActionButtons.removeAll()
      for action in actions {
        let button = HomeContainerInteractiveButton(type: .system)
        button.accessibilityIdentifier = action.id
        button.titleLabel?.font = HomeContainerTypography.system(13, weight: .medium)
        button.setImage(UIImage(systemName: "info.circle"), for: .normal)
        button.semanticContentAttribute = .forceRightToLeft
        button.addAction(UIAction { [weak self] _ in
          self?.onAction?(action.actionId, action.id)
        }, for: .touchUpInside)
        balanceActionButtons[action.id] = button
        balanceActionsStack.addArrangedSubview(button)
      }
    }
    let foreground = UIColor(homeContainerColor: theme.secondaryTextColor, fallback: .secondaryLabel)
    for action in actions {
      let button = balanceActionButtons[action.id]
      button?.setTitle(" \(action.title)", for: .normal)
      button?.setTitleColor(foreground, for: .normal)
      button?.tintColor = foreground
      button?.layer.cornerRadius = 10
      button?.configureInteractiveColors(
        normal: .clear,
        hover: UIColor(
          homeContainerColor: theme.hoverColor ?? theme.cardColor,
          fallback: .tertiarySystemBackground
        ),
        active: UIColor(
          homeContainerColor: theme.activeColor ?? theme.cardColor,
          fallback: .systemGray5
        )
      )
    }
    balanceActionsStack.isHidden = actions.isEmpty
  }

  private func updateBanners(_ banners: [HomeContainerBanner], theme: HomeContainerTheme) {
    let ids = banners.map(\.id)
    if ids != bannersStack.arrangedSubviews.compactMap { ($0 as? HomeContainerBannerControl)?.itemId } {
      bannersStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
      bannerControls.removeAll()
      for banner in banners {
        let control = HomeContainerBannerControl(banner: banner, theme: theme)
        if let actionId = banner.actionId, !actionId.isEmpty {
          control.onPress = { [weak self] in self?.onAction?(actionId, banner.id) }
        }
        if let dismissActionId = banner.dismissActionId, !dismissActionId.isEmpty {
          control.onDismiss = { [weak self] in self?.onAction?(dismissActionId, banner.id) }
        }
        bannerControls[banner.id] = control
        bannersStack.addArrangedSubview(control)
      }
    } else {
      banners.forEach { bannerControls[$0.id]?.apply(banner: $0, theme: theme) }
    }
  }
}

private class HomeContainerTapControl: UIControl {
  var onPress: (() -> Void)?
  private var normalInteractiveColor: UIColor?
  private var hoverInteractiveColor: UIColor?
  private var activeInteractiveColor: UIColor?
  private var isPointerHovering = false
  private var hoverGestureRecognizer: UIHoverGestureRecognizer?

  override var isHighlighted: Bool {
    didSet {
      guard oldValue != isHighlighted else { return }
      updateInteractiveBackgroundColor()
    }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    addTarget(self, action: #selector(pressed), for: .touchUpInside)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func configureInteractiveColors(normal: UIColor, hover: UIColor, active: UIColor) {
    normalInteractiveColor = normal
    hoverInteractiveColor = hover
    activeInteractiveColor = active
    if hoverGestureRecognizer == nil {
      let recognizer = UIHoverGestureRecognizer(
        target: self,
        action: #selector(handleBaseHover(_:))
      )
      addGestureRecognizer(recognizer)
      hoverGestureRecognizer = recognizer
    }
    updateInteractiveBackgroundColor()
  }

  @objc private func pressed() {
    onPress?()
  }

  @objc private func handleBaseHover(_ gestureRecognizer: UIHoverGestureRecognizer) {
    switch gestureRecognizer.state {
    case .began, .changed:
      isPointerHovering = true
    case .ended, .cancelled, .failed:
      isPointerHovering = false
    default:
      break
    }
    updateInteractiveBackgroundColor()
  }

  private func updateInteractiveBackgroundColor() {
    guard let normalInteractiveColor else { return }
    if isHighlighted {
      backgroundColor = activeInteractiveColor ?? normalInteractiveColor
    } else if isPointerHovering {
      backgroundColor = hoverInteractiveColor ?? normalInteractiveColor
    } else {
      backgroundColor = normalInteractiveColor
    }
  }
}

private final class HomeContainerHitSlopButton: UIButton {
  var hitSlop = UIEdgeInsets(top: 12, left: 12, bottom: 12, right: 12)
  private var normalInteractiveColor = UIColor.clear
  private var hoverInteractiveColor = UIColor.clear
  private var activeInteractiveColor = UIColor.clear
  private var isPointerHovering = false

  override var isHighlighted: Bool {
    didSet {
      guard oldValue != isHighlighted else { return }
      updateInteractiveAppearance()
    }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    addGestureRecognizer(UIHoverGestureRecognizer(target: self, action: #selector(handleHover(_:))))
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func configureInteractiveColors(normal: UIColor, hover: UIColor, active: UIColor) {
    normalInteractiveColor = normal
    hoverInteractiveColor = hover
    activeInteractiveColor = active
    updateInteractiveAppearance()
  }

  override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
    guard !isHidden, isUserInteractionEnabled, alpha > 0.01 else { return false }
    return bounds.inset(by: UIEdgeInsets(
      top: -hitSlop.top,
      left: -hitSlop.left,
      bottom: -hitSlop.bottom,
      right: -hitSlop.right
    )).contains(point)
  }

  @objc private func handleHover(_ gestureRecognizer: UIHoverGestureRecognizer) {
    switch gestureRecognizer.state {
    case .began, .changed:
      isPointerHovering = true
    case .ended, .cancelled, .failed:
      isPointerHovering = false
    default:
      break
    }
    updateInteractiveAppearance()
  }

  private func updateInteractiveAppearance() {
    if isHighlighted {
      backgroundColor = activeInteractiveColor
      alpha = 0.72
    } else if isPointerHovering {
      backgroundColor = hoverInteractiveColor
      alpha = 1
    } else {
      backgroundColor = normalInteractiveColor
      alpha = 1
    }
  }
}

private final class HomeContainerInteractiveButton: UIButton {
  private var normalInteractiveColor = UIColor.clear
  private var hoverInteractiveColor = UIColor.clear
  private var activeInteractiveColor = UIColor.clear
  private var isPointerHovering = false

  override var isHighlighted: Bool {
    didSet {
      guard oldValue != isHighlighted else { return }
      updateInteractiveAppearance()
    }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    addGestureRecognizer(UIHoverGestureRecognizer(target: self, action: #selector(handleHover(_:))))
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func configureInteractiveColors(normal: UIColor, hover: UIColor, active: UIColor) {
    normalInteractiveColor = normal
    hoverInteractiveColor = hover
    activeInteractiveColor = active
    updateInteractiveAppearance()
  }

  @objc private func handleHover(_ gestureRecognizer: UIHoverGestureRecognizer) {
    switch gestureRecognizer.state {
    case .began, .changed:
      isPointerHovering = true
    case .ended, .cancelled, .failed:
      isPointerHovering = false
    default:
      break
    }
    updateInteractiveAppearance()
  }

  private func updateInteractiveAppearance() {
    if isHighlighted {
      backgroundColor = activeInteractiveColor
      alpha = 0.72
    } else if isPointerHovering {
      backgroundColor = hoverInteractiveColor
      alpha = 1
    } else {
      backgroundColor = normalInteractiveColor
      alpha = 1
    }
  }
}

private final class HomeContainerActionControl: HomeContainerTapControl {
  let itemId: String
  private let iconView = UIImageView()
  private let titleLabel = UILabel()
  private var imageTask: HomeContainerImageRequest?
  private var representedImageURL: URL?
  private var representedImageSignature = ""

  init(action: HomeContainerAction, theme: HomeContainerTheme) {
    itemId = action.id
    super.init(frame: .zero)
    layer.cornerRadius = 16
    widthAnchor.constraint(equalToConstant: 82).isActive = true
    iconView.contentMode = .scaleAspectFit
    iconView.translatesAutoresizingMaskIntoConstraints = false
    titleLabel.font = HomeContainerTypography.system(13, weight: .medium)
    titleLabel.textAlignment = .center
    titleLabel.translatesAutoresizingMaskIntoConstraints = false
    addSubview(iconView)
    addSubview(titleLabel)
    NSLayoutConstraint.activate([
      iconView.centerXAnchor.constraint(equalTo: centerXAnchor),
      iconView.topAnchor.constraint(equalTo: topAnchor, constant: 12),
      iconView.widthAnchor.constraint(equalToConstant: 24),
      iconView.heightAnchor.constraint(equalToConstant: 24),
      titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 4),
      titleLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -4),
      titleLabel.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -9),
    ])
    apply(action: action, theme: theme)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func apply(action: HomeContainerAction, theme: HomeContainerTheme) {
    let foreground = UIColor(homeContainerColor: theme.primaryTextColor, fallback: .label)
    configureInteractiveColors(
      normal: UIColor(homeContainerColor: theme.cardColor, fallback: .secondarySystemBackground),
      hover: UIColor(
        homeContainerColor: theme.hoverColor ?? theme.cardColor,
        fallback: .tertiarySystemBackground
      ),
      active: UIColor(
        homeContainerColor: theme.activeColor ?? theme.cardColor,
        fallback: .systemGray5
      )
    )
    titleLabel.textColor = foreground
    titleLabel.text = action.title
    iconView.tintColor = foreground
    let fallbackImage = UIImage(systemName: Self.symbolName(for: action.icon))
    let url = action.iconUrl.flatMap(URL.init(string:)).flatMap {
      $0.scheme == "https" || $0.scheme == "http" || $0.isFileURL ? $0 : nil
    }
    let signature = "\(url?.absoluteString ?? "")|\(Self.symbolName(for: action.icon))"
    guard representedImageSignature != signature else { return }
    representedImageSignature = signature
    imageTask?.cancel()
    representedImageURL = url
    iconView.image = fallbackImage
    guard let url else { return }
    imageTask = HomeContainerImageLoader.shared.load(url: url) { [weak self] image in
      guard let self, self.representedImageSignature == signature else { return }
      self.iconView.image = image ?? fallbackImage
    }
  }

  deinit {
    imageTask?.cancel()
  }

  private static func symbolName(for icon: String?) -> String {
    switch icon {
    case "send": return "arrow.up"
    case "receive": return "arrow.down"
    case "buy": return "dollarsign"
    case "copy": return "square.on.square"
    case "filter": return "line.3.horizontal.decrease"
    case "manage": return "slider.horizontal.3"
    default: return "ellipsis"
    }
  }
}

private final class HomeContainerBannerControl: HomeContainerTapControl {
  let itemId: String
  var onDismiss: (() -> Void)?
  private let imageView = UIImageView()
  private let titleLabel = UILabel()
  private let subtitleLabel = UILabel()
  private let resourceStack = UIStackView()
  private let dismissButton = HomeContainerHitSlopButton(type: .system)
  private var widthConstraint: NSLayoutConstraint!
  private var imageWidthConstraint: NSLayoutConstraint!
  private var labelsLeadingConstraint: NSLayoutConstraint!
  private var labelsLeadingToLeadingConstraint: NSLayoutConstraint!
  private var imageTask: HomeContainerImageRequest?
  private var representedImageValue: String?
  private var normalBackgroundColor = UIColor.secondarySystemBackground
  private var hoverBackgroundColor = UIColor.tertiarySystemBackground
  private var activeBackgroundColor = UIColor.systemGray5
  private var isPointerHovering = false

  override var isHighlighted: Bool {
    didSet {
      guard oldValue != isHighlighted else { return }
      updateInteractiveBackgroundColor()
    }
  }

  init(banner: HomeContainerBanner, theme: HomeContainerTheme) {
    itemId = banner.id
    super.init(frame: .zero)
    layer.cornerRadius = 16
    widthConstraint = widthAnchor.constraint(equalToConstant: 280)
    widthConstraint.isActive = true
    imageView.contentMode = .scaleAspectFit
    imageView.layer.cornerRadius = 10
    imageView.clipsToBounds = true
    imageView.isUserInteractionEnabled = false
    imageView.translatesAutoresizingMaskIntoConstraints = false
    addSubview(imageView)
    titleLabel.font = HomeContainerTypography.system(15, weight: .semibold)
    titleLabel.numberOfLines = 2
    subtitleLabel.font = HomeContainerTypography.system(12)
    subtitleLabel.numberOfLines = 2
    let labels = UIStackView(arrangedSubviews: [titleLabel, subtitleLabel])
    labels.axis = .vertical
    labels.spacing = 3
    labels.isUserInteractionEnabled = false
    labels.translatesAutoresizingMaskIntoConstraints = false
    addSubview(labels)
    resourceStack.axis = .vertical
    resourceStack.spacing = 12
    resourceStack.isUserInteractionEnabled = false
    resourceStack.translatesAutoresizingMaskIntoConstraints = false
    addSubview(resourceStack)
    dismissButton.setImage(HomeContainerIcons.crossedSmall, for: .normal)
    dismissButton.accessibilityIdentifier = "native-home-banner-dismiss"
    dismissButton.addAction(UIAction { [weak self] _ in self?.onDismiss?() }, for: .touchUpInside)
    dismissButton.translatesAutoresizingMaskIntoConstraints = false
    addSubview(dismissButton)
    let hoverGestureRecognizer = UIHoverGestureRecognizer(
      target: self,
      action: #selector(handleHover(_:))
    )
    addGestureRecognizer(hoverGestureRecognizer)
    isAccessibilityElement = true
    accessibilityIdentifier = "native-home-banner-item"
    accessibilityTraits = .button
    imageWidthConstraint = imageView.widthAnchor.constraint(equalToConstant: 56)
    labelsLeadingConstraint = labels.leadingAnchor.constraint(
      equalTo: imageView.trailingAnchor,
      constant: 12
    )
    labelsLeadingToLeadingConstraint = labels.leadingAnchor.constraint(
      equalTo: leadingAnchor,
      constant: 16
    )
    NSLayoutConstraint.activate([
      imageView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
      imageView.centerYAnchor.constraint(equalTo: centerYAnchor),
      imageWidthConstraint,
      imageView.heightAnchor.constraint(equalToConstant: 56),
      labelsLeadingConstraint,
      labels.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
      labels.centerYAnchor.constraint(equalTo: centerYAnchor),
      resourceStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
      resourceStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
      resourceStack.centerYAnchor.constraint(equalTo: centerYAnchor),
      dismissButton.topAnchor.constraint(equalTo: topAnchor, constant: 3),
      dismissButton.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -3),
      dismissButton.widthAnchor.constraint(equalToConstant: 28),
      dismissButton.heightAnchor.constraint(equalToConstant: 28),
    ])
    apply(banner: banner, theme: theme)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func apply(banner: HomeContainerBanner, theme: HomeContainerTheme) {
    normalBackgroundColor = UIColor(
      homeContainerColor: theme.cardColor,
      fallback: .secondarySystemBackground
    )
    hoverBackgroundColor = UIColor(
      homeContainerColor: theme.hoverColor ?? theme.cardColor,
      fallback: .tertiarySystemBackground
    )
    activeBackgroundColor = UIColor(
      homeContainerColor: theme.activeColor ?? theme.cardColor,
      fallback: .systemGray5
    )
    layer.borderWidth = 1 / UIScreen.main.scale
    layer.borderColor = hoverBackgroundColor.cgColor
    updateInteractiveBackgroundColor()
    titleLabel.textColor = UIColor(homeContainerColor: theme.primaryTextColor, fallback: .label)
    subtitleLabel.textColor = UIColor(homeContainerColor: theme.secondaryTextColor, fallback: .secondaryLabel)
    titleLabel.text = banner.title
    subtitleLabel.text = banner.subtitle
    subtitleLabel.isHidden = banner.subtitle?.isEmpty != false
    dismissButton.isHidden = banner.dismissActionId?.isEmpty != false
    let isTronResourceBanner = banner.id == "home-tron-resource"
    widthConstraint.constant = isTronResourceBanner ? 220 : 280
    imageWidthConstraint.constant = isTronResourceBanner ? 0 : 56
    imageView.isHidden = isTronResourceBanner || banner.imageUrl?.isEmpty != false
    labelsLeadingConstraint.isActive = !isTronResourceBanner
    labelsLeadingToLeadingConstraint.isActive = isTronResourceBanner
    resourceStack.isHidden = !isTronResourceBanner
    titleLabel.superview?.isHidden = isTronResourceBanner
    if isTronResourceBanner {
      applyResourceRows(banner.resourceRows ?? [], theme: theme)
    } else {
      resourceStack.arrangedSubviews.forEach { view in
        resourceStack.removeArrangedSubview(view)
        view.removeFromSuperview()
      }
    }
    dismissButton.tintColor = UIColor(
      homeContainerColor: theme.subduedIconColor ?? theme.secondaryTextColor,
      fallback: .tertiaryLabel
    )
    dismissButton.layer.cornerRadius = 10
    dismissButton.configureInteractiveColors(
      normal: .clear,
      hover: hoverBackgroundColor,
      active: activeBackgroundColor
    )
    imageView.tintColor = UIColor(
      homeContainerColor: theme.subduedIconColor ?? theme.secondaryTextColor,
      fallback: .tertiaryLabel
    )
    imageView.backgroundColor = UIColor(
      homeContainerColor: theme.strongColor ?? theme.cardColor,
      fallback: .tertiarySystemBackground
    )
    accessibilityLabel = banner.title
    loadImage(isTronResourceBanner ? nil : banner.imageUrl)
  }

  private func applyResourceRows(
    _ rows: [HomeContainerBannerResourceRow],
    theme: HomeContainerTheme
  ) {
    resourceStack.arrangedSubviews.forEach { view in
      resourceStack.removeArrangedSubview(view)
      view.removeFromSuperview()
    }
    rows.prefix(2).forEach { row in
      let container = UIStackView()
      container.axis = .horizontal
      container.alignment = .center
      container.spacing = 10
      let ring = HomeContainerResourceRingView()
      ring.translatesAutoresizingMaskIntoConstraints = false
      ring.progress = max(0, min(100, row.progress ?? 0)) / 100
      NSLayoutConstraint.activate([
        ring.widthAnchor.constraint(equalToConstant: 20),
        ring.heightAnchor.constraint(equalToConstant: 20),
      ])
      let label = UILabel()
      label.font = HomeContainerTypography.system(14, weight: .medium)
      label.textColor = UIColor(homeContainerColor: theme.primaryTextColor, fallback: .label)
      label.text = row.label
      label.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
      let value = UILabel()
      value.font = HomeContainerTypography.system(14)
      value.textColor = UIColor(homeContainerColor: theme.secondaryTextColor, fallback: .secondaryLabel)
      value.text = row.value
      value.setContentCompressionResistancePriority(.required, for: .horizontal)
      container.addArrangedSubview(ring)
      container.addArrangedSubview(label)
      container.addArrangedSubview(value)
      resourceStack.addArrangedSubview(container)
    }
  }

  @objc private func handleHover(_ gestureRecognizer: UIHoverGestureRecognizer) {
    switch gestureRecognizer.state {
    case .began, .changed:
      isPointerHovering = true
    case .ended, .cancelled, .failed:
      isPointerHovering = false
    default:
      break
    }
    updateInteractiveBackgroundColor()
  }

  private func updateInteractiveBackgroundColor() {
    if isHighlighted {
      backgroundColor = activeBackgroundColor
    } else if isPointerHovering {
      backgroundColor = hoverBackgroundColor
    } else {
      backgroundColor = normalBackgroundColor
    }
  }

  private func loadImage(_ value: String?) {
    let normalizedValue = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    guard representedImageValue != normalizedValue else { return }
    representedImageValue = normalizedValue
    let url = URL(string: normalizedValue).flatMap {
      $0.scheme == "https" || $0.scheme == "http" || $0.isFileURL ? $0 : nil
    }
    imageTask?.cancel()
    imageTask = nil
    imageView.image = nil
    imageView.isHidden = true
    if normalizedValue.isEmpty {
      imageWidthConstraint.constant = 0
      labelsLeadingConstraint.constant = 0
      return
    }
    imageWidthConstraint.constant = 56
    labelsLeadingConstraint.constant = 12
    applyImageFallback()
    guard let url else { return }
    imageTask = HomeContainerImageLoader.shared.load(url: url) { [weak self] image in
      guard let self, self.representedImageValue == normalizedValue else { return }
      if let image {
        self.imageView.contentMode = .scaleAspectFit
        self.imageView.image = image
        self.imageView.isHidden = false
      } else {
        self.applyImageFallback()
      }
    }
  }

  private func applyImageFallback() {
    imageView.contentMode = .center
    imageView.image = UIImage(systemName: "photo")
    imageView.isHidden = false
  }
}

private final class HomeContainerResourceRingView: UIView {
  override init(frame: CGRect) {
    super.init(frame: frame)
    isOpaque = false
    backgroundColor = .clear
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    isOpaque = false
    backgroundColor = .clear
  }

  var progress: CGFloat = 0 {
    didSet { setNeedsDisplay() }
  }

  override func draw(_ rect: CGRect) {
    let lineWidth: CGFloat = 2
    let insetRect = rect.insetBy(dx: lineWidth / 2, dy: lineWidth / 2)
    let center = CGPoint(x: rect.midX, y: rect.midY)
    let radius = min(insetRect.width, insetRect.height) / 2
    let backgroundPath = UIBezierPath(
      arcCenter: center,
      radius: radius,
      startAngle: 0,
      endAngle: .pi * 2,
      clockwise: true
    )
    UIColor.secondaryLabel.withAlphaComponent(0.25).setStroke()
    backgroundPath.lineWidth = lineWidth
    backgroundPath.stroke()

    let foregroundPath = UIBezierPath(
      arcCenter: center,
      radius: radius,
      startAngle: -.pi / 2,
      endAngle: -.pi / 2 + (.pi * 2 * progress),
      clockwise: true
    )
    UIColor(red: 0.51, green: 0.55, blue: 0.97, alpha: 1).setStroke()
    foregroundPath.lineWidth = lineWidth
    foregroundPath.lineCapStyle = .round
    foregroundPath.stroke()
  }
}

private final class HomeContainerTabsView: UIView {
  var onSelect: ((String) -> Void)?
  var onAction: ((String, String) -> Void)?
  var onSlotLayoutChange: (() -> Void)?
  private let scrollView = HomeContainerHorizontalScrollView()
  private let stack = UIStackView()
  private let toolbarButton = HomeContainerInteractiveButton(type: .system)
  private let toolbarSlotHost = HomeContainerSlotHostView()
  private var buttons: [String: HomeContainerInteractiveButton] = [:]
  private var tabsById: [String: HomeContainerTab] = [:]
  private var selectedTabId = ""
  private var theme: HomeContainerTheme?
  private var mountedSlotKeys = Set<String>()

  override init(frame: CGRect) {
    super.init(frame: frame)
    isAccessibilityElement = false
    scrollView.showsHorizontalScrollIndicator = false
    scrollView.alwaysBounceHorizontal = true
    scrollView.translatesAutoresizingMaskIntoConstraints = false
    stack.axis = .horizontal
    stack.alignment = .center
    stack.spacing = 20
    stack.translatesAutoresizingMaskIntoConstraints = false
    toolbarButton.titleLabel?.font = HomeContainerTypography.system(22, weight: .medium)
    toolbarButton.setTitle("≡", for: .normal)
    toolbarButton.addAction(UIAction { [weak self] _ in
      guard let self,
            let action = self.tabsById[self.selectedTabId]?.toolbarAction else { return }
      self.onAction?(action.actionId, action.id)
    }, for: .touchUpInside)
    toolbarButton.translatesAutoresizingMaskIntoConstraints = false
    addSubview(scrollView)
    addSubview(toolbarButton)
    addSubview(toolbarSlotHost)
    scrollView.addSubview(stack)
    NSLayoutConstraint.activate([
      scrollView.leadingAnchor.constraint(equalTo: leadingAnchor),
      scrollView.trailingAnchor.constraint(equalTo: toolbarButton.leadingAnchor),
      scrollView.topAnchor.constraint(equalTo: topAnchor),
      scrollView.bottomAnchor.constraint(equalTo: bottomAnchor),
      stack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor, constant: 20),
      stack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor, constant: -20),
      stack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
      stack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
      stack.heightAnchor.constraint(equalTo: scrollView.frameLayoutGuide.heightAnchor),
      toolbarButton.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
      toolbarButton.centerYAnchor.constraint(equalTo: centerYAnchor, constant: -8),
      toolbarButton.widthAnchor.constraint(equalToConstant: 36),
      toolbarButton.heightAnchor.constraint(equalToConstant: 36),
    ])
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let accessoryKey = "tab.accessory.\(selectedTabId)"
    guard !toolbarButton.isHidden, mountedSlotKeys.contains(accessoryKey) else {
      toolbarSlotHost.frame = .zero
      toolbarSlotHost.isHidden = true
      return
    }
    toolbarSlotHost.isHidden = false
    toolbarSlotHost.frame = toolbarButton.frame
    bringSubviewToFront(toolbarSlotHost)
  }

  func apply(tabs: [HomeContainerTab], selectedTabId: String, theme: HomeContainerTheme) {
    self.theme = theme
    self.selectedTabId = selectedTabId
    tabsById = Dictionary(uniqueKeysWithValues: tabs.map { ($0.id, $0) })
    backgroundColor = UIColor(homeContainerColor: theme.backgroundColor, fallback: .systemBackground)
    stack.arrangedSubviews.forEach { view in
      stack.removeArrangedSubview(view)
      view.removeFromSuperview()
    }
    buttons.removeAll()
    for tab in tabs {
      let button = HomeContainerInteractiveButton(type: .system)
      button.setTitle(tab.title, for: .normal)
      button.titleLabel?.font = HomeContainerTypography.medium(18)
      button.titleLabel?.numberOfLines = 1
      button.titleLabel?.adjustsFontSizeToFitWidth = true
      button.titleLabel?.minimumScaleFactor = 0.85
      button.accessibilityLabel = tab.title
      button.accessibilityIdentifier =
        HomeContainerAccessibilityIdentifier.tabIdentifier(for: tab.id)
      button.layer.cornerRadius = 12
      button.addAction(UIAction { [weak self] _ in self?.onSelect?(tab.id) }, for: .touchUpInside)
      button.alpha = 1
      button.isUserInteractionEnabled = true
      button.transform = CGAffineTransform(translationX: 0, y: -8)
      button.heightAnchor.constraint(equalToConstant: 36).isActive = true
      buttons[tab.id] = button
      stack.addArrangedSubview(button)
    }
    updateButtonColors()
    updateToolbar()
  }

  func setSelectedTab(_ tabId: String) {
    selectedTabId = tabId
    updateButtonColors()
    updateToolbar()
    onSlotLayoutChange?()
  }

  func setMountedSlotKeys(_ keys: Set<String>) {
    guard mountedSlotKeys != keys else { return }
    mountedSlotKeys = keys
    updateToolbar()
    onSlotLayoutChange?()
  }

  func slotFrame(forKey key: String) -> CGRect? {
    layoutIfNeeded()
    let labelPrefix = "tab.label."
    if key.hasPrefix(labelPrefix) {
      let tabId = String(key.dropFirst(labelPrefix.count))
      guard let button = buttons[tabId], !button.isHidden else { return nil }
      return button.convert(button.bounds, to: self)
    }
    let accessoryPrefix = "tab.accessory."
    guard key.hasPrefix(accessoryPrefix),
          String(key.dropFirst(accessoryPrefix.count)) == selectedTabId,
          !toolbarButton.isHidden else { return nil }
    return toolbarButton.convert(toolbarButton.bounds, to: self)
  }

  func slotHostView(forKey key: String) -> UIView? {
    layoutIfNeeded()
    let accessoryPrefix = "tab.accessory."
    guard key.hasPrefix(accessoryPrefix),
          String(key.dropFirst(accessoryPrefix.count)) == selectedTabId,
          !toolbarButton.isHidden else { return nil }
    return toolbarSlotHost
  }

  private func updateButtonColors() {
    guard let theme else { return }
    for (tabId, button) in buttons {
      let isSelected = tabId == selectedTabId
      if isSelected {
        button.accessibilityTraits.insert(.selected)
      } else {
        button.accessibilityTraits.remove(.selected)
      }
      let color = isSelected
        ? UIColor(homeContainerColor: theme.primaryTextColor, fallback: .label)
        : UIColor(homeContainerColor: theme.secondaryTextColor, fallback: .secondaryLabel)
      button.setTitleColor(color, for: .normal)
      button.titleLabel?.font = isSelected
        ? HomeContainerTypography.semibold(18)
        : HomeContainerTypography.medium(18)
      button.configureInteractiveColors(
        normal: .clear,
        hover: UIColor(
          homeContainerColor: theme.hoverColor ?? theme.cardColor,
          fallback: .tertiarySystemBackground
        ),
        active: UIColor(
          homeContainerColor: theme.activeColor ?? theme.cardColor,
          fallback: .systemGray5
        )
      )
    }
  }

  private func updateToolbar() {
    guard let theme else { return }
    let accessoryKey = "tab.accessory.\(selectedTabId)"
    toolbarButton.isHidden = tabsById[selectedTabId]?.toolbarAction == nil &&
      !mountedSlotKeys.contains(accessoryKey)
    toolbarButton.tintColor = UIColor(
      homeContainerColor: theme.secondaryTextColor,
      fallback: .secondaryLabel
    )
    toolbarButton.configureInteractiveColors(
      normal: .clear,
      hover: UIColor(
        homeContainerColor: theme.hoverColor ?? theme.cardColor,
        fallback: .tertiarySystemBackground
      ),
      active: UIColor(
        homeContainerColor: theme.activeColor ?? theme.cardColor,
        fallback: .systemGray5
      )
    )
    toolbarButton.alpha = 0
    toolbarButton.isUserInteractionEnabled = false
  }
}

private final class HomeContainerHorizontalCell: UITableViewCell {
  private let scrollView = HomeContainerPagerChildHorizontalScrollView()
  private let stack = UIStackView()
  private var itemIds: [String] = []

  override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
    super.init(style: style, reuseIdentifier: reuseIdentifier)
    selectionStyle = .none
    scrollView.showsHorizontalScrollIndicator = false
    scrollView.alwaysBounceHorizontal = true
    scrollView.isDirectionalLockEnabled = true
    scrollView.translatesAutoresizingMaskIntoConstraints = false
    stack.axis = .horizontal
    stack.spacing = 10
    stack.translatesAutoresizingMaskIntoConstraints = false
    contentView.addSubview(scrollView)
    scrollView.addSubview(stack)
    NSLayoutConstraint.activate([
      scrollView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
      scrollView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
      scrollView.topAnchor.constraint(equalTo: contentView.topAnchor),
      scrollView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
      stack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor, constant: 16),
      stack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor, constant: -16),
      stack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 6),
      stack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -6),
      stack.heightAnchor.constraint(equalTo: scrollView.frameLayoutGuide.heightAnchor, constant: -12),
    ])
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func apply(
    section: HomeContainerSection,
    theme: HomeContainerTheme,
    onAction: @escaping (String, String) -> Void
  ) {
    backgroundColor = UIColor(homeContainerColor: theme.backgroundColor, fallback: .systemBackground)
    let nextIds = section.items.map(\.id)
    if nextIds != itemIds {
      itemIds = nextIds
      stack.arrangedSubviews.forEach { $0.removeFromSuperview() }
      for item in section.items {
        let control = HomeContainerHorizontalCardControl(item: item, theme: theme)
        if let actionId = item.actionId, !actionId.isEmpty {
          control.onPress = { onAction(actionId, item.id) }
        }
        stack.addArrangedSubview(control)
      }
    } else {
      for (index, item) in section.items.enumerated() {
        (stack.arrangedSubviews[index] as? HomeContainerHorizontalCardControl)?
          .apply(item: item, theme: theme)
      }
    }
  }
}

private final class HomeContainerHorizontalCardControl: HomeContainerTapControl {
  private let imageView = UIImageView()
  private let titleLabel = UILabel()
  private let subtitleLabel = UILabel()
  private let labelsStack = UIStackView()
  private var widthConstraint: NSLayoutConstraint?
  private var isSupportPromo = false
  private var imageTask: HomeContainerImageRequest?
  private var representedImageURL: URL?
  private var hasAppliedImage = false

  init(item: HomeContainerItem, theme: HomeContainerTheme) {
    super.init(frame: .zero)
    layer.cornerRadius = 16
    clipsToBounds = true
    let widthConstraint = widthAnchor.constraint(equalToConstant: 250)
    widthConstraint.isActive = true
    self.widthConstraint = widthConstraint
    imageView.contentMode = .scaleAspectFill
    imageView.layer.cornerRadius = 20
    imageView.clipsToBounds = true
    titleLabel.font = HomeContainerTypography.system(16, weight: .semibold)
    titleLabel.numberOfLines = 2
    subtitleLabel.font = HomeContainerTypography.system(13)
    subtitleLabel.numberOfLines = 2
    labelsStack.axis = .vertical
    labelsStack.spacing = 4
    labelsStack.addArrangedSubview(titleLabel)
    labelsStack.addArrangedSubview(subtitleLabel)
    addSubview(imageView)
    addSubview(labelsStack)
    apply(item: item, theme: theme)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    if isSupportPromo {
      imageView.frame = bounds
      labelsStack.frame = CGRect(
        x: 16,
        y: 36,
        width: max(0, bounds.width * 0.58 - 16),
        height: max(0, bounds.height - 72)
      )
      labelsStack.alignment = .leading
      labelsStack.distribution = .fill
    } else {
      imageView.frame = CGRect(x: 16, y: (bounds.height - 40) / 2, width: 40, height: 40)
      labelsStack.frame = CGRect(
        x: 68,
        y: 0,
        width: max(0, bounds.width - 84),
        height: bounds.height
      )
      labelsStack.alignment = .fill
    }
  }

  func apply(item: HomeContainerItem, theme: HomeContainerTheme) {
    isSupportPromo = item.renderer == "supportPromo"
    widthConstraint?.constant = isSupportPromo ? 361 : 250
    imageView.layer.cornerRadius = isSupportPromo ? 16 : 20
    configureInteractiveColors(
      normal: UIColor(homeContainerColor: theme.cardColor, fallback: .secondarySystemBackground),
      hover: UIColor(
        homeContainerColor: theme.hoverColor ?? theme.cardColor,
        fallback: .tertiarySystemBackground
      ),
      active: UIColor(
        homeContainerColor: theme.activeColor ?? theme.cardColor,
        fallback: .systemGray5
      )
    )
    titleLabel.textColor = isSupportPromo
      ? UIColor.black
      : UIColor(homeContainerColor: theme.primaryTextColor, fallback: .label)
    subtitleLabel.textColor = isSupportPromo
      ? UIColor.darkGray
      : UIColor(homeContainerColor: theme.secondaryTextColor, fallback: .secondaryLabel)
    titleLabel.text = (item.renderer == "market" || item.renderer == "perps") && item.badge?.isEmpty == false
      ? "\(item.title)  \(item.badge ?? "")"
      : item.title
    subtitleLabel.text = item.subtitle ?? item.value
    subtitleLabel.isHidden = subtitleLabel.text?.isEmpty != false
    loadImage(item.imageUrl)
    setNeedsLayout()
  }

  private func loadImage(_ value: String?) {
    let url = value.flatMap(URL.init(string:)).flatMap {
      $0.scheme == "https" || $0.scheme == "http" || $0.isFileURL ? $0 : nil
    }
    guard !hasAppliedImage || representedImageURL != url else { return }
    hasAppliedImage = true
    imageTask?.cancel()
    imageTask = nil
    representedImageURL = url
    imageView.image = nil
    imageView.isHidden = true
    guard let url else { return }
    imageTask = HomeContainerImageLoader.shared.load(url: url) { [weak self] image in
      guard let self, self.representedImageURL == url else { return }
      self.imageView.image = image
      self.imageView.isHidden = image == nil
    }
  }
}

private final class HomeContainerSectionTitleCell: UITableViewCell {
  private let titleLabel = UILabel()
  private let actionButton = HomeContainerInteractiveButton(type: .system)
  private var onAction: (() -> Void)?

  override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
    super.init(style: style, reuseIdentifier: reuseIdentifier)
    selectionStyle = .none
    titleLabel.font = HomeContainerTypography.semibold(20)
    titleLabel.translatesAutoresizingMaskIntoConstraints = false
    actionButton.titleLabel?.font = HomeContainerTypography.regular(14)
    actionButton.translatesAutoresizingMaskIntoConstraints = false
    actionButton.addTarget(self, action: #selector(handleAction), for: .touchUpInside)
    contentView.addSubview(titleLabel)
    contentView.addSubview(actionButton)
    NSLayoutConstraint.activate([
      titleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
      titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: actionButton.leadingAnchor, constant: -8),
      titleLabel.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
      actionButton.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
      actionButton.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
    ])
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func apply(
    section: HomeContainerSection,
    sectionId: String,
    theme: HomeContainerTheme,
    onAction: @escaping () -> Void
  ) {
    backgroundColor = UIColor(homeContainerColor: theme.backgroundColor, fallback: .systemBackground)
    titleLabel.textColor = UIColor(homeContainerColor: theme.primaryTextColor, fallback: .label)
    titleLabel.text = section.title
    let actionColor = UIColor(
      homeContainerColor: theme.secondaryTextColor,
      fallback: .secondaryLabel
    )
    let isMarketRecommendation = section.layout == "marketRecommendations"
    actionButton.setTitle(
      section.actionTitle.map { isMarketRecommendation ? $0 : "\($0)  ›" },
      for: .normal
    )
    actionButton.setImage(
      isMarketRecommendation
        ? HomeContainerIcons.plusSmall
        : nil,
      for: .normal
    )
    actionButton.imageEdgeInsets = isMarketRecommendation
      ? UIEdgeInsets(top: 0, left: -4, bottom: 0, right: 4)
      : .zero
    actionButton.tintColor = actionColor
    actionButton.setTitleColor(actionColor, for: .normal)
    actionButton.setTitleColor(actionColor.withAlphaComponent(0.45), for: .disabled)
    actionButton.isHidden = section.actionTitle?.isEmpty != false
    actionButton.isEnabled = section.actionDisabled != true
    actionButton.accessibilityIdentifier = isMarketRecommendation
      ? "native-home-market-add-recommended"
      : "native-home-section-action-\(section.id)"
    actionButton.layer.cornerRadius = 10
    actionButton.configureInteractiveColors(
      normal: .clear,
      hover: UIColor(
        homeContainerColor: theme.hoverColor ?? theme.cardColor,
        fallback: .tertiarySystemBackground
      ),
      active: UIColor(
        homeContainerColor: theme.activeColor ?? theme.cardColor,
        fallback: .systemGray5
      )
    )
    self.onAction = onAction
    titleLabel.font = sectionId.hasPrefix("section:history:")
      ? HomeContainerTypography.system(13, weight: .semibold)
      : HomeContainerTypography.semibold(20)
    titleLabel.textColor = sectionId.hasPrefix("section:history:")
      ? UIColor(homeContainerColor: theme.secondaryTextColor, fallback: .secondaryLabel)
      : UIColor(homeContainerColor: theme.primaryTextColor, fallback: .label)
  }

  @objc private func handleAction() {
    onAction?()
  }
}

private final class HomeContainerMarketRecommendationGridCell: UITableViewCell {
  private let cards = [
    HomeContainerMarketRecommendationCardControl(),
    HomeContainerMarketRecommendationCardControl(),
  ]

  override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
    super.init(style: style, reuseIdentifier: reuseIdentifier)
    selectionStyle = .none
    cards.forEach(contentView.addSubview)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let horizontalPadding: CGFloat = 20
    let gap: CGFloat = 10
    let cardWidth = max(0, (contentView.bounds.width - horizontalPadding * 2 - gap) / 2)
    for (index, card) in cards.enumerated() {
      card.frame = CGRect(
        x: horizontalPadding + CGFloat(index) * (cardWidth + gap),
        y: 0,
        width: cardWidth,
        height: max(60, contentView.bounds.height - 8)
      )
    }
  }

  func apply(
    items: [HomeContainerItem],
    theme: HomeContainerTheme,
    onAction: @escaping (String, String) -> Void
  ) {
    backgroundColor = UIColor(homeContainerColor: theme.backgroundColor, fallback: .systemBackground)
    for (index, card) in cards.enumerated() {
      guard items.indices.contains(index) else {
        card.isHidden = true
        card.prepareForReuse()
        continue
      }
      card.isHidden = false
      card.apply(item: items[index], theme: theme, onAction: onAction)
    }
  }

  override func prepareForReuse() {
    super.prepareForReuse()
    cards.forEach { $0.prepareForReuse() }
  }
}

private final class HomeContainerMarketRecommendationCardControl: UIControl {
  private let iconContainer = UIView()
  private let iconImageView = UIImageView()
  private let badgeContainerView = UIView()
  private let badgeImageView = UIImageView()
  private let titleLabel = UILabel()
  private let leverageLabel = HomeContainerInsetLabel()
  private let titleAccessoryImageView = UIImageView()
  private let recognizedImageView = UIImageView()
  private let titleStack: UIStackView
  private let subtitleLabel = UILabel()
  private let checkImageView = UIImageView()
  private var imageTask: HomeContainerImageRequest?
  private var badgeImageTask: HomeContainerImageRequest?
  private var titleAccessoryImageTask: HomeContainerImageRequest?
  private var representedImageSignature: String?
  private var representedBadgeImageURL: URL?
  private var representedTitleAccessoryImageURL: URL?
  private var itemId = ""
  private var actionId = ""
  private var onAction: ((String, String) -> Void)?
  private var normalBackgroundColor = UIColor.clear
  private var hoverBackgroundColor = UIColor.clear
  private var highlightedBackgroundColor = UIColor.clear
  private var isPointerHovering = false

  override init(frame: CGRect) {
    titleStack = UIStackView(arrangedSubviews: [
      titleLabel,
      leverageLabel,
      titleAccessoryImageView,
      recognizedImageView,
    ])
    super.init(frame: frame)
    layer.cornerRadius = 12
    layer.borderWidth = 0.5
    clipsToBounds = true

    iconContainer.layer.cornerRadius = 16
    iconContainer.clipsToBounds = true
    iconImageView.contentMode = .scaleAspectFill
    iconImageView.clipsToBounds = true
    iconContainer.addSubview(iconImageView)

    badgeContainerView.layer.cornerRadius = 10
    badgeContainerView.clipsToBounds = true
    badgeImageView.contentMode = .scaleAspectFill
    badgeImageView.layer.cornerRadius = 8
    badgeImageView.clipsToBounds = true
    badgeContainerView.addSubview(badgeImageView)

    titleLabel.font = HomeContainerTypography.medium(14)
    titleLabel.numberOfLines = 1
    titleLabel.lineBreakMode = .byTruncatingTail
    titleLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
    leverageLabel.font = HomeContainerTypography.regular(10)
    leverageLabel.contentInsets = UIEdgeInsets(top: 0, left: 4, bottom: 0, right: 4)
    leverageLabel.layer.cornerRadius = 3
    leverageLabel.clipsToBounds = true
    titleAccessoryImageView.contentMode = .scaleAspectFill
    titleAccessoryImageView.layer.cornerRadius = 7
    titleAccessoryImageView.clipsToBounds = true
    recognizedImageView.image = HomeContainerMarketArtwork.recognized(size: 14)
    recognizedImageView.contentMode = .scaleAspectFit
    titleStack.axis = .horizontal
    titleStack.alignment = .center
    titleStack.spacing = 4

    subtitleLabel.font = HomeContainerTypography.regular(12)
    subtitleLabel.numberOfLines = 1
    subtitleLabel.lineBreakMode = .byTruncatingTail
    checkImageView.contentMode = .scaleAspectFit

    [
      iconContainer,
      badgeContainerView,
      titleStack,
      subtitleLabel,
      checkImageView,
    ].forEach {
      $0.isUserInteractionEnabled = false
      addSubview($0)
    }
    addAction(UIAction { [weak self] _ in
      guard let self, !self.actionId.isEmpty else { return }
      self.onAction?(self.actionId, self.itemId)
    }, for: .touchUpInside)
    addGestureRecognizer(UIHoverGestureRecognizer(target: self, action: #selector(handleHover(_:))))
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override var isHighlighted: Bool {
    didSet {
      updateInteractiveBackgroundColor()
    }
  }

  @objc private func handleHover(_ gestureRecognizer: UIHoverGestureRecognizer) {
    switch gestureRecognizer.state {
    case .began, .changed:
      isPointerHovering = true
    case .ended, .cancelled, .failed:
      isPointerHovering = false
    default:
      break
    }
    updateInteractiveBackgroundColor()
  }

  private func updateInteractiveBackgroundColor() {
    if isHighlighted {
      backgroundColor = highlightedBackgroundColor
    } else if isPointerHovering {
      backgroundColor = hoverBackgroundColor
    } else {
      backgroundColor = normalBackgroundColor
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    iconContainer.frame = CGRect(x: 10, y: (bounds.height - 32) / 2, width: 32, height: 32)
    iconImageView.frame = iconContainer.bounds
    badgeContainerView.frame = CGRect(
      x: 32,
      y: iconContainer.frame.maxY - 16,
      width: 20,
      height: 20
    )
    badgeImageView.frame = CGRect(x: 2, y: 2, width: 16, height: 16)
    checkImageView.frame = CGRect(
      x: bounds.width - 30,
      y: (bounds.height - 20) / 2,
      width: 20,
      height: 20
    )
    let textX: CGFloat = 54
    let textWidth = max(0, checkImageView.frame.minX - textX - 4)
    let titleHeight = max(20, ceil(titleLabel.font.lineHeight))
    let subtitleHeight = max(18, ceil(subtitleLabel.font.lineHeight))
    let textTop = max(4, (bounds.height - titleHeight - subtitleHeight - 1) / 2)
    let intrinsicTitleWidth = titleStack.systemLayoutSizeFitting(
      UIView.layoutFittingCompressedSize
    ).width
    titleStack.frame = CGRect(
      x: textX,
      y: textTop,
      width: min(textWidth, ceil(intrinsicTitleWidth)),
      height: titleHeight
    )
    subtitleLabel.frame = CGRect(
      x: textX,
      y: titleStack.frame.maxY + 1,
      width: textWidth,
      height: subtitleHeight
    )
    leverageLabel.frame.size.height = max(16, ceil(leverageLabel.font.lineHeight) + 4)
    titleAccessoryImageView.frame.size = CGSize(width: 14, height: 14)
    recognizedImageView.frame.size = CGSize(width: 14, height: 14)
  }

  func apply(
    item: HomeContainerItem,
    theme: HomeContainerTheme,
    onAction: @escaping (String, String) -> Void
  ) {
    itemId = item.id
    actionId = item.actionId ?? ""
    self.onAction = onAction
    normalBackgroundColor = UIColor(
      homeContainerColor: theme.cardColor,
      fallback: .secondarySystemBackground
    )
    hoverBackgroundColor = UIColor(
      homeContainerColor: theme.hoverColor ?? theme.cardColor,
      fallback: .tertiarySystemBackground
    )
    highlightedBackgroundColor = UIColor(
      homeContainerColor: theme.activeColor ?? theme.hoverColor ?? theme.cardColor,
      fallback: .systemGray5
    )
    backgroundColor = normalBackgroundColor
    layer.borderColor = UIColor(
      homeContainerColor: theme.dividerColor,
      fallback: .separator
    ).cgColor
    badgeContainerView.backgroundColor = UIColor(
      homeContainerColor: theme.backgroundColor,
      fallback: .systemBackground
    )
    titleLabel.text = item.title
    titleLabel.textColor = UIColor(
      homeContainerColor: theme.primaryTextColor,
      fallback: .label
    )
    subtitleLabel.text = item.subtitle
    subtitleLabel.textColor = UIColor(
      homeContainerColor: theme.secondaryTextColor,
      fallback: .secondaryLabel
    )
    leverageLabel.text = item.badge
    leverageLabel.textColor = UIColor(
      homeContainerColor: theme.accentColor,
      fallback: .systemBlue
    )
    leverageLabel.backgroundColor = normalBackgroundColor
    leverageLabel.isHidden = item.badge?.isEmpty != false
    recognizedImageView.tintColor = UIColor(
      homeContainerColor: theme.positiveColor,
      fallback: .systemGreen
    )
    recognizedImageView.isHidden = item.communityRecognized != true
    checkImageView.image = item.favorite == true
      ? HomeContainerMarketArtwork.checkRadio(size: 20)
      : nil
    checkImageView.tintColor = UIColor(
      homeContainerColor: theme.primaryTextColor,
      fallback: .label
    )
    accessibilityIdentifier = "native-home-market-recommendation-\(item.id)"
    accessibilityLabel = [item.title, item.subtitle].compactMap { $0 }.joined(separator: ", ")
    accessibilityValue = item.favorite == true ? "selected" : "not selected"
    accessibilityTraits = [.button]
    loadPrimaryImage(
      item.imageUrl,
      fallbacks: item.imageUrls,
      theme: theme
    )
    loadBadgeImage(item.badgeImageUrl)
    badgeContainerView.isHidden = badgeImageView.image == nil
    loadTitleAccessoryImage(item.titleAccessoryImageUrl)
    titleAccessoryImageView.isHidden = titleAccessoryImageView.image == nil
    setNeedsLayout()
  }

  func prepareForReuse() {
    imageTask?.cancel()
    badgeImageTask?.cancel()
    titleAccessoryImageTask?.cancel()
    imageTask = nil
    badgeImageTask = nil
    titleAccessoryImageTask = nil
    representedImageSignature = nil
    representedBadgeImageURL = nil
    representedTitleAccessoryImageURL = nil
    iconImageView.image = nil
    badgeImageView.image = nil
    titleAccessoryImageView.image = nil
    itemId = ""
    actionId = ""
    onAction = nil
  }

  private func loadPrimaryImage(
    _ value: String?,
    fallbacks: [String]?,
    theme: HomeContainerTheme
  ) {
    let candidates = ([value].compactMap { $0 } + (fallbacks ?? []))
      .reduce(into: [URL]()) { result, candidate in
        guard let url = URL(string: candidate),
              url.scheme == "https" || url.scheme == "http",
              !result.contains(url) else { return }
        result.append(url)
      }
    let signature = candidates.map(\.absoluteString).joined(separator: "|") +
      "|\(theme.backgroundColor)|\(theme.subduedIconColor ?? theme.secondaryTextColor)"
    guard representedImageSignature != signature else { return }
    imageTask?.cancel()
    imageTask = nil
    representedImageSignature = signature
    let backgroundColor = UIColor(
      homeContainerColor: theme.backgroundColor,
      fallback: .systemBackground
    )
    iconContainer.backgroundColor = HomeContainerMarketArtwork.cryptoCoinFallbackBackgroundColor(
      for: backgroundColor
    )
    iconImageView.contentMode = .scaleAspectFit
    iconImageView.image = HomeContainerMarketArtwork.cryptoCoinFallback(
      size: 32,
      color: UIColor(
        homeContainerColor: theme.subduedIconColor ?? theme.secondaryTextColor,
        fallback: .secondaryLabel
      )
    )
    loadPrimaryImageCandidate(candidates, index: 0, signature: signature)
  }

  private func loadPrimaryImageCandidate(
    _ candidates: [URL],
    index: Int,
    signature: String
  ) {
    guard candidates.indices.contains(index) else { return }
    let url = candidates[index]
    imageTask = HomeContainerImageLoader.shared.load(
      url: url,
      retryOnFailure: index == candidates.count - 1
    ) { [weak self] image in
      guard let self, self.representedImageSignature == signature else { return }
      if let image {
        self.iconImageView.contentMode = .scaleAspectFill
        self.iconImageView.image = image
      } else {
        self.loadPrimaryImageCandidate(candidates, index: index + 1, signature: signature)
      }
    }
  }

  private func loadBadgeImage(_ value: String?) {
    let url = value.flatMap(URL.init(string:)).flatMap {
      $0.scheme == "https" || $0.scheme == "http" || $0.isFileURL ? $0 : nil
    }
    guard representedBadgeImageURL != url else { return }
    badgeImageTask?.cancel()
    badgeImageTask = nil
    representedBadgeImageURL = url
    badgeImageView.image = nil
    badgeContainerView.isHidden = true
    guard let url else { return }
    let request = HomeContainerImageLoader.shared.load(url: url) { [weak self] image in
      guard let self, self.representedBadgeImageURL == url else { return }
      self.badgeImageView.image = image
      self.badgeContainerView.isHidden = image == nil
    }
    badgeImageTask = request
  }

  private func loadTitleAccessoryImage(_ value: String?) {
    let url = value.flatMap(URL.init(string:)).flatMap {
      $0.scheme == "https" || $0.scheme == "http" || $0.isFileURL ? $0 : nil
    }
    guard representedTitleAccessoryImageURL != url else { return }
    titleAccessoryImageTask?.cancel()
    titleAccessoryImageTask = nil
    representedTitleAccessoryImageURL = url
    titleAccessoryImageView.image = nil
    titleAccessoryImageView.isHidden = true
    guard let url else { return }
    let request = HomeContainerImageLoader.shared.load(url: url) { [weak self] image in
      guard let self, self.representedTitleAccessoryImageURL == url else { return }
      self.titleAccessoryImageView.image = image
      self.titleAccessoryImageView.isHidden = image == nil
    }
    titleAccessoryImageTask = request
  }
}

private final class HomeContainerNFTGridCell: UITableViewCell {
  private let cards = [HomeContainerNFTCardControl(), HomeContainerNFTCardControl()]

  override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
    super.init(style: style, reuseIdentifier: reuseIdentifier)
    selectionStyle = .none
    cards.forEach(contentView.addSubview)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let cardWidth = contentView.bounds.width / 2
    for (index, card) in cards.enumerated() {
      card.frame = CGRect(
        x: CGFloat(index) * cardWidth,
        y: 0,
        width: cardWidth,
        height: contentView.bounds.height
      )
    }
  }

  func apply(
    items: [HomeContainerItem],
    theme: HomeContainerTheme,
    onAction: @escaping (String, String) -> Void
  ) {
    backgroundColor = UIColor(homeContainerColor: theme.backgroundColor, fallback: .systemBackground)
    for (index, card) in cards.enumerated() {
      guard items.indices.contains(index) else {
        card.isHidden = true
        card.prepareForReuse()
        continue
      }
      card.isHidden = false
      card.apply(item: items[index], theme: theme, onAction: onAction)
    }
  }

  override func prepareForReuse() {
    super.prepareForReuse()
    cards.forEach { $0.prepareForReuse() }
  }
}

private final class HomeContainerNFTCardControl: HomeContainerTapControl {
  private let imageView = UIImageView()
  private let collectionLabel = UILabel()
  private let titleLabel = UILabel()
  private let amountLabel = UILabel()
  private let networkImageView = UIImageView()
  private var imageTask: HomeContainerImageRequest?
  private var networkImageTask: HomeContainerImageRequest?
  private var representedImageURL: URL?
  private var representedNetworkImageURL: URL?
  private var imagePlaceholderColor = UIColor.tertiaryLabel
  private var hasLoadedPrimaryImage = false
  private var itemId = ""
  private var actionId = ""
  private var onAction: ((String, String) -> Void)?

  override init(frame: CGRect) {
    super.init(frame: frame)
    imageView.contentMode = .scaleAspectFill
    imageView.clipsToBounds = true
    imageView.layer.cornerRadius = 10
    collectionLabel.font = HomeContainerTypography.regular(12)
    collectionLabel.numberOfLines = 1
    titleLabel.font = HomeContainerTypography.medium(16)
    titleLabel.numberOfLines = 1
    amountLabel.font = HomeContainerTypography.system(13, weight: .semibold)
    amountLabel.textColor = .white
    amountLabel.backgroundColor = UIColor.black.withAlphaComponent(0.75)
    amountLabel.textAlignment = .center
    amountLabel.layer.cornerRadius = 9
    amountLabel.clipsToBounds = true
    networkImageView.contentMode = .scaleAspectFill
    networkImageView.clipsToBounds = true
    networkImageView.layer.cornerRadius = 8
    networkImageView.layer.borderWidth = 1
    networkImageView.layer.borderColor = UIColor.systemBackground.cgColor
    [imageView, collectionLabel, titleLabel, amountLabel, networkImageView].forEach(addSubview)
    onPress = { [weak self] in
      guard let self, !self.actionId.isEmpty else { return }
      self.onAction?(self.actionId, self.itemId)
    }
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let padding: CGFloat = 10
    let imageWidth = max(0, bounds.width - padding * 2)
    imageView.frame = CGRect(x: padding, y: padding, width: imageWidth, height: imageWidth)
    let collectionTop = imageView.frame.maxY + 8
    let collectionHeight = max(18, ceil(collectionLabel.font.lineHeight))
    let titleHeight = max(22, ceil(titleLabel.font.lineHeight))
    collectionLabel.frame = CGRect(
      x: padding,
      y: collectionTop,
      width: max(0, imageWidth - (networkImageView.isHidden ? 0 : 22)),
      height: collectionHeight
    )
    titleLabel.frame = CGRect(
      x: padding,
      y: collectionLabel.frame.maxY + 2,
      width: imageWidth,
      height: titleHeight
    )
    networkImageView.frame = CGRect(
      x: bounds.width - padding - 16,
      y: collectionTop + 1,
      width: 16,
      height: 16
    )
    let amountWidth = max(30, amountLabel.intrinsicContentSize.width + 12)
    let amountHeight = max(18, ceil(amountLabel.font.lineHeight) + 4)
    amountLabel.frame = CGRect(
      x: imageView.frame.maxX - amountWidth - 6,
      y: imageView.frame.maxY - amountHeight - 6,
      width: amountWidth,
      height: amountHeight
    )
    amountLabel.layer.cornerRadius = amountHeight / 2
  }

  func apply(
    item: HomeContainerItem,
    theme: HomeContainerTheme,
    onAction: @escaping (String, String) -> Void
  ) {
    itemId = item.id
    actionId = item.actionId ?? ""
    self.onAction = onAction
    configureInteractiveColors(
      normal: UIColor(homeContainerColor: theme.backgroundColor, fallback: .systemBackground),
      hover: UIColor(
        homeContainerColor: theme.hoverColor ?? theme.cardColor,
        fallback: .tertiarySystemBackground
      ),
      active: UIColor(
        homeContainerColor: theme.activeColor ?? theme.cardColor,
        fallback: .systemGray5
      )
    )
    imageView.backgroundColor = UIColor(
      homeContainerColor: theme.strongColor ?? theme.cardColor,
      fallback: .secondarySystemBackground
    )
    imagePlaceholderColor = UIColor(
      homeContainerColor: theme.subduedIconColor ?? theme.secondaryTextColor,
      fallback: .tertiaryLabel
    )
    collectionLabel.text = item.subtitle?.isEmpty == false ? item.subtitle : "-"
    collectionLabel.textColor = UIColor(
      homeContainerColor: theme.secondaryTextColor,
      fallback: .secondaryLabel
    )
    titleLabel.text = item.title.isEmpty ? "-" : item.title
    titleLabel.textColor = UIColor(homeContainerColor: theme.primaryTextColor, fallback: .label)
    amountLabel.text = item.value
    amountLabel.isHidden = item.value?.isEmpty != false
    networkImageView.layer.borderColor = UIColor(
      homeContainerColor: theme.backgroundColor,
      fallback: .systemBackground
    ).cgColor
    accessibilityLabel = [collectionLabel.text, titleLabel.text].compactMap { $0 }.joined(separator: ", ")
    if !hasLoadedPrimaryImage {
      applyImagePlaceholder()
    }
    loadImage(item.imageUrl, target: imageView, isNetwork: false)
    loadImage(item.badgeImageUrl, target: networkImageView, isNetwork: true)
    setNeedsLayout()
  }

  func prepareForReuse() {
    imageTask?.cancel()
    networkImageTask?.cancel()
    imageTask = nil
    networkImageTask = nil
    representedImageURL = nil
    representedNetworkImageURL = nil
    imageView.image = nil
    hasLoadedPrimaryImage = false
    networkImageView.image = nil
    networkImageView.isHidden = true
    amountLabel.isHidden = true
    itemId = ""
    actionId = ""
    onAction = nil
  }

  private func loadImage(_ value: String?, target: UIImageView, isNetwork: Bool) {
    let url = value.flatMap(URL.init(string:)).flatMap {
      $0.scheme == "https" || $0.scheme == "http" || $0.isFileURL ? $0 : nil
    }
    if isNetwork {
      guard representedNetworkImageURL != url else { return }
      networkImageTask?.cancel()
      representedNetworkImageURL = url
      networkImageView.image = nil
      networkImageView.isHidden = true
    } else {
      guard representedImageURL != url else { return }
      imageTask?.cancel()
      representedImageURL = url
      hasLoadedPrimaryImage = false
      applyImagePlaceholder()
    }
    guard let url else { return }
    let task = HomeContainerImageLoader.shared.load(url: url) { [weak self] image in
      guard let self else { return }
      if isNetwork {
        guard self.representedNetworkImageURL == url else { return }
        self.networkImageView.image = image
        self.networkImageView.isHidden = image == nil
      } else {
        guard self.representedImageURL == url else { return }
        if let image {
          self.hasLoadedPrimaryImage = true
          self.imageView.contentMode = .scaleAspectFill
          self.imageView.image = image
        } else {
          self.hasLoadedPrimaryImage = false
          self.applyImagePlaceholder()
        }
      }
    }
    if isNetwork {
      networkImageTask = task
    } else {
      imageTask = task
    }
  }

  private func applyImagePlaceholder() {
    imageView.contentMode = .center
    imageView.tintColor = imagePlaceholderColor
    imageView.image = UIImage(systemName: "photo")
  }
}

private enum HomeContainerTypography {
  private static func scaled(
    _ font: UIFont,
    textStyle: UIFont.TextStyle,
    maximumScale: CGFloat = 1.4
  ) -> UIFont {
    UIFontMetrics(forTextStyle: textStyle).scaledFont(
      for: font,
      maximumPointSize: font.pointSize * maximumScale
    )
  }

  static func regular(_ size: CGFloat, textStyle: UIFont.TextStyle = .body) -> UIFont {
    scaled(
      UIFont(name: "Roobert-Regular", size: size) ?? .systemFont(ofSize: size),
      textStyle: textStyle
    )
  }

  static func medium(_ size: CGFloat, textStyle: UIFont.TextStyle = .body) -> UIFont {
    scaled(
      UIFont(name: "Roobert-Medium", size: size) ?? .systemFont(ofSize: size, weight: .medium),
      textStyle: textStyle
    )
  }

  static func semibold(_ size: CGFloat, textStyle: UIFont.TextStyle = .headline) -> UIFont {
    scaled(
      UIFont(name: "Roobert-SemiBold", size: size) ?? .systemFont(ofSize: size, weight: .semibold),
      textStyle: textStyle
    )
  }

  static func system(
    _ size: CGFloat,
    weight: UIFont.Weight = .regular,
    textStyle: UIFont.TextStyle = .body,
    maximumScale: CGFloat = 1.4
  ) -> UIFont {
    scaled(
      .systemFont(ofSize: size, weight: weight),
      textStyle: textStyle,
      maximumScale: maximumScale
    )
  }
}

private enum HomeContainerMarketArtwork {
  static func star(filled: Bool, size: CGFloat) -> UIImage {
    let path = UIBezierPath()
    if filled {
      path.move(to: CGPoint(x: 15.405, y: 7.313))
      path.addLine(to: CGPoint(x: 23.245, y: 8.347))
      path.addLine(to: CGPoint(x: 17.51, y: 13.79))
      path.addLine(to: CGPoint(x: 18.95, y: 21.564))
      path.addLine(to: CGPoint(x: 12, y: 17.793))
      path.addLine(to: CGPoint(x: 5.052, y: 21.564))
      path.addLine(to: CGPoint(x: 6.492, y: 13.79))
      path.addLine(to: CGPoint(x: 0.756, y: 8.347))
      path.addLine(to: CGPoint(x: 8.595, y: 7.313))
      path.addLine(to: CGPoint(x: 12, y: 0.178))
      path.close()
    } else {
      path.usesEvenOddFillRule = true
      path.move(to: CGPoint(x: 15.455, y: 7.243))
      path.addLine(to: CGPoint(x: 23.184, y: 8.366))
      path.addLine(to: CGPoint(x: 17.592, y: 13.816))
      path.addLine(to: CGPoint(x: 18.912, y: 21.514))
      path.addLine(to: CGPoint(x: 12, y: 17.879))
      path.addLine(to: CGPoint(x: 5.089, y: 21.514))
      path.addLine(to: CGPoint(x: 6.409, y: 13.816))
      path.addLine(to: CGPoint(x: 0.817, y: 8.366))
      path.addLine(to: CGPoint(x: 8.545, y: 7.243))
      path.addLine(to: CGPoint(x: 12, y: 0.24))
      path.close()
      path.move(to: CGPoint(x: 9.872, y: 9.071))
      path.addLine(to: CGPoint(x: 5.113, y: 9.761))
      path.addLine(to: CGPoint(x: 8.557, y: 13.119))
      path.addLine(to: CGPoint(x: 7.743, y: 17.857))
      path.addLine(to: CGPoint(x: 12, y: 15.62))
      path.addLine(to: CGPoint(x: 12.465, y: 15.865))
      path.addLine(to: CGPoint(x: 16.256, y: 17.858))
      path.addLine(to: CGPoint(x: 15.443, y: 13.119))
      path.addLine(to: CGPoint(x: 18.886, y: 9.762))
      path.addLine(to: CGPoint(x: 14.128, y: 9.072))
      path.addLine(to: CGPoint(x: 12, y: 4.758))
      path.close()
    }

    let format = UIGraphicsImageRendererFormat()
    format.opaque = false
    let rendered = UIGraphicsImageRenderer(size: CGSize(width: size, height: size), format: format).image { _ in
      path.apply(CGAffineTransform(scaleX: size / 24, y: size / 24))
      UIColor.black.setFill()
      path.fill()
    }
    return rendered.withRenderingMode(.alwaysTemplate)
  }

  static func checkRadio(size: CGFloat) -> UIImage {
    let path = UIBezierPath(ovalIn: CGRect(x: 2, y: 2, width: 20, height: 20))
    let check = UIBezierPath()
    check.move(to: CGPoint(x: 10.426, y: 13.512))
    check.addLine(to: CGPoint(x: 8.5, y: 11.586))
    check.addLine(to: CGPoint(x: 7.086, y: 13))
    check.addLine(to: CGPoint(x: 10.574, y: 16.488))
    check.addLine(to: CGPoint(x: 16.407, y: 9.359))
    check.addLine(to: CGPoint(x: 14.859, y: 8.093))
    check.close()
    path.append(check)
    path.usesEvenOddFillRule = true

    let rendered = UIGraphicsImageRenderer(size: CGSize(width: size, height: size)).image { _ in
      path.apply(CGAffineTransform(scaleX: size / 24, y: size / 24))
      UIColor.black.setFill()
      path.fill()
    }
    return rendered.withRenderingMode(.alwaysTemplate)
  }

  static func chevronRightSmall(size: CGFloat) -> UIImage {
    let path = UIBezierPath()
    path.move(to: CGPoint(x: 15.414, y: 12))
    path.addLine(to: CGPoint(x: 10, y: 17.414))
    path.addLine(to: CGPoint(x: 8.586, y: 16))
    path.addLine(to: CGPoint(x: 12.586, y: 12))
    path.addLine(to: CGPoint(x: 8.586, y: 8))
    path.addLine(to: CGPoint(x: 10, y: 6.586))
    path.close()

    let rendered = UIGraphicsImageRenderer(size: CGSize(width: size, height: size)).image { _ in
      path.apply(CGAffineTransform(scaleX: size / 24, y: size / 24))
      UIColor.black.setFill()
      path.fill()
    }
    return rendered.withRenderingMode(.alwaysTemplate)
  }

  static func cryptoCoinFallbackBackgroundColor(for backgroundColor: UIColor) -> UIColor {
    var red: CGFloat = 1
    var green: CGFloat = 1
    var blue: CGFloat = 1
    var alpha: CGFloat = 1
    backgroundColor.getRed(&red, green: &green, blue: &blue, alpha: &alpha)
    let luminance = red * 0.299 + green * 0.587 + blue * 0.114
    return luminance < 0.5
      ? UIColor(red: 49 / 255, green: 49 / 255, blue: 49 / 255, alpha: 1)
      : UIColor(red: 224 / 255, green: 224 / 255, blue: 224 / 255, alpha: 1)
  }

  static func cryptoCoinFallback(size: CGFloat, color: UIColor) -> UIImage {
    let rendered = UIGraphicsImageRenderer(size: CGSize(width: size, height: size)).image { context in
      let scale = size / 40
      context.cgContext.scaleBy(x: scale, y: scale)
      color.setStroke()

      let outerRing = UIBezierPath(
        arcCenter: CGPoint(x: 20, y: 20),
        radius: 9,
        startAngle: 0,
        endAngle: .pi * 2,
        clockwise: true
      )
      outerRing.lineWidth = 2
      outerRing.stroke()

      let coinMark = UIBezierPath(
        arcCenter: CGPoint(x: 20, y: 20),
        radius: 3.5,
        startAngle: .pi * 31 / 180,
        endAngle: .pi * 329 / 180,
        clockwise: true
      )
      coinMark.lineWidth = 2
      coinMark.stroke()

      let stem = UIBezierPath()
      stem.move(to: CGPoint(x: 20, y: 14))
      stem.addLine(to: CGPoint(x: 20, y: 15.6))
      stem.move(to: CGPoint(x: 20, y: 24.4))
      stem.addLine(to: CGPoint(x: 20, y: 26))
      stem.lineWidth = 2
      stem.stroke()
    }
    return rendered
  }

  static func recognized(size: CGFloat) -> UIImage {
    let format = UIGraphicsImageRendererFormat()
    format.opaque = false
    let rendered = UIGraphicsImageRenderer(
      size: CGSize(width: size, height: size),
      format: format
    ).image { context in
      let scale = size / 24
      context.cgContext.scaleBy(x: scale, y: scale)

      let sealAndThumb = UIBezierPath()
      sealAndThumb.move(to: CGPoint(x: 10.4667, y: 2.69823))
      sealAndThumb.addCurve(
        to: CGPoint(x: 13.5321, y: 2.69823),
        controlPoint1: CGPoint(x: 11.276, y: 1.76682),
        controlPoint2: CGPoint(x: 12.7227, y: 1.76704)
      )
      sealAndThumb.addLine(to: CGPoint(x: 14.8905, y: 4.26171))
      sealAndThumb.addCurve(
        to: CGPoint(x: 14.9179, y: 4.27245),
        controlPoint1: CGPoint(x: 14.8973, y: 4.26949),
        controlPoint2: CGPoint(x: 14.9077, y: 4.2739)
      )
      sealAndThumb.addLine(to: CGPoint(x: 16.9638, y: 3.94726))
      sealAndThumb.addCurve(
        to: CGPoint(x: 19.3114, y: 5.91796),
        controlPoint1: CGPoint(x: 18.1826, y: 3.75404),
        controlPoint2: CGPoint(x: 19.2902, y: 4.68411)
      )
      sealAndThumb.addLine(to: CGPoint(x: 19.3476, y: 7.98827))
      sealAndThumb.addCurve(
        to: CGPoint(x: 19.3622, y: 8.01366),
        controlPoint1: CGPoint(x: 19.3478, y: 7.99873),
        controlPoint2: CGPoint(x: 19.3533, y: 8.00827)
      )
      sealAndThumb.addLine(to: CGPoint(x: 21.1376, y: 9.08007))
      sealAndThumb.addCurve(
        to: CGPoint(x: 21.6698, y: 12.0986),
        controlPoint1: CGPoint(x: 22.1955, y: 9.71542),
        controlPoint2: CGPoint(x: 22.4466, y: 11.1398)
      )
      sealAndThumb.addLine(to: CGPoint(x: 20.3661, y: 13.708))
      sealAndThumb.addCurve(
        to: CGPoint(x: 20.3612, y: 13.7373),
        controlPoint1: CGPoint(x: 20.3596, y: 13.7161),
        controlPoint2: CGPoint(x: 20.3579, y: 13.7274)
      )
      sealAndThumb.addLine(to: CGPoint(x: 21.0361, y: 15.6943))
      sealAndThumb.addCurve(
        to: CGPoint(x: 19.5029, y: 18.3496),
        controlPoint1: CGPoint(x: 21.4381, y: 16.8611),
        controlPoint2: CGPoint(x: 20.7143, y: 18.1144)
      )
      sealAndThumb.addLine(to: CGPoint(x: 17.4696, y: 18.7441))
      sealAndThumb.addCurve(
        to: CGPoint(x: 17.4472, y: 18.7627),
        controlPoint1: CGPoint(x: 17.4596, y: 18.7462),
        controlPoint2: CGPoint(x: 17.4509, y: 18.7531)
      )
      sealAndThumb.addLine(to: CGPoint(x: 16.706, y: 20.6963))
      sealAndThumb.addCurve(
        to: CGPoint(x: 13.8251, y: 21.7451),
        controlPoint1: CGPoint(x: 16.264, y: 21.8485),
        controlPoint2: CGPoint(x: 14.9043, y: 22.3437)
      )
      sealAndThumb.addLine(to: CGPoint(x: 12.0146, y: 20.7402))
      sealAndThumb.addCurve(
        to: CGPoint(x: 11.9853, y: 20.7402),
        controlPoint1: CGPoint(x: 12.0055, y: 20.7352),
        controlPoint2: CGPoint(x: 11.9944, y: 20.7353)
      )
      sealAndThumb.addLine(to: CGPoint(x: 10.1737, y: 21.7451))
      sealAndThumb.addCurve(
        to: CGPoint(x: 7.29387, y: 20.6963),
        controlPoint1: CGPoint(x: 9.09459, y: 22.3434),
        controlPoint2: CGPoint(x: 7.7358, y: 21.8484)
      )
      sealAndThumb.addLine(to: CGPoint(x: 6.55168, y: 18.7627))
      sealAndThumb.addCurve(
        to: CGPoint(x: 6.52922, y: 18.7441),
        controlPoint1: CGPoint(x: 6.54788, y: 18.7531),
        controlPoint2: CGPoint(x: 6.53939, y: 18.7461)
      )
      sealAndThumb.addLine(to: CGPoint(x: 4.49601, y: 18.3496))
      sealAndThumb.addCurve(
        to: CGPoint(x: 2.96379, y: 15.6943),
        controlPoint1: CGPoint(x: 3.28479, y: 18.1142),
        controlPoint2: CGPoint(x: 2.56177, y: 16.861)
      )
      sealAndThumb.addLine(to: CGPoint(x: 3.63859, y: 13.7373))
      sealAndThumb.addCurve(
        to: CGPoint(x: 3.63371, y: 13.708),
        controlPoint1: CGPoint(x: 3.64197, y: 13.7275),
        controlPoint2: CGPoint(x: 3.64015, y: 13.7161)
      )
      sealAndThumb.addLine(to: CGPoint(x: 2.33, y: 12.0986))
      sealAndThumb.addCurve(
        to: CGPoint(x: 2.86223, y: 9.08007),
        controlPoint1: CGPoint(x: 1.55313, y: 11.1397),
        controlPoint2: CGPoint(x: 1.80424, y: 9.71542)
      )
      sealAndThumb.addLine(to: CGPoint(x: 4.63762, y: 8.01366))
      sealAndThumb.addCurve(
        to: CGPoint(x: 4.65226, y: 7.98827),
        controlPoint1: CGPoint(x: 4.64644, y: 8.00825),
        controlPoint2: CGPoint(x: 4.65209, y: 7.99864)
      )
      sealAndThumb.addLine(to: CGPoint(x: 4.68742, y: 5.91796))
      sealAndThumb.addCurve(
        to: CGPoint(x: 7.03605, y: 3.94726),
        controlPoint1: CGPoint(x: 4.70866, y: 4.68405),
        controlPoint2: CGPoint(x: 5.8172, y: 3.75391)
      )
      sealAndThumb.addLine(to: CGPoint(x: 9.08098, y: 4.27245))
      sealAndThumb.addCurve(
        to: CGPoint(x: 9.1093, y: 4.26171),
        controlPoint1: CGPoint(x: 9.09131, y: 4.27409),
        controlPoint2: CGPoint(x: 9.10243, y: 4.26961)
      )
      sealAndThumb.addLine(to: CGPoint(x: 10.4667, y: 2.69823))
      sealAndThumb.close()

      sealAndThumb.move(to: CGPoint(x: 11.9833, y: 6.458))
      sealAndThumb.addCurve(
        to: CGPoint(x: 11.5361, y: 6.73437),
        controlPoint1: CGPoint(x: 11.7941, y: 6.45812),
        controlPoint2: CGPoint(x: 11.6207, y: 6.56517)
      )
      sealAndThumb.addLine(to: CGPoint(x: 9.67473, y: 10.458))
      sealAndThumb.addLine(to: CGPoint(x: 8.48332, y: 10.458))
      sealAndThumb.addCurve(
        to: CGPoint(x: 7.48332, y: 11.458),
        controlPoint1: CGPoint(x: 7.93131, y: 10.4582),
        controlPoint2: CGPoint(x: 7.48352, y: 10.906)
      )
      sealAndThumb.addLine(to: CGPoint(x: 7.48332, y: 14.958))
      sealAndThumb.addCurve(
        to: CGPoint(x: 8.48332, y: 15.958),
        controlPoint1: CGPoint(x: 7.48332, y: 15.5102),
        controlPoint2: CGPoint(x: 7.93118, y: 15.9578)
      )
      sealAndThumb.addLine(to: CGPoint(x: 15.1747, y: 15.958))
      sealAndThumb.addCurve(
        to: CGPoint(x: 17.1562, y: 14.2285),
        controlPoint1: CGPoint(x: 16.1747, y: 15.9578),
        controlPoint2: CGPoint(x: 17.0211, y: 15.2193)
      )
      sealAndThumb.addLine(to: CGPoint(x: 17.497, y: 11.7285))
      sealAndThumb.addCurve(
        to: CGPoint(x: 15.5155, y: 9.458),
        controlPoint1: CGPoint(x: 17.6607, y: 10.5278),
        controlPoint2: CGPoint(x: 16.7273, y: 9.45819)
      )
      sealAndThumb.addLine(to: CGPoint(x: 13.5761, y: 9.458))
      sealAndThumb.addLine(to: CGPoint(x: 13.7734, y: 8.18945))
      sealAndThumb.addCurve(
        to: CGPoint(x: 12.2919, y: 6.458),
        controlPoint1: CGPoint(x: 13.9151, y: 7.28003),
        controlPoint2: CGPoint(x: 13.2122, y: 6.45827)
      )
      sealAndThumb.addLine(to: CGPoint(x: 11.9833, y: 6.458))
      sealAndThumb.close()
      sealAndThumb.usesEvenOddFillRule = true

      let thumbStem = UIBezierPath()
      thumbStem.move(to: CGPoint(x: 9.48332, y: 11.458))
      thumbStem.addLine(to: CGPoint(x: 9.48332, y: 14.958))
      thumbStem.addLine(to: CGPoint(x: 8.48332, y: 14.958))
      thumbStem.addLine(to: CGPoint(x: 8.48332, y: 11.458))
      thumbStem.close()

      UIColor.black.setFill()
      sealAndThumb.fill()
      thumbStem.fill()
    }
    return rendered.withRenderingMode(.alwaysTemplate)
  }
}

private final class HomeContainerInsetLabel: UILabel {
  var contentInsets = UIEdgeInsets.zero

  override var intrinsicContentSize: CGSize {
    let size = super.intrinsicContentSize
    return CGSize(
      width: size.width + contentInsets.left + contentInsets.right,
      height: size.height + contentInsets.top + contentInsets.bottom
    )
  }

  override func drawText(in rect: CGRect) {
    super.drawText(in: rect.inset(by: contentInsets))
  }
}

private final class HomeContainerItemSkeletonOverlay: UIView {
  private let icon = SkeletonNativeView(frame: .zero)
  private let title = SkeletonNativeView(frame: .zero)
  private let subtitle = SkeletonNativeView(frame: .zero)
  private let value = SkeletonNativeView(frame: .zero)
  private let detail = SkeletonNativeView(frame: .zero)

  override init(frame: CGRect) {
    super.init(frame: frame)
    isUserInteractionEnabled = false
    accessibilityElementsHidden = true
    icon.layer.cornerRadius = 20
    [title, subtitle, value, detail].forEach {
      $0.layer.cornerRadius = 8
    }
    [icon, title, subtitle, value, detail].forEach {
      $0.clipsToBounds = true
      addSubview($0)
    }
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func apply(theme: HomeContainerTheme) {
    [icon, title, subtitle, value, detail].forEach {
      $0.applyHomeContainerSkeletonTheme(theme)
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let centerY = bounds.midY
    icon.frame = CGRect(x: 20, y: centerY - 20, width: 40, height: 40)
    title.frame = CGRect(x: 72, y: centerY - 20, width: 128, height: 16)
    subtitle.frame = CGRect(x: 72, y: centerY + 4, width: 96, height: 12)
    value.frame = CGRect(x: bounds.width - 84, y: centerY - 20, width: 64, height: 16)
    detail.frame = CGRect(x: bounds.width - 68, y: centerY + 4, width: 48, height: 12)
  }
}

private final class HomeContainerItemCell: UITableViewCell {
  private let highlightView = UIView()
  private let favoriteButton = HomeContainerInteractiveButton(type: .system)
  private let iconContainer = UIView()
  private let iconImageView = UIImageView()
  private let secondaryIconImageView = UIImageView()
  private let badgeContainerView = UIView()
  private let badgeImageView = UIImageView()
  private let iconLabel = UILabel()
  private let titleLabel = UILabel()
  private let leverageLabel = HomeContainerInsetLabel()
  private let titleAccessoryImageView = UIImageView()
  private let recognizedImageView = UIImageView()
  private let subtitleLabel = UILabel()
  private let subtitleDetailLabel = UILabel()
  private let valueLabel = UILabel()
  private let detailLabel = UILabel()
  private let inlineBadgesStack = UIStackView()
  private let chevronLabel = UILabel()
  private let centerButton = UILabel()
  private let marketTabsScrollView = HomeContainerPagerChildHorizontalScrollView()
  private let marketTabsStack = UIStackView()
  private let divider = UIView()
  private var skeletonOverlay: HomeContainerItemSkeletonOverlay?
  private var rightTrailingConstraint: NSLayoutConstraint?
  private var iconLeadingConstraint: NSLayoutConstraint?
  private var marketIconLeadingConstraint: NSLayoutConstraint?
  private var iconWidthConstraint: NSLayoutConstraint?
  private var iconHeightConstraint: NSLayoutConstraint?
  private var iconImageWidthConstraint: NSLayoutConstraint?
  private var iconImageHeightConstraint: NSLayoutConstraint?
  private var secondaryIconWidthConstraint: NSLayoutConstraint?
  private var secondaryIconHeightConstraint: NSLayoutConstraint?
  private var badgeContainerWidthConstraint: NSLayoutConstraint?
  private var badgeContainerHeightConstraint: NSLayoutConstraint?
  private var badgeImageWidthConstraint: NSLayoutConstraint?
  private var badgeImageHeightConstraint: NSLayoutConstraint?
  private var titleAccessoryWidthConstraint: NSLayoutConstraint?
  private var titleAccessoryHeightConstraint: NSLayoutConstraint?
  private var titleMaxWidthConstraint: NSLayoutConstraint?
  private var subtitleMaxWidthConstraint: NSLayoutConstraint?
  private var centerButtonTopConstraint: NSLayoutConstraint?
  private var centerButtonBottomConstraint: NSLayoutConstraint?
  private var marketTabsHeightConstraint: NSLayoutConstraint?
  private var imageTask: HomeContainerImageRequest?
  private var secondaryImageTask: HomeContainerImageRequest?
  private var badgeImageTask: HomeContainerImageRequest?
  private var representedImageSignature: String?
  private var representedSecondaryImageURL: URL?
  private var representedBadgeImageURL: URL?
  private var titleAccessoryImageTask: HomeContainerImageRequest?
  private var representedTitleAccessoryImageURL: URL?
  private var hasAppliedImage = false
  private var usesSymbolicIcon = false
  private var usesCryptoCoinFallback = false
  private var currentRenderer = ""
  private var isInteractive = false
  private var normalCenterBackgroundColor = UIColor.clear
  private var hoverBackgroundColor = UIColor.tertiarySystemBackground
  private var activeBackgroundColor = UIColor.systemGray5
  private var normalCardBackgroundColor = UIColor.clear
  private var usesCard = false
  private var favoriteActionId: String?
  private var favoriteItemId = ""
  private var representedFavoriteItemId: String?
  private var representedFavoriteState: Bool?
  private var onFavoriteAction: ((String, String) -> Void)?
  private var isPointerHovering = false

  override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
    super.init(style: style, reuseIdentifier: reuseIdentifier)
    selectionStyle = .none
    highlightView.layer.cornerRadius = 12
    highlightView.isHidden = true
    highlightView.isUserInteractionEnabled = false
    highlightView.translatesAutoresizingMaskIntoConstraints = false
    favoriteButton.translatesAutoresizingMaskIntoConstraints = false
    favoriteButton.isHidden = true
    favoriteButton.addTarget(self, action: #selector(handleFavoritePress), for: .touchUpInside)
    addGestureRecognizer(UIHoverGestureRecognizer(target: self, action: #selector(handleHover(_:))))
    iconContainer.layer.cornerRadius = 20
    iconContainer.layer.masksToBounds = true
    iconContainer.translatesAutoresizingMaskIntoConstraints = false

    iconImageView.contentMode = .scaleAspectFill
    iconImageView.clipsToBounds = true
    iconImageView.translatesAutoresizingMaskIntoConstraints = false
    iconContainer.addSubview(iconImageView)

    secondaryIconImageView.contentMode = .scaleAspectFill
    secondaryIconImageView.clipsToBounds = true
    secondaryIconImageView.layer.cornerRadius = 13
    secondaryIconImageView.translatesAutoresizingMaskIntoConstraints = false
    iconContainer.addSubview(secondaryIconImageView)

    badgeContainerView.layer.cornerRadius = 10
    badgeContainerView.clipsToBounds = true
    badgeContainerView.translatesAutoresizingMaskIntoConstraints = false

    iconLabel.font = HomeContainerTypography.system(15, weight: .bold)
    iconLabel.textAlignment = .center
    iconLabel.translatesAutoresizingMaskIntoConstraints = false
    iconContainer.addSubview(iconLabel)
    titleLabel.font = HomeContainerTypography.medium(16)
    subtitleLabel.font = HomeContainerTypography.regular(14)
    subtitleDetailLabel.font = HomeContainerTypography.regular(14)
    valueLabel.font = HomeContainerTypography.medium(16)
    valueLabel.textAlignment = .right
    detailLabel.font = HomeContainerTypography.regular(14)
    detailLabel.textAlignment = .right
    [titleLabel, subtitleLabel, subtitleDetailLabel, valueLabel, detailLabel].forEach {
      $0.numberOfLines = 1
      $0.lineBreakMode = .byTruncatingTail
    }
    titleLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
    subtitleLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
    subtitleDetailLabel.setContentCompressionResistancePriority(.required, for: .horizontal)
    valueLabel.setContentCompressionResistancePriority(.required, for: .horizontal)
    detailLabel.setContentCompressionResistancePriority(.required, for: .horizontal)

    leverageLabel.font = HomeContainerTypography.regular(10)
    leverageLabel.contentInsets = UIEdgeInsets(top: 0, left: 6, bottom: 0, right: 6)
    leverageLabel.layer.cornerRadius = 4
    leverageLabel.clipsToBounds = true
    leverageLabel.setContentCompressionResistancePriority(.required, for: .horizontal)
    titleAccessoryImageView.contentMode = .scaleAspectFill
    titleAccessoryImageView.layer.cornerRadius = 7
    titleAccessoryImageView.clipsToBounds = true
    titleAccessoryImageView.translatesAutoresizingMaskIntoConstraints = false
    titleAccessoryImageView.setContentCompressionResistancePriority(.required, for: .horizontal)
    recognizedImageView.image = HomeContainerMarketArtwork.recognized(size: 16)
    recognizedImageView.contentMode = .scaleAspectFit
    recognizedImageView.translatesAutoresizingMaskIntoConstraints = false
    recognizedImageView.setContentCompressionResistancePriority(.required, for: .horizontal)
    let titleStack = UIStackView(arrangedSubviews: [
      titleLabel,
      leverageLabel,
      titleAccessoryImageView,
      recognizedImageView,
    ])
    titleStack.axis = .horizontal
    titleStack.alignment = .center
    titleStack.spacing = 4
    let subtitleStack = UIStackView(arrangedSubviews: [subtitleLabel, subtitleDetailLabel])
    subtitleStack.axis = .horizontal
    subtitleStack.spacing = 6
    let leftStack = UIStackView(arrangedSubviews: [titleStack, subtitleStack])
    leftStack.axis = .vertical
    leftStack.alignment = .leading
    leftStack.spacing = 0
    leftStack.translatesAutoresizingMaskIntoConstraints = false
    inlineBadgesStack.axis = .horizontal
    inlineBadgesStack.alignment = .center
    inlineBadgesStack.spacing = 4
    let rightStack = UIStackView(
      arrangedSubviews: [valueLabel, detailLabel, inlineBadgesStack]
    )
    rightStack.axis = .vertical
    rightStack.spacing = 3
    rightStack.alignment = .trailing
    rightStack.translatesAutoresizingMaskIntoConstraints = false
    leftStack.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
    rightStack.setContentCompressionResistancePriority(.required, for: .horizontal)
    rightStack.setContentHuggingPriority(.required, for: .horizontal)
    chevronLabel.text = "›"
    chevronLabel.font = HomeContainerTypography.system(28)
    chevronLabel.textAlignment = .center
    chevronLabel.translatesAutoresizingMaskIntoConstraints = false
    centerButton.font = HomeContainerTypography.medium(16)
    centerButton.textAlignment = .center
    centerButton.layer.cornerRadius = 18
    centerButton.clipsToBounds = true
    centerButton.translatesAutoresizingMaskIntoConstraints = false
    marketTabsScrollView.showsHorizontalScrollIndicator = false
    marketTabsScrollView.alwaysBounceHorizontal = false
    marketTabsScrollView.translatesAutoresizingMaskIntoConstraints = false
    marketTabsStack.axis = .horizontal
    marketTabsStack.alignment = .center
    marketTabsStack.spacing = 4
    marketTabsStack.translatesAutoresizingMaskIntoConstraints = false
    marketTabsScrollView.addSubview(marketTabsStack)
    badgeImageView.contentMode = .scaleAspectFill
    badgeImageView.layer.cornerRadius = 8
    badgeImageView.clipsToBounds = true
    badgeImageView.translatesAutoresizingMaskIntoConstraints = false
    badgeContainerView.addSubview(badgeImageView)
    divider.translatesAutoresizingMaskIntoConstraints = false

    contentView.addSubview(highlightView)
    contentView.addSubview(favoriteButton)
    contentView.addSubview(iconContainer)
    contentView.addSubview(leftStack)
    contentView.addSubview(rightStack)
    contentView.addSubview(chevronLabel)
    contentView.addSubview(badgeContainerView)
    contentView.addSubview(centerButton)
    contentView.addSubview(marketTabsScrollView)
    contentView.addSubview(divider)
    let rightTrailingConstraint = rightStack.trailingAnchor.constraint(
      equalTo: contentView.trailingAnchor,
      constant: -16
    )
    self.rightTrailingConstraint = rightTrailingConstraint
    let iconLeadingConstraint = iconContainer.leadingAnchor.constraint(
      equalTo: contentView.leadingAnchor,
      constant: 20
    )
    let marketIconLeadingConstraint = iconContainer.leadingAnchor.constraint(
      equalTo: favoriteButton.trailingAnchor,
      constant: 8
    )
    let iconWidthConstraint = iconContainer.widthAnchor.constraint(equalToConstant: 40)
    let iconHeightConstraint = iconContainer.heightAnchor.constraint(equalToConstant: 40)
    let iconImageWidthConstraint = iconImageView.widthAnchor.constraint(equalToConstant: 40)
    let iconImageHeightConstraint = iconImageView.heightAnchor.constraint(equalToConstant: 40)
    let secondaryIconWidthConstraint = secondaryIconImageView.widthAnchor.constraint(equalToConstant: 26)
    let secondaryIconHeightConstraint = secondaryIconImageView.heightAnchor.constraint(equalToConstant: 26)
    let badgeContainerWidthConstraint = badgeContainerView.widthAnchor.constraint(equalToConstant: 20)
    let badgeContainerHeightConstraint = badgeContainerView.heightAnchor.constraint(equalToConstant: 20)
    let badgeImageWidthConstraint = badgeImageView.widthAnchor.constraint(equalToConstant: 16)
    let badgeImageHeightConstraint = badgeImageView.heightAnchor.constraint(equalToConstant: 16)
    let titleAccessoryWidthConstraint = titleAccessoryImageView.widthAnchor.constraint(
      equalToConstant: 14
    )
    let titleAccessoryHeightConstraint = titleAccessoryImageView.heightAnchor.constraint(
      equalToConstant: 14
    )
    let titleMaxWidthConstraint = titleLabel.widthAnchor.constraint(lessThanOrEqualToConstant: 128)
    let subtitleMaxWidthConstraint = subtitleLabel.widthAnchor.constraint(lessThanOrEqualToConstant: 66)
    let centerButtonTopConstraint = centerButton.topAnchor.constraint(
      equalTo: contentView.topAnchor,
      constant: 6
    )
    let centerButtonBottomConstraint = centerButton.bottomAnchor.constraint(
      equalTo: contentView.bottomAnchor,
      constant: -6
    )
    let marketTabsHeightConstraint = marketTabsStack.heightAnchor.constraint(
      equalToConstant: HomeContainerMetrics.marketSegmentHeight
    )
    self.iconLeadingConstraint = iconLeadingConstraint
    self.marketIconLeadingConstraint = marketIconLeadingConstraint
    self.iconWidthConstraint = iconWidthConstraint
    self.iconHeightConstraint = iconHeightConstraint
    self.iconImageWidthConstraint = iconImageWidthConstraint
    self.iconImageHeightConstraint = iconImageHeightConstraint
    self.secondaryIconWidthConstraint = secondaryIconWidthConstraint
    self.secondaryIconHeightConstraint = secondaryIconHeightConstraint
    self.badgeContainerWidthConstraint = badgeContainerWidthConstraint
    self.badgeContainerHeightConstraint = badgeContainerHeightConstraint
    self.badgeImageWidthConstraint = badgeImageWidthConstraint
    self.badgeImageHeightConstraint = badgeImageHeightConstraint
    self.titleAccessoryWidthConstraint = titleAccessoryWidthConstraint
    self.titleAccessoryHeightConstraint = titleAccessoryHeightConstraint
    self.titleMaxWidthConstraint = titleMaxWidthConstraint
    self.subtitleMaxWidthConstraint = subtitleMaxWidthConstraint
    self.centerButtonTopConstraint = centerButtonTopConstraint
    self.centerButtonBottomConstraint = centerButtonBottomConstraint
    self.marketTabsHeightConstraint = marketTabsHeightConstraint
    NSLayoutConstraint.activate([
      highlightView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 8),
      highlightView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -8),
      highlightView.topAnchor.constraint(equalTo: contentView.topAnchor),
      highlightView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
      favoriteButton.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
      favoriteButton.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
      favoriteButton.widthAnchor.constraint(equalToConstant: 28),
      favoriteButton.heightAnchor.constraint(equalToConstant: 28),
      iconLeadingConstraint,
      iconContainer.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
      iconWidthConstraint,
      iconHeightConstraint,
      iconImageView.leadingAnchor.constraint(equalTo: iconContainer.leadingAnchor),
      iconImageView.topAnchor.constraint(equalTo: iconContainer.topAnchor),
      iconImageWidthConstraint,
      iconImageHeightConstraint,
      secondaryIconImageView.trailingAnchor.constraint(equalTo: iconContainer.trailingAnchor),
      secondaryIconImageView.bottomAnchor.constraint(equalTo: iconContainer.bottomAnchor),
      secondaryIconWidthConstraint,
      secondaryIconHeightConstraint,
      titleAccessoryWidthConstraint,
      titleAccessoryHeightConstraint,
      recognizedImageView.widthAnchor.constraint(equalToConstant: 16),
      recognizedImageView.heightAnchor.constraint(equalToConstant: 16),
      iconLabel.leadingAnchor.constraint(equalTo: iconContainer.leadingAnchor),
      iconLabel.trailingAnchor.constraint(equalTo: iconContainer.trailingAnchor),
      iconLabel.topAnchor.constraint(equalTo: iconContainer.topAnchor),
      iconLabel.bottomAnchor.constraint(equalTo: iconContainer.bottomAnchor),
      leftStack.leadingAnchor.constraint(equalTo: iconContainer.trailingAnchor, constant: 12),
      leftStack.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
      rightStack.leadingAnchor.constraint(equalTo: leftStack.trailingAnchor, constant: 8),
      rightTrailingConstraint,
      rightStack.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
      chevronLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
      chevronLabel.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
      chevronLabel.widthAnchor.constraint(equalToConstant: 12),
      badgeContainerView.trailingAnchor.constraint(equalTo: iconContainer.trailingAnchor, constant: 4),
      badgeContainerView.bottomAnchor.constraint(equalTo: iconContainer.bottomAnchor, constant: 4),
      badgeContainerWidthConstraint,
      badgeContainerHeightConstraint,
      badgeImageView.leadingAnchor.constraint(equalTo: badgeContainerView.leadingAnchor, constant: 2),
      badgeImageView.topAnchor.constraint(equalTo: badgeContainerView.topAnchor, constant: 2),
      badgeImageWidthConstraint,
      badgeImageHeightConstraint,
      centerButton.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
      centerButton.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
      centerButtonTopConstraint,
      centerButtonBottomConstraint,
      marketTabsScrollView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
      marketTabsScrollView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
      marketTabsScrollView.topAnchor.constraint(equalTo: contentView.topAnchor),
      marketTabsScrollView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
      marketTabsStack.leadingAnchor.constraint(
        equalTo: marketTabsScrollView.contentLayoutGuide.leadingAnchor,
        constant: 20
      ),
      marketTabsStack.trailingAnchor.constraint(
        equalTo: marketTabsScrollView.contentLayoutGuide.trailingAnchor,
        constant: -20
      ),
      marketTabsStack.centerYAnchor.constraint(equalTo: marketTabsScrollView.frameLayoutGuide.centerYAnchor),
      marketTabsHeightConstraint,
      divider.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
      divider.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
      divider.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
      divider.heightAnchor.constraint(equalToConstant: 0.5),
    ])
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  @objc private func handleFavoritePress() {
    guard let favoriteActionId else { return }
    onFavoriteAction?(favoriteActionId, favoriteItemId)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    if currentRenderer == "supportAction" || currentRenderer == "upgrade" {
      contentView.frame = bounds.insetBy(dx: 16, dy: 6)
    } else {
      contentView.frame = bounds
    }
    skeletonOverlay?.frame = contentView.bounds
  }

  override func setHighlighted(_ highlighted: Bool, animated: Bool) {
    super.setHighlighted(highlighted, animated: animated)
    updateInteractiveAppearance()
  }

  @objc private func handleHover(_ gestureRecognizer: UIHoverGestureRecognizer) {
    switch gestureRecognizer.state {
    case .began, .changed:
      isPointerHovering = true
    case .ended, .cancelled, .failed:
      isPointerHovering = false
    default:
      break
    }
    updateInteractiveAppearance()
  }

  private func updateInteractiveAppearance() {
    guard isInteractive else {
      highlightView.isHidden = true
      return
    }
    let interactiveColor = isHighlighted ? activeBackgroundColor : hoverBackgroundColor
    let showsInteractiveState = isHighlighted || isPointerHovering
    if currentRenderer == "showMore" {
      centerButton.backgroundColor = showsInteractiveState
        ? interactiveColor
        : normalCenterBackgroundColor
    } else if usesCard {
      contentView.backgroundColor = showsInteractiveState
        ? interactiveColor
        : normalCardBackgroundColor
    } else {
      highlightView.backgroundColor = interactiveColor
      highlightView.isHidden = !showsInteractiveState
    }
  }

  override func prepareForReuse() {
    super.prepareForReuse()
    imageTask?.cancel()
    secondaryImageTask?.cancel()
    badgeImageTask?.cancel()
    titleAccessoryImageTask?.cancel()
    imageTask = nil
    secondaryImageTask = nil
    badgeImageTask = nil
    titleAccessoryImageTask = nil
    representedImageSignature = nil
    representedSecondaryImageURL = nil
    representedBadgeImageURL = nil
    representedTitleAccessoryImageURL = nil
    hasAppliedImage = false
    usesSymbolicIcon = false
    usesCryptoCoinFallback = false
    iconImageView.image = nil
    secondaryIconImageView.image = nil
    badgeImageView.image = nil
    titleAccessoryImageView.image = nil
    inlineBadgesStack.arrangedSubviews.forEach { view in
      inlineBadgesStack.removeArrangedSubview(view)
      view.removeFromSuperview()
    }
    iconLabel.isHidden = false
    favoriteButton.isHidden = true
    badgeContainerView.isHidden = true
    leverageLabel.isHidden = true
    titleAccessoryImageView.isHidden = true
    recognizedImageView.isHidden = true
    skeletonOverlay?.removeFromSuperview()
    skeletonOverlay = nil
    favoriteActionId = nil
    favoriteItemId = ""
    representedFavoriteItemId = nil
    representedFavoriteState = nil
    onFavoriteAction = nil
    isPointerHovering = false
  }

  func apply(
    item: HomeContainerItem,
    theme: HomeContainerTheme,
    onAction: @escaping (String, String) -> Void
  ) {
    currentRenderer = item.renderer
    marketTabsHeightConstraint?.constant = HomeContainerMetrics.marketSegmentHeight
    isInteractive = item.actionId?.isEmpty == false
    hoverBackgroundColor = UIColor(
      homeContainerColor: theme.hoverColor ?? theme.activeColor ?? theme.cardColor,
      fallback: .tertiarySystemBackground
    )
    activeBackgroundColor = UIColor(
      homeContainerColor: theme.activeColor ?? theme.hoverColor ?? theme.cardColor,
      fallback: .systemGray5
    )
    highlightView.backgroundColor = activeBackgroundColor
    highlightView.isHidden = true
    setNeedsLayout()
    let showsFavorite = item.renderer == "market" && item.favoriteActionId?.isEmpty == false
    favoriteButton.isHidden = !showsFavorite
    // The original Market star keeps a transparent surface in every state.
    // The button still dims while pressed and never forwards the tap to the row.
    favoriteButton.configureInteractiveColors(normal: .clear, hover: .clear, active: .clear)
    favoriteButton.accessibilityLabel = item.favoriteLabel
    favoriteButton.accessibilityIdentifier = showsFavorite
      ? "native-home-market-favorite-\(item.id)"
      : nil
    let favoriteState = item.favorite == true
    let applyFavoriteArtwork = {
      self.favoriteButton.tintColor = UIColor(
        homeContainerColor: favoriteState
          ? theme.primaryTextColor
          : theme.subduedIconColor ?? theme.secondaryTextColor,
        fallback: favoriteState ? .label : .secondaryLabel
      )
      self.favoriteButton.setImage(
        HomeContainerMarketArtwork.star(filled: favoriteState, size: 20),
        for: .normal
      )
    }
    let shouldAnimateFavoriteChange =
      showsFavorite &&
      representedFavoriteItemId == item.id &&
      representedFavoriteState != nil &&
      representedFavoriteState != favoriteState
    if shouldAnimateFavoriteChange {
      UIView.transition(
        with: favoriteButton,
        duration: 0.16,
        options: [.transitionCrossDissolve, .beginFromCurrentState, .allowAnimatedContent],
        animations: applyFavoriteArtwork
      )
    } else {
      applyFavoriteArtwork()
    }
    representedFavoriteItemId = showsFavorite ? item.id : nil
    representedFavoriteState = showsFavorite ? favoriteState : nil
    favoriteActionId = item.favoriteActionId
    favoriteItemId = item.id
    onFavoriteAction = onAction
    iconLeadingConstraint?.isActive = !showsFavorite
    marketIconLeadingConstraint?.isActive = showsFavorite
    let usesMarketGeometry = item.renderer == "market"
    let usesPairedHistoryIcons =
      item.renderer == "history" && item.secondaryImageUrl?.isEmpty == false
    titleMaxWidthConstraint?.isActive = usesMarketGeometry
    subtitleMaxWidthConstraint?.isActive = usesMarketGeometry && item.subtitle?.isEmpty == false
    iconWidthConstraint?.constant = usesMarketGeometry ? 32 : 40
    iconHeightConstraint?.constant = usesMarketGeometry ? 32 : 40
    let primaryIconSize: CGFloat = usesPairedHistoryIcons ? 24 : (usesMarketGeometry ? 32 : 40)
    let secondaryIconSize: CGFloat = usesPairedHistoryIcons ? 24 : 26
    iconImageWidthConstraint?.constant = primaryIconSize
    iconImageHeightConstraint?.constant = primaryIconSize
    secondaryIconWidthConstraint?.constant = secondaryIconSize
    secondaryIconHeightConstraint?.constant = secondaryIconSize
    let badgeContainerSize: CGFloat = usesPairedHistoryIcons ? 16 : 20
    let badgeImageSize: CGFloat = usesPairedHistoryIcons ? 12 : 16
    badgeContainerWidthConstraint?.constant = badgeContainerSize
    badgeContainerHeightConstraint?.constant = badgeContainerSize
    badgeImageWidthConstraint?.constant = badgeImageSize
    badgeImageHeightConstraint?.constant = badgeImageSize
    badgeContainerView.layer.cornerRadius = badgeContainerSize / 2
    badgeImageView.layer.cornerRadius = badgeImageSize / 2
    iconImageView.layer.cornerRadius = usesPairedHistoryIcons ? 12 : 0
    secondaryIconImageView.layer.cornerRadius = secondaryIconSize / 2
    secondaryIconImageView.layer.borderWidth = usesPairedHistoryIcons ? 2 : 0
    secondaryIconImageView.layer.borderColor = UIColor(
      homeContainerColor: theme.backgroundColor,
      fallback: .systemBackground
    ).cgColor
    contentView.alpha = 1
    backgroundColor = UIColor(homeContainerColor: theme.backgroundColor, fallback: .systemBackground)
    titleLabel.textColor = UIColor(homeContainerColor: theme.primaryTextColor, fallback: .label)
    subtitleLabel.textColor = UIColor(homeContainerColor: theme.secondaryTextColor, fallback: .secondaryLabel)
    subtitleDetailLabel.textColor = UIColor(
      homeContainerColor: item.subtitleDetailColor ?? theme.secondaryTextColor,
      fallback: .secondaryLabel
    )
    valueLabel.textColor = UIColor(
      homeContainerColor: item.renderer == "market" || item.renderer == "perps"
        ? theme.primaryTextColor
        : item.accentColor ?? theme.primaryTextColor,
      fallback: .label
    )
    detailLabel.textColor = UIColor(homeContainerColor: theme.secondaryTextColor, fallback: .secondaryLabel)
    chevronLabel.textColor = UIColor(homeContainerColor: theme.secondaryTextColor, fallback: .secondaryLabel)
    divider.backgroundColor = UIColor(homeContainerColor: theme.dividerColor, fallback: .separator)
    iconContainer.backgroundColor = item.renderer == "upgrade"
      ? UIColor(red: 0.88, green: 1, blue: 0.85, alpha: 1)
      : UIColor(homeContainerColor: theme.cardColor, fallback: .secondarySystemBackground)
    iconContainer.layer.cornerRadius = item.renderer == "upgrade"
      ? 10
      : (usesMarketGeometry ? 16 : 20)
    badgeContainerView.backgroundColor = UIColor(
      homeContainerColor: theme.backgroundColor,
      fallback: .systemBackground
    )
    recognizedImageView.tintColor = UIColor(
      homeContainerColor: theme.positiveColor,
      fallback: .systemGreen
    )
    leverageLabel.textColor = UIColor(
      homeContainerColor: item.renderer == "perps"
        ? theme.infoTextColor ?? theme.accentColor
        : theme.accentColor,
      fallback: .systemBlue
    )
    leverageLabel.backgroundColor = UIColor(
      homeContainerColor: item.renderer == "perps"
        ? theme.infoBackgroundColor ?? theme.cardColor
        : theme.cardColor,
      fallback: .secondarySystemBackground
    )
    iconLabel.textColor = UIColor(homeContainerColor: theme.primaryTextColor, fallback: .label)
    switch item.renderer {
    case "asset", "portfolio", "perps", "market", "earn":
      usesCryptoCoinFallback = true
    default:
      usesCryptoCoinFallback = false
    }
    if usesCryptoCoinFallback {
      iconContainer.backgroundColor = Self.cryptoCoinFallbackBackgroundColor(
        for: UIColor(homeContainerColor: theme.backgroundColor, fallback: .systemBackground)
      )
    }
    if usesPairedHistoryIcons {
      iconContainer.backgroundColor = .clear
    }
    let usesLegacyHiddenAssetArtwork =
      item.leadingIcon == "lowValue" || item.leadingIcon == "risk"
    if usesLegacyHiddenAssetArtwork {
      iconContainer.backgroundColor = UIColor(
        homeContainerColor: theme.strongColor ?? theme.cardColor,
        fallback: .secondarySystemBackground
      )
      iconContainer.layer.cornerRadius = 20
    }
    iconContainer.layer.masksToBounds = !usesPairedHistoryIcons
    switch item.leadingIcon {
    case "star": iconLabel.text = "★"
    case "support": iconLabel.text = "◉"
    case "book": iconLabel.text = "▣"
    case "download": iconLabel.text = "↓"
    case "prime": iconLabel.text = "1"
    case "lowValue": iconLabel.text = "••"
    case "risk": iconLabel.text = "▲"
    default: iconLabel.text = String(item.title.prefix(1)).uppercased()
    }
    if usesLegacyHiddenAssetArtwork {
      imageTask?.cancel()
      imageTask = nil
      representedImageSignature = nil
      hasAppliedImage = true
      usesSymbolicIcon = true
      iconImageView.contentMode = .scaleAspectFit
      iconImageView.tintColor = UIColor(
        homeContainerColor: theme.subduedIconColor ?? theme.secondaryTextColor,
        fallback: .secondaryLabel
      )
      iconImageView.image = item.leadingIcon == "risk"
        ? HomeContainerIcons.riskSolid
        : HomeContainerIcons.lowValueSolid
      iconLabel.isHidden = true
    } else {
      if usesSymbolicIcon {
        hasAppliedImage = false
        representedImageSignature = nil
        iconImageView.image = nil
        iconLabel.isHidden = false
        usesSymbolicIcon = false
      }
      iconImageView.contentMode = .scaleAspectFill
      iconImageView.tintColor = nil
      loadImage(
        item.imageUrl,
        fallbacks: item.imageUrls,
        fallbackColor: UIColor(
          homeContainerColor: theme.subduedIconColor ?? theme.secondaryTextColor,
          fallback: .secondaryLabel
        )
      )
    }
    loadAuxiliaryImage(item.secondaryImageUrl, kind: .secondary)
    loadAuxiliaryImage(item.badgeImageUrl, kind: .badge)
    loadAuxiliaryImage(item.titleAccessoryImageUrl, kind: .titleAccessory)
    let usesQuestionmarkAccessory = item.titleAccessoryIcon == "question"
    titleAccessoryWidthConstraint?.constant = usesQuestionmarkAccessory ? 20 : 14
    titleAccessoryHeightConstraint?.constant = usesQuestionmarkAccessory ? 20 : 14
    (titleAccessoryImageView.superview as? UIStackView)?.setCustomSpacing(
      usesQuestionmarkAccessory ? 12 : 4,
      after: titleLabel
    )
    if item.titleAccessoryIcon == "gas" || usesQuestionmarkAccessory {
      titleAccessoryImageTask?.cancel()
      titleAccessoryImageTask = nil
      representedTitleAccessoryImageURL = nil
      titleAccessoryImageView.contentMode = .scaleAspectFit
      titleAccessoryImageView.image = usesQuestionmarkAccessory
        ? HomeContainerIcons.questionmarkOutline
        : HomeContainerIcons.gasSolid
      titleAccessoryImageView.tintColor = UIColor(
        homeContainerColor: theme.subduedIconColor ?? theme.secondaryTextColor,
        fallback: .secondaryLabel
      )
    } else {
      titleAccessoryImageView.contentMode = .scaleAspectFill
      titleAccessoryImageView.tintColor = nil
    }
    updateInlineBadges(item.badges ?? [], theme: theme)
    titleLabel.text = item.title
    subtitleLabel.text = item.subtitle
    subtitleDetailLabel.text = item.subtitleDetail
    valueLabel.text = item.value
    detailLabel.text = item.detail
    subtitleLabel.isHidden = item.subtitle?.isEmpty != false
    subtitleDetailLabel.isHidden = item.subtitleDetail?.isEmpty != false
    valueLabel.isHidden = item.value?.isEmpty != false
    detailLabel.isHidden = item.detail?.isEmpty != false
    secondaryIconImageView.isHidden = secondaryIconImageView.image == nil
    badgeContainerView.isHidden = badgeImageView.image == nil
    badgeImageView.isHidden = badgeContainerView.isHidden
    leverageLabel.text = item.badge
    leverageLabel.isHidden = item.badge?.isEmpty != false
    titleAccessoryImageView.isHidden =
      titleAccessoryImageView.image == nil && item.titleAccessoryIcon == nil
    recognizedImageView.isHidden = item.communityRecognized != true
    let isLoading = item.renderer == "loading"
    iconImageView.isHidden = false
    titleLabel.isHidden = false
    chevronLabel.isHidden = isLoading || item.showChevron != true
    rightTrailingConstraint?.constant = !isLoading && item.showChevron == true ? -42 : -20
    if isLoading {
      let overlay = skeletonOverlay ?? HomeContainerItemSkeletonOverlay()
      if overlay.superview == nil {
        contentView.addSubview(overlay)
      }
      overlay.frame = contentView.bounds
      overlay.apply(theme: theme)
      skeletonOverlay = overlay
    } else {
      skeletonOverlay?.removeFromSuperview()
      skeletonOverlay = nil
    }
    [titleLabel, subtitleLabel, valueLabel, detailLabel].forEach { label in
      label.backgroundColor = .clear
      label.layer.cornerRadius = 0
      label.layer.masksToBounds = false
    }
    if isLoading {
      iconLabel.text = ""
      iconImageView.image = nil
      iconImageView.isHidden = true
      secondaryIconImageView.isHidden = true
      badgeContainerView.isHidden = true
      titleLabel.text = ""
      subtitleLabel.text = ""
      valueLabel.text = ""
      detailLabel.text = ""
      titleLabel.isHidden = true
      subtitleLabel.isHidden = true
      valueLabel.isHidden = true
      detailLabel.isHidden = true
    }
    let isCentered =
      item.renderer == "addToken" || item.renderer == "showMore" || item.renderer == "empty"
    let isMarketTabs = item.renderer == "marketTabs"
    centerButton.isHidden = !isCentered
    marketTabsScrollView.isHidden = !isMarketTabs
    iconContainer.isHidden = isCentered || isMarketTabs
    titleLabel.superview?.isHidden = isCentered || isMarketTabs
    valueLabel.superview?.isHidden = isCentered || isMarketTabs
    divider.isHidden = item.showDivider != true
    centerButtonTopConstraint?.constant = item.renderer == "showMore" ? 12 : 6
    centerButtonBottomConstraint?.constant = item.renderer == "showMore" ? 0 : -6
    usesCard = item.renderer == "supportAction" || item.renderer == "upgrade"
    normalCardBackgroundColor = usesCard
      ? UIColor(homeContainerColor: theme.cardColor, fallback: .secondarySystemBackground)
      : UIColor(homeContainerColor: theme.backgroundColor, fallback: .systemBackground)
    contentView.backgroundColor = normalCardBackgroundColor
    contentView.layer.cornerRadius = usesCard ? 12 : 0
    contentView.layer.borderWidth = usesCard ? 0.5 : 0
    contentView.layer.borderColor = UIColor(
      homeContainerColor: theme.dividerColor,
      fallback: .separator
    ).cgColor
    if item.renderer == "upgrade" {
      iconLabel.textColor = .black
    }

    let usesRoobertTypography =
      usesLegacyHiddenAssetArtwork ||
      ["market", "perps", "defi", "history"].contains(item.renderer)
    titleLabel.font = usesRoobertTypography
      ? HomeContainerTypography.medium(16)
      : HomeContainerTypography.system(16, weight: .medium)
    subtitleLabel.font = usesRoobertTypography
      ? HomeContainerTypography.regular(14)
      : HomeContainerTypography.system(14)
    subtitleDetailLabel.font = subtitleLabel.font
    valueLabel.font = usesRoobertTypography
      ? HomeContainerTypography.medium(16)
      : HomeContainerTypography.system(16, weight: .medium)
    detailLabel.font = usesRoobertTypography
      ? HomeContainerTypography.regular(14)
      : HomeContainerTypography.system(14)
    if usesLegacyHiddenAssetArtwork {
      let paragraphStyle = NSMutableParagraphStyle()
      paragraphStyle.minimumLineHeight = 24
      paragraphStyle.maximumLineHeight = 24
      titleLabel.attributedText = NSAttributedString(
        string: item.title,
        attributes: [
          .font: titleLabel.font as Any,
          .paragraphStyle: paragraphStyle,
        ]
      )
      if let value = item.value {
        valueLabel.attributedText = NSAttributedString(
          string: value,
          attributes: [
            .font: valueLabel.font as Any,
            .paragraphStyle: paragraphStyle,
          ]
        )
      }
    }
    if item.renderer == "market" || item.renderer == "perps" {
      detailLabel.textColor = UIColor(
        homeContainerColor: item.accentColor ?? theme.secondaryTextColor,
        fallback: .secondaryLabel
      )
    }
    if item.renderer == "upgrade" {
      valueLabel.text = item.buttonTitle.map { "  \($0)  " }
      valueLabel.isHidden = item.buttonTitle?.isEmpty != false
      valueLabel.textColor = UIColor(homeContainerColor: theme.backgroundColor, fallback: .systemBackground)
      valueLabel.backgroundColor = UIColor(homeContainerColor: theme.primaryTextColor, fallback: .label)
      valueLabel.layer.cornerRadius = 16
      valueLabel.clipsToBounds = true
    } else {
      valueLabel.backgroundColor = .clear
      valueLabel.layer.cornerRadius = 0
    }
    if item.renderer == "showMore" {
      centerButton.attributedText = nil
      centerButton.font = HomeContainerTypography.medium(16)
      centerButton.layer.cornerRadius = 18
      if item.showChevron == true {
        let text = NSMutableAttributedString(
          string: "\(item.title)  ",
          attributes: [.font: HomeContainerTypography.medium(16)]
        )
        let attachment = NSTextAttachment()
        attachment.image = HomeContainerMarketArtwork.chevronRightSmall(size: 20).withTintColor(
          UIColor(homeContainerColor: theme.primaryTextColor, fallback: .label),
          renderingMode: .alwaysOriginal
        )
        attachment.bounds = CGRect(x: 0, y: -4, width: 20, height: 20)
        text.append(NSAttributedString(attachment: attachment))
        centerButton.attributedText = text
      } else {
        centerButton.text = item.title
      }
      centerButton.textColor = UIColor(homeContainerColor: theme.primaryTextColor, fallback: .label)
      normalCenterBackgroundColor = UIColor(
        homeContainerColor: theme.cardColor,
        fallback: .secondarySystemBackground
      )
      centerButton.backgroundColor = normalCenterBackgroundColor
    } else if item.renderer == "empty" {
      centerButton.attributedText = nil
      centerButton.text = item.title
      centerButton.font = HomeContainerTypography.regular(15)
      centerButton.textColor = UIColor(
        homeContainerColor: theme.secondaryTextColor,
        fallback: .secondaryLabel
      )
      centerButton.backgroundColor = .clear
      centerButton.layer.cornerRadius = 0
    } else if item.renderer == "marketTabs" {
      applyMarketSegments(
        item.segments ?? [],
        theme: theme,
        onAction: onAction
      )
    } else if item.renderer == "addToken" {
      centerButton.text = nil
      centerButton.font = HomeContainerTypography.regular(14)
      centerButton.layer.cornerRadius = 0
      centerButton.textAlignment = .center
      centerButton.backgroundColor = .clear
      let font = HomeContainerTypography.regular(14)
      let paragraphStyle = NSMutableParagraphStyle()
      paragraphStyle.minimumLineHeight = 20
      paragraphStyle.maximumLineHeight = 20
      paragraphStyle.alignment = .center
      let text = NSMutableAttributedString(
        string: "\(item.title)  ",
        attributes: [
          .font: font,
          .paragraphStyle: paragraphStyle,
          .foregroundColor: UIColor(
            homeContainerColor: theme.secondaryTextColor,
            fallback: .tertiaryLabel
          )
        ]
      )
      text.append(NSAttributedString(
        string: "\(item.buttonTitle ?? "")  ",
        attributes: [
          .font: font,
          .paragraphStyle: paragraphStyle,
          .foregroundColor: UIColor(
            homeContainerColor: theme.subduedIconColor ?? theme.secondaryTextColor,
            fallback: .secondaryLabel
          )
        ]
      ))
      let arrow = NSTextAttachment()
      arrow.image = HomeContainerIcons.arrowRightOutline.withTintColor(
        UIColor(
          homeContainerColor: theme.subduedIconColor ?? theme.secondaryTextColor,
          fallback: .secondaryLabel
        ),
        renderingMode: .alwaysOriginal
      )
      arrow.bounds = CGRect(x: 0, y: -4, width: 18, height: 18)
      text.append(NSAttributedString(attachment: arrow))
      centerButton.attributedText = text
    } else {
      centerButton.attributedText = nil
      centerButton.textAlignment = .center
      centerButton.backgroundColor = .clear
    }
    setHighlighted(false, animated: false)
  }

  private func applyMarketSegments(
    _ segments: [HomeContainerSegment],
    theme: HomeContainerTheme,
    onAction: @escaping (String, String) -> Void
  ) {
    marketTabsStack.arrangedSubviews.forEach {
      marketTabsStack.removeArrangedSubview($0)
      $0.removeFromSuperview()
    }
    segments.forEach { segment in
      let button = HomeContainerMarketSegmentButton(segment: segment, theme: theme)
      button.onPress = {
        onAction(segment.actionId, segment.id)
      }
      marketTabsStack.addArrangedSubview(button)
    }
  }

  private func updateInlineBadges(
    _ badges: [String],
    theme: HomeContainerTheme
  ) {
    inlineBadgesStack.arrangedSubviews.forEach { view in
      inlineBadgesStack.removeArrangedSubview(view)
      view.removeFromSuperview()
    }
    let color = UIColor(
      homeContainerColor: theme.positiveColor,
      fallback: .systemGreen
    )
    badges.prefix(2).forEach { value in
      let label = HomeContainerInsetLabel()
      label.text = value
      label.font = HomeContainerTypography.medium(12)
      label.textColor = color
      label.backgroundColor = color.withAlphaComponent(0.12)
      label.contentInsets = UIEdgeInsets(top: 2, left: 6, bottom: 2, right: 6)
      label.layer.cornerRadius = 6
      label.clipsToBounds = true
      label.numberOfLines = 1
      label.setContentCompressionResistancePriority(.required, for: .horizontal)
      inlineBadgesStack.addArrangedSubview(label)
    }
    inlineBadgesStack.isHidden = badges.isEmpty
  }

  private enum AuxiliaryImageKind {
    case secondary
    case badge
    case titleAccessory
  }

  private func loadAuxiliaryImage(_ value: String?, kind: AuxiliaryImageKind) {
    let url = value.flatMap(URL.init(string:)).flatMap {
      $0.scheme == "https" || $0.scheme == "http" || $0.isFileURL ? $0 : nil
    }
    let representedURL: URL?
    let task: HomeContainerImageRequest?
    let imageView: UIImageView
    switch kind {
    case .secondary:
      representedURL = representedSecondaryImageURL
      task = secondaryImageTask
      imageView = secondaryIconImageView
    case .badge:
      representedURL = representedBadgeImageURL
      task = badgeImageTask
      imageView = badgeImageView
    case .titleAccessory:
      representedURL = representedTitleAccessoryImageURL
      task = titleAccessoryImageTask
      imageView = titleAccessoryImageView
    }
    guard representedURL != url else { return }
    task?.cancel()
    switch kind {
    case .secondary:
      secondaryImageTask = nil
      representedSecondaryImageURL = url
    case .badge:
      badgeImageTask = nil
      representedBadgeImageURL = url
    case .titleAccessory:
      titleAccessoryImageTask = nil
      representedTitleAccessoryImageURL = url
    }
    imageView.image = nil
    switch kind {
    case .secondary:
      secondaryIconImageView.isHidden = true
    case .badge:
      badgeContainerView.isHidden = true
      badgeImageView.isHidden = true
    case .titleAccessory:
      titleAccessoryImageView.isHidden = true
    }
    guard let url else { return }
    let request = HomeContainerImageLoader.shared.load(url: url) { [weak self] image in
      guard let self else { return }
      switch kind {
      case .secondary:
        guard self.representedSecondaryImageURL == url else { return }
        self.secondaryIconImageView.image = image
        self.secondaryIconImageView.isHidden = image == nil
      case .badge:
        guard self.representedBadgeImageURL == url else { return }
        self.badgeImageView.image = image
        self.badgeContainerView.isHidden = image == nil
        self.badgeImageView.isHidden = image == nil
      case .titleAccessory:
        guard self.representedTitleAccessoryImageURL == url else { return }
        self.titleAccessoryImageView.image = image
        self.titleAccessoryImageView.isHidden = image == nil
      }
    }
    switch kind {
    case .secondary:
      secondaryImageTask = request
    case .badge:
      badgeImageTask = request
    case .titleAccessory:
      titleAccessoryImageTask = request
    }
  }

  private func loadImage(
    _ value: String?,
    fallbacks: [String]?,
    fallbackColor: UIColor
  ) {
    let candidates = ([value].compactMap { $0 } + (fallbacks ?? []))
      .reduce(into: [URL]()) { result, candidate in
        guard let url = URL(string: candidate),
              url.scheme == "https" || url.scheme == "http",
              !result.contains(url) else { return }
        result.append(url)
      }
    let signature = candidates.map(\.absoluteString).joined(separator: "|") +
      "|fallback:\(usesCryptoCoinFallback ? "crypto" : "letter")" +
      ":\(fallbackColor.homeContainerSignature)"
    guard !hasAppliedImage || representedImageSignature != signature else { return }
    hasAppliedImage = true
    imageTask?.cancel()
    imageTask = nil
    representedImageSignature = signature
    applyPrimaryImageFallback(color: fallbackColor)
    loadImageCandidate(candidates, index: 0, signature: signature)
  }

  private func applyPrimaryImageFallback(color: UIColor) {
    guard usesCryptoCoinFallback else {
      iconImageView.image = nil
      iconLabel.isHidden = false
      return
    }
    iconImageView.contentMode = .scaleAspectFit
    iconImageView.image = Self.cryptoCoinFallbackImage(color: color)
    iconLabel.isHidden = true
  }

  private static func cryptoCoinFallbackBackgroundColor(for backgroundColor: UIColor) -> UIColor {
    var red: CGFloat = 1
    var green: CGFloat = 1
    var blue: CGFloat = 1
    var alpha: CGFloat = 1
    backgroundColor.getRed(&red, green: &green, blue: &blue, alpha: &alpha)
    let luminance = red * 0.299 + green * 0.587 + blue * 0.114
    return luminance < 0.5
      ? UIColor(red: 49 / 255, green: 49 / 255, blue: 49 / 255, alpha: 1)
      : UIColor(red: 224 / 255, green: 224 / 255, blue: 224 / 255, alpha: 1)
  }

  private static func cryptoCoinFallbackImage(color: UIColor) -> UIImage {
    let size = CGSize(width: 40, height: 40)
    return UIGraphicsImageRenderer(size: size).image { _ in
      color.setStroke()

      let outerRing = UIBezierPath(
        arcCenter: CGPoint(x: 20, y: 20),
        radius: 9,
        startAngle: 0,
        endAngle: .pi * 2,
        clockwise: true
      )
      outerRing.lineWidth = 2
      outerRing.stroke()

      let coinMark = UIBezierPath(
        arcCenter: CGPoint(x: 20, y: 20),
        radius: 3.5,
        startAngle: .pi * 31 / 180,
        endAngle: .pi * 329 / 180,
        clockwise: true
      )
      coinMark.lineWidth = 2
      coinMark.stroke()

      let stem = UIBezierPath()
      stem.move(to: CGPoint(x: 20, y: 14))
      stem.addLine(to: CGPoint(x: 20, y: 15.6))
      stem.move(to: CGPoint(x: 20, y: 24.4))
      stem.addLine(to: CGPoint(x: 20, y: 26))
      stem.lineWidth = 2
      stem.stroke()
    }
  }

  private func loadImageCandidate(_ candidates: [URL], index: Int, signature: String) {
    guard candidates.indices.contains(index) else { return }
    let url = candidates[index]
    imageTask = HomeContainerImageLoader.shared.load(
      url: url,
      retryOnFailure: index == candidates.count - 1
    ) { [weak self] image in
      guard let self, self.representedImageSignature == signature else { return }
      if let image {
        self.iconImageView.contentMode = .scaleAspectFill
        self.iconImageView.image = image
        self.iconLabel.isHidden = true
      } else {
        self.loadImageCandidate(candidates, index: index + 1, signature: signature)
      }
    }
  }
}

private final class HomeContainerMarketSegmentButton: UIButton {
  var onPress: (() -> Void)?
  private let normalBackgroundColor: UIColor
  private let hoverBackgroundColor: UIColor
  private let highlightedBackgroundColor: UIColor
  private var imageTask: HomeContainerImageRequest?
  private var representedImageURL: URL?
  private var isPointerHovering = false

  init(segment: HomeContainerSegment, theme: HomeContainerTheme) {
    let selected = segment.selected == true
    normalBackgroundColor = selected
      ? UIColor(homeContainerColor: theme.activeColor ?? theme.cardColor, fallback: .systemGray5)
      : .clear
    hoverBackgroundColor = UIColor(
      homeContainerColor: theme.hoverColor ?? theme.activeColor ?? theme.cardColor,
      fallback: .systemGray5
    )
    highlightedBackgroundColor = UIColor(
      homeContainerColor: theme.activeColor ?? theme.hoverColor ?? theme.cardColor,
      fallback: .systemGray5
    )
    super.init(frame: .zero)
    layer.cornerRadius = HomeContainerMetrics.marketSegmentHeight / 2
    clipsToBounds = true
    backgroundColor = normalBackgroundColor
    titleLabel?.font = HomeContainerTypography.medium(14)
    setTitleColor(
      UIColor(
        homeContainerColor: selected ? theme.primaryTextColor : theme.secondaryTextColor,
        fallback: selected ? .label : .secondaryLabel
      ),
      for: .normal
    )
    tintColor = UIColor(
      homeContainerColor: selected
        ? theme.primaryTextColor
        : theme.subduedIconColor ?? theme.secondaryTextColor,
      fallback: selected ? .label : .secondaryLabel
    )
    let fallbackImage = segment.leadingIcon == "star"
      ? HomeContainerMarketArtwork.star(filled: false, size: 18)
      : UIImage(systemName: "square.grid.2x2")
    let imageURL = segment.imageUrl.flatMap(URL.init(string:)).flatMap {
      $0.scheme == "https" || $0.scheme == "http" || $0.isFileURL ? $0 : nil
    }
    let hasLeadingImage = segment.leadingIcon != nil || imageURL != nil
    if hasLeadingImage {
      setImage(fallbackImage?.homeContainerThumbnail(size: 18), for: .normal)
    }
    representedImageURL = imageURL
    if let imageURL {
      imageTask = HomeContainerImageLoader.shared.load(url: imageURL) { [weak self] image in
        guard let self, self.representedImageURL == imageURL else { return }
        self.setImage(
          (image ?? fallbackImage)?.homeContainerThumbnail(size: 18),
          for: .normal
        )
      }
    }
    if segment.iconOnly != true {
      setTitle(segment.title, for: .normal)
    }
    let hasImageTitleSpacing = hasLeadingImage && segment.iconOnly != true
    imageEdgeInsets = hasImageTitleSpacing
      ? UIEdgeInsets(top: 0, left: -4, bottom: 0, right: 4)
      : .zero
    titleEdgeInsets = hasImageTitleSpacing
      ? UIEdgeInsets(top: 0, left: 4, bottom: 0, right: -4)
      : .zero
    contentEdgeInsets = UIEdgeInsets(
      top: 6,
      left: hasImageTitleSpacing ? 14 : 10,
      bottom: 6,
      right: hasImageTitleSpacing ? 14 : 10
    )
    heightAnchor.constraint(equalToConstant: HomeContainerMetrics.marketSegmentHeight).isActive = true
    if segment.iconOnly == true {
      widthAnchor.constraint(
        equalToConstant: max(38, HomeContainerMetrics.marketSegmentHeight + 6)
      ).isActive = true
    }
    accessibilityIdentifier = "native-home-market-category-\(segment.id)"
    accessibilityLabel = segment.title
    isSelected = selected
    accessibilityTraits = selected ? [.button, .selected] : [.button]
    addTarget(self, action: #selector(handlePress), for: .touchUpInside)
    addGestureRecognizer(UIHoverGestureRecognizer(target: self, action: #selector(handleHover(_:))))
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override var isHighlighted: Bool {
    didSet {
      updateInteractiveBackgroundColor()
    }
  }

  @objc private func handleHover(_ gestureRecognizer: UIHoverGestureRecognizer) {
    switch gestureRecognizer.state {
    case .began, .changed:
      isPointerHovering = true
    case .ended, .cancelled, .failed:
      isPointerHovering = false
    default:
      break
    }
    updateInteractiveBackgroundColor()
  }

  private func updateInteractiveBackgroundColor() {
    if isHighlighted {
      backgroundColor = highlightedBackgroundColor
    } else if isPointerHovering {
      backgroundColor = hoverBackgroundColor
    } else {
      backgroundColor = normalBackgroundColor
    }
  }

  @objc private func handlePress() {
    onPress?()
  }

  deinit {
    imageTask?.cancel()
  }
}
