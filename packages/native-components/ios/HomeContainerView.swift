import UIKit

private enum HomeContainerMetrics {
  static let tabHeight: CGFloat = 52
  static let rowHeight: CGFloat = 68
  static let nftRowHeight: CGFloat = 92
  static let emptyRowHeight: CGFloat = 108
  static let horizontalRowHeight: CGFloat = 132
  static let sectionTitleHeight: CGFloat = 56
  static let footerSlotIds = ["upgrade", "support"]

  static func contentHeaderHeight(tabId: String) -> CGFloat? {
    switch tabId {
    case "portfolio", "defi": return 56
    case "perps": return 88
    default: return nil
    }
  }

  static func footerSlotHeight(key: String) -> CGFloat? {
    if key.hasSuffix(".upgrade") { return 152 }
    if key.hasSuffix(".support") { return 371 }
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

private struct HomeContainerRow {
  enum Kind {
    case grid([HomeContainerItem])
    case horizontal(HomeContainerSection)
    case item(HomeContainerItem)
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
          item.secondaryImageUrl ?? "",
          item.badgeImageUrl ?? "",
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
        ]
          .joined(separator: ":")
      }.joined(separator: "|")
    case .sectionTitle(let section):
      return "section|\(section.title ?? "")|\(section.actionTitle ?? "")|\(section.actionId ?? "")"
    case .contentHeader(let tabId):
      return "content-header|\(tabId)"
    case .footerSlot(let key):
      return "footer-slot|\(key)"
    case .item(let item):
      return [
        item.renderer,
        item.title,
        item.subtitle ?? "",
        item.subtitleDetail ?? "",
        item.subtitleDetailColor ?? "",
        item.value ?? "",
        item.detail ?? "",
        item.imageUrl ?? "",
        item.secondaryImageUrl ?? "",
        item.badge ?? "",
        item.badgeImageUrl ?? "",
        item.accentColor ?? "",
        item.buttonTitle ?? "",
        item.leadingIcon ?? "",
        item.showChevron == true ? "1" : "0",
        item.actionId ?? "",
      ].joined(separator: "|")
    }
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

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    otherGestureRecognizer.view is HomeContainerNestedTableView
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

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    otherGestureRecognizer.view is HomeContainerNestedScrollView
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

private final class HomeContainerHorizontalScrollView: UIScrollView, UIGestureRecognizerDelegate {
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

  override func didMoveToWindow() {
    super.didMoveToWindow()
    guard window != nil else { return }
    var current = superview
    while let view = current {
      if let scrollView = view as? HomeContainerPagerScrollView {
        scrollView.panGestureRecognizer.require(toFail: panGestureRecognizer)
      } else if let scrollView = view as? HomeContainerNestedTableView {
        scrollView.panGestureRecognizer.require(toFail: panGestureRecognizer)
      } else if let scrollView = view as? HomeContainerNestedScrollView {
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

  var onAction: ((String, String, String) -> Void)?
  var onRefresh: ((String, String) -> Void)?
  var onVisibleTabChange: ((String) -> Void)?
  var onRenderError: ((String, String) -> Void)?
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
  private let lifecycleLock = NSLock()
  private var snapshot: HomeContainerSnapshot?
  private var pages: [HomeContainerPageView] = []
  private var refreshRequestIds = Set<String>()
  private var selectedTabId = ""
  private var disposed = false
  private var debugOverlayEnabled = false
  private var refreshEnabled = false
  private var headerHeight: CGFloat = 0
  private var mountedSlotKeys = Set<String>()
  private var pagerTransitionState = PagerTransitionState.idle
  private var pendingPagerNotify = false
  private var isCoordinatingNestedScroll = false

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
    outerScrollView.panGestureRecognizer.require(toFail: pager.panGestureRecognizer)
    addSubview(outerScrollView)
    outerScrollView.addSubview(headerView)
    outerScrollView.addSubview(pager)
    outerScrollView.addSubview(tabsView)
    headerView.onAction = { [weak self] actionId, itemId in
      guard let self else { return }
      self.onAction?(actionId, itemId, self.selectedTabId)
    }
    tabsView.onSelect = { [weak self] tabId in
      self?.moveToTab(tabId, animated: true, notify: true)
    }
    tabsView.onAction = { [weak self] actionId, itemId in
      guard let self else { return }
      self.onAction?(actionId, itemId, self.selectedTabId)
    }
    headerView.onSlotLayoutChange = { [weak self] in
      self?.slotLayoutDidChange?()
    }
    tabsView.onSlotLayoutChange = { [weak self] in
      self?.slotLayoutDidChange?()
    }
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
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
    outerScrollView.contentSize = CGSize(
      width: bounds.width,
      height: headerHeight + bounds.height
    )
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
      do {
        let next = try self.decoder.decode(
          HomeContainerSnapshot.self,
          from: Data(json.utf8)
        )
        guard next.schemaVersion == 1 else {
          self.reportError(
            code: "unsupported_schema",
            message: "HomeContainer schema \(next.schemaVersion) is not supported"
          )
          return
        }
        DispatchQueue.main.async { [weak self] in
          self?.applySnapshot(next)
        }
      } catch {
        self.reportError(code: "snapshot_decode_failed", message: error.localizedDescription)
      }
    }
  }

  func submitPatch(_ json: String) {
    parsingQueue.async { [weak self] in
      guard let self, !self.isDisposed() else { return }
      do {
        let patch = try self.decoder.decode(
          HomeContainerPatch.self,
          from: Data(json.utf8)
        )
        guard patch.schemaVersion == 1 else {
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
        self.reportError(code: "patch_decode_failed", message: error.localizedDescription)
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
      self?.moveToTab(tabId, animated: animated, notify: true)
    }
  }

  @objc(setMountedSlotKeys:)
  func setMountedSlotKeys(_ keys: [String]) {
    let nextKeys = Set(keys)
    guard nextKeys != mountedSlotKeys else { return }
    mountedSlotKeys = nextKeys
    tabsView.setMountedSlotKeys(nextKeys)
    pages.forEach { $0.setMountedSlotKeys(nextKeys) }
    slotLayoutDidChange?()
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
      self?.backgroundColor = UIColor(homeContainerColor: value, fallback: .systemBackground)
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
      self.refreshControl.isEnabled = enabled
    }
  }

  func dispose() {
    lifecycleLock.lock()
    disposed = true
    lifecycleLock.unlock()
  }

  private func applySnapshot(_ next: HomeContainerSnapshot) {
    guard !isDisposed() else { return }
    if let current = snapshot, next.revision < current.revision {
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
    for tab in next.tabs {
      let page = oldPages[tab.id] ?? makePage(tabId: tab.id)
      page.apply(
        tab: tab,
        theme: next.theme
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

    let requestedTab = next.tabs.contains(where: { $0.id == next.selectedTabId })
      ? next.selectedTabId
      : (next.tabs.first?.id ?? "")
    selectedTabId = requestedTab
    updateSelectedTab(requestedTab)
    setNeedsLayout()
    layoutIfNeeded()
  }

  private func applyPatch(_ patch: HomeContainerPatch) {
    guard let current = snapshot, patch.revision >= current.revision else {
      return
    }
    let validTabIds = Set(current.tabs.map(\.id))
    guard patch.tabs.allSatisfy({ validTabIds.contains($0.tabId) }) else { return }

    let next = current.applying(patch)
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

  private func makePage(tabId: String) -> HomeContainerPageView {
    let page = HomeContainerPageView(tabId: tabId)
    page.requirePagerPanToFail(pager.panGestureRecognizer)
    page.setMountedSlotKeys(mountedSlotKeys)
    page.onAction = { [weak self] actionId, itemId, sourceTabId in
      self?.onAction?(actionId, itemId, sourceTabId)
    }
    page.onContentOffsetChange = { [weak self] source in
      self?.coordinateNestedScroll(source: source)
    }
    page.onSlotLayoutChange = { [weak self] in
      self?.slotLayoutDidChange?()
    }
    return page
  }

  private func moveToTab(_ tabId: String, animated: Bool, notify: Bool) {
    guard let index = pages.firstIndex(where: { $0.tabId == tabId }) else { return }
    guard pagerTransitionState == .idle else { return }
    preparePagesForPagerTransition()
    pagerTransitionState = .settling(targetIndex: index)
    pendingPagerNotify = notify
    let targetOffset = CGPoint(x: CGFloat(index) * pager.bounds.width, y: 0)
    pager.setContentOffset(targetOffset, animated: animated)
    if !animated || abs(pager.contentOffset.x - targetOffset.x) <= 0.5 {
      finishPaging(notify: notify)
    }
  }

  private func preparePagesForPagerTransition() {
    pages.forEach { $0.layoutIfNeeded() }
  }

  private func updateSelectedTab(_ tabId: String) {
    tabsView.setSelectedTab(tabId)
  }

  func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
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
    if scrollView === pager, !decelerate {
      finishPaging(notify: pendingPagerNotify)
    }
  }

  func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) {
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
    let nextTabId = pages[index].tabId
    let didChangeTab = nextTabId != selectedTabId
    pagerTransitionState = .idle
    pendingPagerNotify = false
    selectedTabId = nextTabId
    updateSelectedTab(nextTabId)
    coordinateNestedScroll(source: pages[index])
    slotLayoutDidChange?()
    if notify, didChangeTab {
      onVisibleTabChange?(nextTabId)
    }
  }

  private func updateSharedChromeLayout() {
    let pinnedOffset = max(0, min(outerScrollView.contentOffset.y, headerHeight))
    tabsView.frame = CGRect(
      x: 0,
      y: max(headerHeight, pinnedOffset),
      width: bounds.width,
      height: HomeContainerMetrics.tabHeight
    )
    outerScrollView.bringSubviewToFront(tabsView)
  }

  private func coordinateOuterScroll() {
    guard !isCoordinatingNestedScroll else { return }
    isCoordinatingNestedScroll = true
    defer { isCoordinatingNestedScroll = false }
    let maximumOffset = headerHeight
    guard let page = pages.first(where: { $0.tabId == selectedTabId }) else {
      updateSharedChromeLayout()
      return
    }
    var targetOffset = outerScrollView.contentOffset.y
    let isPullingDown = outerScrollView.panGestureRecognizer.velocity(in: outerScrollView).y > 0
    if targetOffset > maximumOffset {
      targetOffset = maximumOffset
    } else if isPullingDown, page.bodyContentOffset > 0.5, targetOffset < maximumOffset {
      targetOffset = maximumOffset
    }
    if abs(targetOffset - outerScrollView.contentOffset.y) > 0.5 {
      outerScrollView.contentOffset.y = targetOffset
    }
    if outerScrollView.contentOffset.y < maximumOffset - 0.5,
       page.bodyContentOffset > 0.5 {
      page.setBodyContentOffset(0)
    }
    updateSharedChromeLayout()
  }

  private func coordinateNestedScroll(source: HomeContainerPageView) {
    guard source.tabId == selectedTabId, !isCoordinatingNestedScroll else { return }
    isCoordinatingNestedScroll = true
    defer { isCoordinatingNestedScroll = false }
    let maximumOffset = headerHeight
    let pageVelocity = source.panVelocityY
    if source.bodyContentOffset < 0 {
      source.setBodyContentOffset(0)
    }
    if outerScrollView.contentOffset.y < maximumOffset - 0.5,
       source.bodyContentOffset > 0.5,
       pageVelocity <= 0 {
      source.setBodyContentOffset(0)
    }
    updateSharedChromeLayout()
  }

  @objc private func refreshRequested() {
    guard refreshEnabled else {
      refreshControl.endRefreshing()
      return
    }
    let requestId = UUID().uuidString
    refreshRequestIds.insert(requestId)
    onRefresh?(selectedTabId, requestId)
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
  var onSlotLayoutChange: (() -> Void)?

  private let tableView = HomeContainerNestedTableView(frame: .zero, style: .plain)
  private var rowsById: [String: HomeContainerRow] = [:]
  private lazy var dataSource = makeDataSource()
  private var theme: HomeContainerTheme?
  private var sections: [HomeContainerSection] = []
  private var suppressContentOffsetCallback = false
  private var mountedSlotKeys = Set<String>()
  private var visibleSlotHosts: [String: HomeContainerSlotHostView] = [:]

  var bodyContentOffset: CGFloat {
    tableView.contentOffset.y
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
    tableView.register(HomeContainerSlotHostCell.self, forCellReuseIdentifier: "slot-host")
    addSubview(tableView)
    _ = dataSource
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
    theme: HomeContainerTheme
  ) {
    self.theme = theme
    backgroundColor = UIColor(
      homeContainerColor: theme.backgroundColor,
      fallback: .systemBackground
    )
    updateSections(tab.sections)
  }

  func updateSections(_ sections: [HomeContainerSection]) {
    self.sections = sections
    rebuildRows()
  }

  func setMountedSlotKeys(_ keys: Set<String>) {
    guard mountedSlotKeys != keys else { return }
    mountedSlotKeys = keys
    rebuildRows()
  }

  private func rebuildRows() {
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
      if section.layout == "grid" {
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
      guard let previous = previousRows[row.id],
            previous.contentSignature != row.contentSignature else { return nil }
      return row.id
    }
    if #available(iOS 15.0, *) {
      nextSnapshot.reconfigureItems(changedIds)
    } else {
      nextSnapshot.reloadItems(changedIds)
    }
    dataSource.apply(nextSnapshot, animatingDifferences: false) { [weak self] in
      DispatchQueue.main.async {
        self?.onSlotLayoutChange?()
      }
    }
  }

  func slotHostView(forKey key: String) -> UIView? {
    guard key.contains(".\(tabId)") else { return nil }
    return visibleSlotHosts[key]
  }

  func setBodyContentOffset(_ value: CGFloat) {
    guard abs(tableView.contentOffset.y - value) > 0.5 else { return }
    suppressContentOffsetCallback = true
    tableView.contentOffset.y = value
    suppressContentOffsetCallback = false
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
      return tableView.bounds.width / 2 + 54
    case .horizontal(let section):
      return section.items.first?.renderer == "supportPromo" ? 163 : HomeContainerMetrics.horizontalRowHeight
    case .sectionTitle:
      return row.id.hasPrefix("section:history:") ? 44 : HomeContainerMetrics.sectionTitleHeight
    case .item(let item):
      switch item.renderer {
      case "nft": return HomeContainerMetrics.nftRowHeight
      case "history": return 60
      case "defi", "market": return 64
      case "earn": return 56
      case "marketTabs", "showMore": return 56
      case "supportAction": return 76
      case "upgrade": return 96
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
    if let slotCell = cell as? HomeContainerSlotHostCell,
       !slotCell.slotKey.isEmpty {
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
    onContentOffsetChange?(self)
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
          cell.apply(slotKey: key)
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
          cell.apply(slotKey: key)
          return cell
        }
        let cell = tableView.dequeueReusableCell(withIdentifier: "item", for: indexPath)
          as! HomeContainerItemCell
        cell.apply(item: item, theme: theme)
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

  func apply(slotKey: String) {
    self.slotKey = slotKey
  }
}

private final class HomeContainerHeaderView: UIView {
  var onAction: ((String, String) -> Void)?
  var onSlotLayoutChange: (() -> Void)?
  private let contentStack = UIStackView()
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
  private let balanceActionsStack = UIStackView()
  private let actionsScroll = HomeContainerHorizontalScrollView()
  private let actionsStack = UIStackView()
  private let bannersScroll = HomeContainerHorizontalScrollView()
  private let bannersStack = UIStackView()
  private let accountSlotHost = HomeContainerSlotHostView()
  private let balanceSlotHost = HomeContainerSlotHostView()
  private let actionRowSlotHost = HomeContainerSlotHostView()
  private var actionControls: [String: HomeContainerActionControl] = [:]
  private var balanceActionButtons: [String: UIButton] = [:]
  private var bannerControls: [String: HomeContainerBannerControl] = [:]
  private var accountImageTask: HomeContainerImageRequest?
  private var networkImageTask: HomeContainerImageRequest?
  private var networkGroupImageTasks: [HomeContainerImageRequest] = []
  private var representedAccountImageURL: URL?
  private var representedNetworkImageURL: URL?
  private var representedNetworkGroupImageURLs: [URL] = []
  private var header: HomeContainerHeader?
  private(set) var preferredHeight: CGFloat = 216

  override init(frame: CGRect) {
    super.init(frame: frame)
    contentStack.axis = .vertical
    contentStack.spacing = 10
    contentStack.translatesAutoresizingMaskIntoConstraints = false
    addSubview(contentStack)
    NSLayoutConstraint.activate([
      contentStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
      contentStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
      contentStack.topAnchor.constraint(equalTo: topAnchor, constant: 16),
    ])

    accountRow.axis = .horizontal
    accountRow.alignment = .center
    accountRow.spacing = 8
    accountRow.heightAnchor.constraint(equalToConstant: 32).isActive = true
    accountButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
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
    networkButton.titleLabel?.font = .systemFont(ofSize: 15, weight: .medium)
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

    balanceButton.titleLabel?.font = .systemFont(ofSize: 48, weight: .medium)
    balanceButton.titleLabel?.adjustsFontSizeToFitWidth = true
    balanceButton.titleLabel?.minimumScaleFactor = 0.6
    balanceButton.contentHorizontalAlignment = .leading
    balanceButton.heightAnchor.constraint(equalToConstant: 58).isActive = true
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
    balanceActionsStack.heightAnchor.constraint(equalToConstant: 28).isActive = true
    contentStack.addArrangedSubview(balanceActionsStack)

    configureHorizontalStrip(scrollView: actionsScroll, stack: actionsStack, height: 72)
    configureHorizontalStrip(scrollView: bannersScroll, stack: bannersStack, height: 84)
    contentStack.addArrangedSubview(actionsScroll)
    contentStack.addArrangedSubview(bannersScroll)
    addSubview(accountSlotHost)
    addSubview(balanceSlotHost)
    addSubview(actionRowSlotHost)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func apply(header: HomeContainerHeader, theme: HomeContainerTheme) {
    self.header = header
    backgroundColor = .clear
    let primaryColor = UIColor(homeContainerColor: theme.primaryTextColor, fallback: .label)
    let secondaryColor = UIColor(homeContainerColor: theme.secondaryTextColor, fallback: .secondaryLabel)
    accountButton.setTitle("\(header.accountName) ⌄", for: .normal)
    accountButton.setTitleColor(primaryColor, for: .normal)
    accountButton.tintColor = primaryColor
    copyButton.tintColor = secondaryColor
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
    actionsScroll.isHidden = header.actions.isEmpty
    bannersScroll.isHidden = header.banners.isEmpty
    let balanceActionsHeight: CGFloat = (header.balanceActions ?? []).isEmpty ? 0 : 38
    preferredHeight = (header.banners.isEmpty ? 216 : 310) + balanceActionsHeight
  }

  deinit {
    accountImageTask?.cancel()
    networkImageTask?.cancel()
    networkGroupImageTasks.forEach { $0.cancel() }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    layoutSlotHost(accountSlotHost, target: accountRow)
    layoutSlotHost(balanceSlotHost, target: balanceButton)
    layoutSlotHost(actionRowSlotHost, target: actionsScroll)
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
    networkImageTask = HomeContainerImageLoader.shared.load(url: url) { [weak self] image in
      guard let self, self.representedNetworkImageURL == url else { return }
      self.networkButton.setImage(
        image?.homeContainerThumbnail(size: 22) ?? UIImage(systemName: "network"),
        for: .normal
      )
    }
  }

  private func loadNetworkGroupImages(_ values: [String]) {
    let urls = values.prefix(networkIconViews.count).compactMap { value -> URL? in
      guard let url = URL(string: value),
            url.scheme == "https" || url.scheme == "http" || url.isFileURL else { return nil }
      return url
    }
    guard representedNetworkGroupImageURLs != urls else { return }
    clearNetworkGroupImages()
    representedNetworkGroupImageURLs = urls
    for (index, url) in urls.enumerated() {
      networkIconViews[index].isHidden = false
      let task = HomeContainerImageLoader.shared.load(url: url) { [weak self] image in
        guard let self,
              self.representedNetworkGroupImageURLs.indices.contains(index),
              self.representedNetworkGroupImageURLs[index] == url else { return }
        self.networkIconViews[index].image = image?.homeContainerThumbnail(size: 22)
      }
      if let task {
        networkGroupImageTasks.append(task)
      }
    }
  }

  private func clearNetworkGroupImages() {
    networkGroupImageTasks.forEach { $0.cancel() }
    networkGroupImageTasks.removeAll()
    representedNetworkGroupImageURLs.removeAll()
    networkIconViews.forEach {
      $0.image = nil
      $0.isHidden = true
    }
  }

  private func configureHorizontalStrip(
    scrollView: UIScrollView,
    stack: UIStackView,
    height: CGFloat
  ) {
    scrollView.showsHorizontalScrollIndicator = false
    scrollView.alwaysBounceHorizontal = true
    scrollView.isDirectionalLockEnabled = true
    scrollView.heightAnchor.constraint(equalToConstant: height).isActive = true
    stack.axis = .horizontal
    stack.spacing = 10
    stack.translatesAutoresizingMaskIntoConstraints = false
    scrollView.addSubview(stack)
    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
      stack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
      stack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
      stack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
      stack.heightAnchor.constraint(equalTo: scrollView.frameLayoutGuide.heightAnchor),
    ])
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
        let button = UIButton(type: .system)
        button.accessibilityIdentifier = action.id
        button.titleLabel?.font = .systemFont(ofSize: 13, weight: .medium)
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

  override init(frame: CGRect) {
    super.init(frame: frame)
    addTarget(self, action: #selector(pressed), for: .touchUpInside)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  @objc private func pressed() {
    onPress?()
  }
}

private final class HomeContainerHitSlopButton: UIButton {
  var hitSlop = UIEdgeInsets(top: 12, left: 12, bottom: 12, right: 12)

  override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
    guard !isHidden, isUserInteractionEnabled, alpha > 0.01 else { return false }
    return bounds.inset(by: UIEdgeInsets(
      top: -hitSlop.top,
      left: -hitSlop.left,
      bottom: -hitSlop.bottom,
      right: -hitSlop.right
    )).contains(point)
  }
}

private final class HomeContainerActionControl: HomeContainerTapControl {
  let itemId: String
  private let iconView = UIImageView()
  private let titleLabel = UILabel()

  init(action: HomeContainerAction, theme: HomeContainerTheme) {
    itemId = action.id
    super.init(frame: .zero)
    layer.cornerRadius = 16
    widthAnchor.constraint(equalToConstant: 82).isActive = true
    iconView.contentMode = .scaleAspectFit
    iconView.translatesAutoresizingMaskIntoConstraints = false
    titleLabel.font = .systemFont(ofSize: 13, weight: .medium)
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
    backgroundColor = UIColor(homeContainerColor: theme.cardColor, fallback: .secondarySystemBackground)
    titleLabel.textColor = foreground
    titleLabel.text = action.title
    iconView.tintColor = foreground
    iconView.image = UIImage(systemName: Self.symbolName(for: action.icon))
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
  private let dismissButton = HomeContainerHitSlopButton(type: .system)
  private var imageTask: HomeContainerImageRequest?
  private var representedImageURL: URL?
  private var hasAppliedImage = false

  init(banner: HomeContainerBanner, theme: HomeContainerTheme) {
    itemId = banner.id
    super.init(frame: .zero)
    layer.cornerRadius = 16
    widthAnchor.constraint(equalToConstant: 246).isActive = true
    imageView.contentMode = .scaleAspectFit
    imageView.layer.cornerRadius = 10
    imageView.clipsToBounds = true
    imageView.translatesAutoresizingMaskIntoConstraints = false
    addSubview(imageView)
    titleLabel.font = .systemFont(ofSize: 15, weight: .semibold)
    titleLabel.numberOfLines = 2
    subtitleLabel.font = .systemFont(ofSize: 12)
    subtitleLabel.numberOfLines = 2
    let labels = UIStackView(arrangedSubviews: [titleLabel, subtitleLabel])
    labels.axis = .vertical
    labels.spacing = 3
    labels.translatesAutoresizingMaskIntoConstraints = false
    addSubview(labels)
    let dismissSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 12, weight: .medium)
    dismissButton.setImage(
      UIImage(systemName: "xmark", withConfiguration: dismissSymbolConfiguration),
      for: .normal
    )
    dismissButton.accessibilityIdentifier = "native-home-banner-dismiss"
    dismissButton.addAction(UIAction { [weak self] _ in self?.onDismiss?() }, for: .touchUpInside)
    dismissButton.translatesAutoresizingMaskIntoConstraints = false
    addSubview(dismissButton)
    NSLayoutConstraint.activate([
      imageView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
      imageView.centerYAnchor.constraint(equalTo: centerYAnchor),
      imageView.widthAnchor.constraint(equalToConstant: 50),
      imageView.heightAnchor.constraint(equalToConstant: 50),
      labels.leadingAnchor.constraint(equalTo: imageView.trailingAnchor, constant: 10),
      labels.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
      labels.centerYAnchor.constraint(equalTo: centerYAnchor),
      dismissButton.topAnchor.constraint(equalTo: topAnchor, constant: 8),
      dismissButton.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
      dismissButton.widthAnchor.constraint(equalToConstant: 28),
      dismissButton.heightAnchor.constraint(equalToConstant: 28),
    ])
    apply(banner: banner, theme: theme)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func apply(banner: HomeContainerBanner, theme: HomeContainerTheme) {
    backgroundColor = UIColor(homeContainerColor: theme.cardColor, fallback: .secondarySystemBackground)
    titleLabel.textColor = UIColor(homeContainerColor: theme.primaryTextColor, fallback: .label)
    subtitleLabel.textColor = UIColor(homeContainerColor: theme.secondaryTextColor, fallback: .secondaryLabel)
    titleLabel.text = banner.title
    subtitleLabel.text = banner.subtitle
    subtitleLabel.isHidden = banner.subtitle?.isEmpty != false
    dismissButton.isHidden = banner.dismissActionId?.isEmpty != false
    dismissButton.tintColor = UIColor(homeContainerColor: theme.secondaryTextColor, fallback: .secondaryLabel)
    loadImage(banner.imageUrl)
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

private final class HomeContainerTabsView: UIView {
  var onSelect: ((String) -> Void)?
  var onAction: ((String, String) -> Void)?
  var onSlotLayoutChange: (() -> Void)?
  private let scrollView = HomeContainerHorizontalScrollView()
  private let stack = UIStackView()
  private let toolbarButton = UIButton(type: .system)
  private let toolbarSlotHost = HomeContainerSlotHostView()
  private var buttons: [String: UIButton] = [:]
  private var tabsById: [String: HomeContainerTab] = [:]
  private var selectedTabId = ""
  private var theme: HomeContainerTheme?
  private var mountedSlotKeys = Set<String>()

  override init(frame: CGRect) {
    super.init(frame: frame)
    scrollView.showsHorizontalScrollIndicator = false
    scrollView.alwaysBounceHorizontal = true
    scrollView.translatesAutoresizingMaskIntoConstraints = false
    stack.axis = .horizontal
    stack.spacing = 24
    stack.translatesAutoresizingMaskIntoConstraints = false
    toolbarButton.titleLabel?.font = .systemFont(ofSize: 22, weight: .medium)
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
      stack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor, constant: 16),
      stack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor, constant: -16),
      stack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
      stack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
      stack.heightAnchor.constraint(equalTo: scrollView.frameLayoutGuide.heightAnchor),
      toolbarButton.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
      toolbarButton.centerYAnchor.constraint(equalTo: centerYAnchor),
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
      let button = UIButton(type: .system)
      button.setTitle(tab.title, for: .normal)
      button.titleLabel?.font = .systemFont(ofSize: 15, weight: .semibold)
      button.titleLabel?.numberOfLines = 1
      button.titleLabel?.adjustsFontSizeToFitWidth = true
      button.titleLabel?.minimumScaleFactor = 0.85
      button.accessibilityIdentifier = "HomeContainer.Tab.\(tab.id)"
      button.addAction(UIAction { [weak self] _ in self?.onSelect?(tab.id) }, for: .touchUpInside)
      button.alpha = 1
      button.isUserInteractionEnabled = true
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
      let color = tabId == selectedTabId
        ? UIColor(homeContainerColor: theme.primaryTextColor, fallback: .label)
        : UIColor(homeContainerColor: theme.secondaryTextColor, fallback: .secondaryLabel)
      button.setTitleColor(color, for: .normal)
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
    toolbarButton.alpha = 0
    toolbarButton.isUserInteractionEnabled = false
  }
}

private final class HomeContainerHorizontalCell: UITableViewCell {
  private let scrollView = HomeContainerHorizontalScrollView()
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
    titleLabel.font = .systemFont(ofSize: 16, weight: .semibold)
    titleLabel.numberOfLines = 2
    subtitleLabel.font = .systemFont(ofSize: 13)
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
    backgroundColor = UIColor(homeContainerColor: theme.cardColor, fallback: .secondarySystemBackground)
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
  private let actionButton = UIButton(type: .system)
  private var onAction: (() -> Void)?

  override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
    super.init(style: style, reuseIdentifier: reuseIdentifier)
    selectionStyle = .none
    titleLabel.font = .systemFont(ofSize: 20, weight: .semibold)
    titleLabel.translatesAutoresizingMaskIntoConstraints = false
    actionButton.titleLabel?.font = .systemFont(ofSize: 14)
    actionButton.translatesAutoresizingMaskIntoConstraints = false
    actionButton.addTarget(self, action: #selector(handleAction), for: .touchUpInside)
    contentView.addSubview(titleLabel)
    contentView.addSubview(actionButton)
    NSLayoutConstraint.activate([
      titleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
      titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: actionButton.leadingAnchor, constant: -8),
      titleLabel.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
      actionButton.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
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
    actionButton.setTitle(section.actionTitle.map { "\($0)  ›" }, for: .normal)
    actionButton.setTitleColor(
      UIColor(homeContainerColor: theme.secondaryTextColor, fallback: .secondaryLabel),
      for: .normal
    )
    actionButton.isHidden = section.actionTitle?.isEmpty != false
    self.onAction = onAction
    titleLabel.font = sectionId.hasPrefix("section:history:")
      ? .systemFont(ofSize: 13, weight: .semibold)
      : .systemFont(ofSize: 20, weight: .semibold)
    titleLabel.textColor = sectionId.hasPrefix("section:history:")
      ? UIColor(homeContainerColor: theme.secondaryTextColor, fallback: .secondaryLabel)
      : UIColor(homeContainerColor: theme.primaryTextColor, fallback: .label)
  }

  @objc private func handleAction() {
    onAction?()
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

private final class HomeContainerNFTCardControl: UIControl {
  private let imageView = UIImageView()
  private let collectionLabel = UILabel()
  private let titleLabel = UILabel()
  private let amountLabel = UILabel()
  private let networkImageView = UIImageView()
  private var imageTask: HomeContainerImageRequest?
  private var networkImageTask: HomeContainerImageRequest?
  private var representedImageURL: URL?
  private var representedNetworkImageURL: URL?
  private var itemId = ""
  private var actionId = ""
  private var onAction: ((String, String) -> Void)?

  override init(frame: CGRect) {
    super.init(frame: frame)
    imageView.contentMode = .scaleAspectFill
    imageView.clipsToBounds = true
    imageView.layer.cornerRadius = 10
    collectionLabel.font = .systemFont(ofSize: 13)
    collectionLabel.numberOfLines = 1
    titleLabel.font = .systemFont(ofSize: 16, weight: .semibold)
    titleLabel.numberOfLines = 1
    amountLabel.font = .systemFont(ofSize: 13, weight: .semibold)
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
    addAction(UIAction { [weak self] _ in
      guard let self, !self.actionId.isEmpty else { return }
      self.onAction?(self.actionId, self.itemId)
    }, for: .touchUpInside)
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
    collectionLabel.frame = CGRect(
      x: padding,
      y: collectionTop,
      width: max(0, imageWidth - 22),
      height: 18
    )
    titleLabel.frame = CGRect(x: padding, y: collectionTop + 20, width: imageWidth, height: 22)
    networkImageView.frame = CGRect(
      x: bounds.width - padding - 16,
      y: collectionTop + 1,
      width: 16,
      height: 16
    )
    let amountWidth = max(30, amountLabel.intrinsicContentSize.width + 12)
    amountLabel.frame = CGRect(
      x: imageView.frame.maxX - amountWidth - 6,
      y: imageView.frame.maxY - 24,
      width: amountWidth,
      height: 18
    )
  }

  func apply(
    item: HomeContainerItem,
    theme: HomeContainerTheme,
    onAction: @escaping (String, String) -> Void
  ) {
    itemId = item.id
    actionId = item.actionId ?? ""
    self.onAction = onAction
    backgroundColor = UIColor(homeContainerColor: theme.backgroundColor, fallback: .systemBackground)
    imageView.backgroundColor = UIColor(
      homeContainerColor: theme.cardColor,
      fallback: .secondarySystemBackground
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
    accessibilityLabel = [collectionLabel.text, titleLabel.text].compactMap { $0 }.joined(separator: ", ")
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
      networkImageView.isHidden = url == nil
    } else {
      guard representedImageURL != url else { return }
      imageTask?.cancel()
      representedImageURL = url
      imageView.image = nil
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
        self.imageView.image = image
      }
    }
    if isNetwork {
      networkImageTask = task
    } else {
      imageTask = task
    }
  }
}

private final class HomeContainerItemCell: UITableViewCell {
  private let iconContainer = UIView()
  private let iconImageView = UIImageView()
  private let secondaryIconImageView = UIImageView()
  private let badgeImageView = UIImageView()
  private let iconLabel = UILabel()
  private let titleLabel = UILabel()
  private let subtitleLabel = UILabel()
  private let subtitleDetailLabel = UILabel()
  private let valueLabel = UILabel()
  private let detailLabel = UILabel()
  private let chevronLabel = UILabel()
  private let centerButton = UILabel()
  private let divider = UIView()
  private var rightTrailingConstraint: NSLayoutConstraint?
  private var imageTask: HomeContainerImageRequest?
  private var secondaryImageTask: HomeContainerImageRequest?
  private var badgeImageTask: HomeContainerImageRequest?
  private var representedImageURL: URL?
  private var representedSecondaryImageURL: URL?
  private var representedBadgeImageURL: URL?
  private var hasAppliedImage = false
  private var currentRenderer = ""

  override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
    super.init(style: style, reuseIdentifier: reuseIdentifier)
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

    iconLabel.font = .systemFont(ofSize: 15, weight: .bold)
    iconLabel.textAlignment = .center
    iconLabel.translatesAutoresizingMaskIntoConstraints = false
    iconContainer.addSubview(iconLabel)

    titleLabel.font = .systemFont(ofSize: 16, weight: .semibold)
    subtitleLabel.font = .systemFont(ofSize: 14)
    subtitleDetailLabel.font = .systemFont(ofSize: 14)
    valueLabel.font = .systemFont(ofSize: 16, weight: .medium)
    valueLabel.textAlignment = .right
    detailLabel.font = .systemFont(ofSize: 14)
    detailLabel.textAlignment = .right

    let subtitleStack = UIStackView(arrangedSubviews: [subtitleLabel, subtitleDetailLabel])
    subtitleStack.axis = .horizontal
    subtitleStack.spacing = 4
    let leftStack = UIStackView(arrangedSubviews: [titleLabel, subtitleStack])
    leftStack.axis = .vertical
    leftStack.spacing = 3
    leftStack.translatesAutoresizingMaskIntoConstraints = false
    let rightStack = UIStackView(arrangedSubviews: [valueLabel, detailLabel])
    rightStack.axis = .vertical
    rightStack.spacing = 3
    rightStack.alignment = .trailing
    rightStack.translatesAutoresizingMaskIntoConstraints = false
    chevronLabel.text = "›"
    chevronLabel.font = .systemFont(ofSize: 28, weight: .regular)
    chevronLabel.textAlignment = .center
    chevronLabel.translatesAutoresizingMaskIntoConstraints = false
    centerButton.font = .systemFont(ofSize: 16, weight: .medium)
    centerButton.textAlignment = .center
    centerButton.layer.cornerRadius = 18
    centerButton.clipsToBounds = true
    centerButton.translatesAutoresizingMaskIntoConstraints = false
    badgeImageView.contentMode = .scaleAspectFill
    badgeImageView.layer.cornerRadius = 8
    badgeImageView.clipsToBounds = true
    badgeImageView.translatesAutoresizingMaskIntoConstraints = false
    divider.translatesAutoresizingMaskIntoConstraints = false

    contentView.addSubview(iconContainer)
    contentView.addSubview(leftStack)
    contentView.addSubview(rightStack)
    contentView.addSubview(chevronLabel)
    contentView.addSubview(badgeImageView)
    contentView.addSubview(centerButton)
    contentView.addSubview(divider)
    let rightTrailingConstraint = rightStack.trailingAnchor.constraint(
      equalTo: contentView.trailingAnchor,
      constant: -16
    )
    self.rightTrailingConstraint = rightTrailingConstraint
    NSLayoutConstraint.activate([
      iconContainer.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
      iconContainer.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
      iconContainer.widthAnchor.constraint(equalToConstant: 40),
      iconContainer.heightAnchor.constraint(equalToConstant: 40),
      iconImageView.leadingAnchor.constraint(equalTo: iconContainer.leadingAnchor),
      iconImageView.trailingAnchor.constraint(equalTo: iconContainer.trailingAnchor),
      iconImageView.topAnchor.constraint(equalTo: iconContainer.topAnchor),
      iconImageView.bottomAnchor.constraint(equalTo: iconContainer.bottomAnchor),
      secondaryIconImageView.trailingAnchor.constraint(equalTo: iconContainer.trailingAnchor),
      secondaryIconImageView.bottomAnchor.constraint(equalTo: iconContainer.bottomAnchor),
      secondaryIconImageView.widthAnchor.constraint(equalToConstant: 26),
      secondaryIconImageView.heightAnchor.constraint(equalToConstant: 26),
      iconLabel.leadingAnchor.constraint(equalTo: iconContainer.leadingAnchor),
      iconLabel.trailingAnchor.constraint(equalTo: iconContainer.trailingAnchor),
      iconLabel.topAnchor.constraint(equalTo: iconContainer.topAnchor),
      iconLabel.bottomAnchor.constraint(equalTo: iconContainer.bottomAnchor),
      leftStack.leadingAnchor.constraint(equalTo: iconContainer.trailingAnchor, constant: 12),
      leftStack.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
      rightStack.leadingAnchor.constraint(greaterThanOrEqualTo: leftStack.trailingAnchor, constant: 8),
      rightTrailingConstraint,
      rightStack.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
      chevronLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
      chevronLabel.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
      chevronLabel.widthAnchor.constraint(equalToConstant: 12),
      badgeImageView.trailingAnchor.constraint(equalTo: iconContainer.trailingAnchor, constant: 2),
      badgeImageView.bottomAnchor.constraint(equalTo: iconContainer.bottomAnchor, constant: 2),
      badgeImageView.widthAnchor.constraint(equalToConstant: 16),
      badgeImageView.heightAnchor.constraint(equalToConstant: 16),
      centerButton.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
      centerButton.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
      centerButton.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 6),
      centerButton.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -6),
      divider.leadingAnchor.constraint(equalTo: leftStack.leadingAnchor),
      divider.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
      divider.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
      divider.heightAnchor.constraint(equalToConstant: 0.5),
    ])
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    if currentRenderer == "supportAction" || currentRenderer == "upgrade" {
      contentView.frame = bounds.insetBy(dx: 16, dy: 6)
    } else {
      contentView.frame = bounds
    }
  }

  override func prepareForReuse() {
    super.prepareForReuse()
    imageTask?.cancel()
    secondaryImageTask?.cancel()
    badgeImageTask?.cancel()
    imageTask = nil
    secondaryImageTask = nil
    badgeImageTask = nil
    representedImageURL = nil
    representedSecondaryImageURL = nil
    representedBadgeImageURL = nil
    hasAppliedImage = false
    iconImageView.image = nil
    secondaryIconImageView.image = nil
    badgeImageView.image = nil
    iconLabel.isHidden = false
  }

  func apply(item: HomeContainerItem, theme: HomeContainerTheme) {
    currentRenderer = item.renderer
    setNeedsLayout()
    contentView.alpha = item.renderer == "empty" || item.renderer == "loading" ? 0 : 1
    backgroundColor = UIColor(homeContainerColor: theme.backgroundColor, fallback: .systemBackground)
    titleLabel.textColor = UIColor(homeContainerColor: theme.primaryTextColor, fallback: .label)
    subtitleLabel.textColor = UIColor(homeContainerColor: theme.secondaryTextColor, fallback: .secondaryLabel)
    subtitleDetailLabel.textColor = UIColor(
      homeContainerColor: item.subtitleDetailColor ?? theme.secondaryTextColor,
      fallback: .secondaryLabel
    )
    valueLabel.textColor = UIColor(
      homeContainerColor: item.renderer == "market"
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
    iconContainer.layer.cornerRadius = item.renderer == "upgrade" ? 10 : 20
    iconLabel.textColor = UIColor(homeContainerColor: theme.primaryTextColor, fallback: .label)
    switch item.leadingIcon {
    case "star": iconLabel.text = "★"
    case "support": iconLabel.text = "◉"
    case "book": iconLabel.text = "▣"
    case "download": iconLabel.text = "↓"
    case "prime": iconLabel.text = "1"
    default: iconLabel.text = String(item.title.prefix(1)).uppercased()
    }
    loadImage(item.imageUrl)
    loadAuxiliaryImage(
      item.secondaryImageUrl,
      representedURL: &representedSecondaryImageURL,
      task: &secondaryImageTask,
      imageView: secondaryIconImageView
    )
    loadAuxiliaryImage(
      item.badgeImageUrl,
      representedURL: &representedBadgeImageURL,
      task: &badgeImageTask,
      imageView: badgeImageView
    )
    titleLabel.text = item.title
    subtitleLabel.text = item.subtitle
    subtitleDetailLabel.text = item.subtitleDetail
    valueLabel.text = item.value
    detailLabel.text = item.detail
    subtitleLabel.isHidden = item.subtitle?.isEmpty != false
    subtitleDetailLabel.isHidden = item.subtitleDetail?.isEmpty != false
    valueLabel.isHidden = item.value?.isEmpty != false
    detailLabel.isHidden = item.detail?.isEmpty != false
    secondaryIconImageView.isHidden = item.secondaryImageUrl?.isEmpty != false
    badgeImageView.isHidden = item.badgeImageUrl?.isEmpty != false
    chevronLabel.isHidden = item.showChevron != true
    rightTrailingConstraint?.constant = item.showChevron == true ? -38 : -16
    centerButton.isHidden = item.renderer != "showMore" && item.renderer != "marketTabs"
    iconContainer.isHidden = !centerButton.isHidden
    titleLabel.superview?.isHidden = !centerButton.isHidden
    valueLabel.superview?.isHidden = !centerButton.isHidden
    divider.isHidden = item.renderer == "showMore" || item.renderer == "marketTabs" || item.renderer == "upgrade" || item.renderer == "supportAction"
    let usesCard = item.renderer == "supportAction" || item.renderer == "upgrade"
    contentView.backgroundColor = usesCard
      ? UIColor(homeContainerColor: theme.cardColor, fallback: .secondarySystemBackground)
      : UIColor(homeContainerColor: theme.backgroundColor, fallback: .systemBackground)
    contentView.layer.cornerRadius = usesCard ? 12 : 0
    contentView.layer.borderWidth = usesCard ? 0.5 : 0
    contentView.layer.borderColor = UIColor(
      homeContainerColor: theme.dividerColor,
      fallback: .separator
    ).cgColor
    if item.renderer == "upgrade" {
      iconLabel.textColor = .black
    }

    titleLabel.font = .systemFont(ofSize: 16, weight: .medium)
    valueLabel.font = .systemFont(ofSize: 16, weight: .medium)
    if item.renderer == "history" {
      titleLabel.font = .systemFont(ofSize: 16, weight: .medium)
    }
    if item.renderer == "market" {
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
      centerButton.text = item.showChevron == true ? "\(item.title)  ›" : item.title
      centerButton.textColor = UIColor(homeContainerColor: theme.primaryTextColor, fallback: .label)
      centerButton.backgroundColor = UIColor(homeContainerColor: theme.cardColor, fallback: .secondarySystemBackground)
    } else if item.renderer == "marketTabs" {
      centerButton.textAlignment = .left
      centerButton.text = "  ☆    \(item.title)      \(item.subtitle ?? "")"
      centerButton.textColor = UIColor(homeContainerColor: theme.secondaryTextColor, fallback: .secondaryLabel)
      centerButton.backgroundColor = .clear
    } else {
      centerButton.textAlignment = .center
    }
  }

  private func loadAuxiliaryImage(
    _ value: String?,
    representedURL: inout URL?,
    task: inout HomeContainerImageRequest?,
    imageView: UIImageView
  ) {
    let url = value.flatMap(URL.init(string:)).flatMap {
      $0.scheme == "https" || $0.scheme == "http" || $0.isFileURL ? $0 : nil
    }
    guard representedURL != url else { return }
    task?.cancel()
    task = nil
    representedURL = url
    imageView.image = nil
    guard let url else { return }
    task = HomeContainerImageLoader.shared.load(url: url) { [weak imageView] image in
      imageView?.image = image
    }
  }

  private func loadImage(_ value: String?) {
    let url = value.flatMap(URL.init(string:)).flatMap {
      $0.scheme == "https" || $0.scheme == "http" ? $0 : nil
    }
    guard !hasAppliedImage || representedImageURL != url else { return }
    hasAppliedImage = true
    imageTask?.cancel()
    imageTask = nil
    representedImageURL = url
    iconImageView.image = nil
    iconLabel.isHidden = false
    guard let url else { return }
    imageTask = HomeContainerImageLoader.shared.load(url: url) { [weak self] image in
      guard let self, self.representedImageURL == url else { return }
      self.iconImageView.image = image
      self.iconLabel.isHidden = image != nil
    }
  }
}
