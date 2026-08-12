import UIKit

final class HomeContainerView: UIView {
  private let scrollView = UIScrollView()
  private let contentStack = UIStackView()
  private let balanceHost = UIView()
  private let balanceButton = UIButton(type: .system)
  private let balanceSkeleton = UIView()
  private let actionSubtitleLabel = UILabel()
  private let actionsScrollView = UIScrollView()
  private let actionsStack = UIStackView()
  private let tabHost = UIView()
  private let tabLabel = UILabel()
  private let portfolioCard = UIView()
  private let portfolioTitleLabel = UILabel()
  private let portfolioMessageLabel = UILabel()

  private var currentState: INativeHomeViewModel?
  private var onIntent: ((_ intent: INativeHomeIntent) -> Void)?
  private var actionSurfaceColor = UIColor.secondarySystemBackground
  private var actionActiveSurfaceColor = UIColor.tertiarySystemBackground
  private var actionForegroundColor = UIColor.label
  private var actionIconColor = UIColor.secondaryLabel
  private var actionPrimaryBackgroundColor = UIColor.label
  private var actionPrimaryForegroundColor = UIColor.systemBackground
  private var balancePrimaryColor = UIColor.label
  private var balanceDisabledColor = UIColor.tertiaryLabel

  override init(frame: CGRect) {
    super.init(frame: frame)
    configureView()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func apply(
    state: INativeHomeViewModel?,
    onIntent: ((_ intent: INativeHomeIntent) -> Void)?
  ) {
    dispatchPrecondition(condition: .onQueue(.main))
    currentState = state
    self.onIntent = onIntent

    guard let state else {
      balanceButton.isEnabled = false
      actionsStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
      return
    }

    applyTheme(state.theme)
    applyHeader(state.header)
    tabLabel.text = state.tabs.first(where: { $0.id == state.selectedTab })?.title
    portfolioTitleLabel.text = state.portfolio.title
    portfolioMessageLabel.text = state.portfolio.message
  }

  func dispose() {
    currentState = nil
    onIntent = nil
    balanceButton.isEnabled = false
    actionsStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
  }

  private func configureView() {
    accessibilityIdentifier = "native-home-slice-2"

    scrollView.alwaysBounceVertical = true
    scrollView.showsVerticalScrollIndicator = false
    scrollView.translatesAutoresizingMaskIntoConstraints = false
    addSubview(scrollView)

    contentStack.axis = .vertical
    contentStack.spacing = 20
    contentStack.translatesAutoresizingMaskIntoConstraints = false
    scrollView.addSubview(contentStack)

    balanceHost.translatesAutoresizingMaskIntoConstraints = false
    balanceHost.heightAnchor.constraint(equalToConstant: 48).isActive = true

    balanceButton.contentHorizontalAlignment = .leading
    balanceButton.contentVerticalAlignment = .center
    balanceButton.titleLabel?.font = HomeContainerTypography.medium(48)
    balanceButton.titleLabel?.adjustsFontForContentSizeCategory = false
    balanceButton.titleLabel?.adjustsFontSizeToFitWidth = true
    balanceButton.titleLabel?.minimumScaleFactor = 0.55
    balanceButton.accessibilityIdentifier = "native-home-header-balance"
    balanceButton.translatesAutoresizingMaskIntoConstraints = false
    balanceButton.addTarget(self, action: #selector(handleBalancePress), for: .touchUpInside)
    balanceHost.addSubview(balanceButton)

    balanceSkeleton.layer.cornerRadius = 10
    balanceSkeleton.translatesAutoresizingMaskIntoConstraints = false
    balanceSkeleton.accessibilityIdentifier = "native-home-header-balance-loading"
    balanceHost.addSubview(balanceSkeleton)

    actionSubtitleLabel.font = HomeContainerTypography.regular(14)
    actionSubtitleLabel.adjustsFontForContentSizeCategory = false
    actionSubtitleLabel.heightAnchor.constraint(equalToConstant: 20).isActive = true

    actionsScrollView.showsHorizontalScrollIndicator = false
    actionsScrollView.alwaysBounceHorizontal = false
    actionsScrollView.isDirectionalLockEnabled = true
    actionsScrollView.heightAnchor.constraint(equalToConstant: 62).isActive = true
    actionsStack.axis = .horizontal
    actionsStack.alignment = .center
    actionsStack.spacing = 10
    actionsStack.translatesAutoresizingMaskIntoConstraints = false
    actionsScrollView.addSubview(actionsStack)

    tabHost.translatesAutoresizingMaskIntoConstraints = false
    tabHost.heightAnchor.constraint(equalToConstant: 52).isActive = true
    tabLabel.font = HomeContainerTypography.semibold(18)
    tabLabel.adjustsFontForContentSizeCategory = false
    tabLabel.translatesAutoresizingMaskIntoConstraints = false
    tabHost.addSubview(tabLabel)

    portfolioCard.layer.cornerRadius = 16
    portfolioCard.translatesAutoresizingMaskIntoConstraints = false
    let portfolioStack = UIStackView(arrangedSubviews: [
      portfolioTitleLabel,
      portfolioMessageLabel,
    ])
    portfolioStack.axis = .vertical
    portfolioStack.spacing = 10
    portfolioStack.translatesAutoresizingMaskIntoConstraints = false
    portfolioCard.addSubview(portfolioStack)

    portfolioTitleLabel.font = HomeContainerTypography.regular(22)
    portfolioTitleLabel.adjustsFontForContentSizeCategory = false
    portfolioMessageLabel.font = HomeContainerTypography.regular(17)
    portfolioMessageLabel.adjustsFontForContentSizeCategory = false
    portfolioMessageLabel.numberOfLines = 0

    contentStack.addArrangedSubview(balanceHost)
    contentStack.addArrangedSubview(actionSubtitleLabel)
    contentStack.setCustomSpacing(20, after: balanceHost)
    contentStack.setCustomSpacing(12, after: actionSubtitleLabel)
    contentStack.addArrangedSubview(actionsScrollView)
    contentStack.setCustomSpacing(32, after: actionsScrollView)
    contentStack.addArrangedSubview(tabHost)
    contentStack.addArrangedSubview(portfolioCard)

    NSLayoutConstraint.activate([
      scrollView.topAnchor.constraint(equalTo: topAnchor),
      scrollView.leadingAnchor.constraint(equalTo: leadingAnchor),
      scrollView.trailingAnchor.constraint(equalTo: trailingAnchor),
      scrollView.bottomAnchor.constraint(equalTo: bottomAnchor),
      contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 20),
      contentStack.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor, constant: 20),
      contentStack.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor, constant: -20),
      contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -24),
      balanceButton.topAnchor.constraint(equalTo: balanceHost.topAnchor),
      balanceButton.leadingAnchor.constraint(equalTo: balanceHost.leadingAnchor),
      balanceButton.trailingAnchor.constraint(equalTo: balanceHost.trailingAnchor),
      balanceButton.bottomAnchor.constraint(equalTo: balanceHost.bottomAnchor),
      balanceSkeleton.leadingAnchor.constraint(equalTo: balanceHost.leadingAnchor),
      balanceSkeleton.centerYAnchor.constraint(equalTo: balanceHost.centerYAnchor),
      balanceSkeleton.widthAnchor.constraint(equalToConstant: 210),
      balanceSkeleton.heightAnchor.constraint(equalToConstant: 42),
      actionsStack.leadingAnchor.constraint(equalTo: actionsScrollView.contentLayoutGuide.leadingAnchor),
      actionsStack.trailingAnchor.constraint(equalTo: actionsScrollView.contentLayoutGuide.trailingAnchor),
      actionsStack.topAnchor.constraint(equalTo: actionsScrollView.contentLayoutGuide.topAnchor),
      actionsStack.bottomAnchor.constraint(equalTo: actionsScrollView.contentLayoutGuide.bottomAnchor),
      actionsStack.heightAnchor.constraint(equalTo: actionsScrollView.frameLayoutGuide.heightAnchor),
      tabLabel.leadingAnchor.constraint(equalTo: tabHost.leadingAnchor),
      tabLabel.trailingAnchor.constraint(lessThanOrEqualTo: tabHost.trailingAnchor),
      tabLabel.topAnchor.constraint(equalTo: tabHost.topAnchor, constant: 14),
      tabLabel.heightAnchor.constraint(equalToConstant: 24),
      portfolioStack.topAnchor.constraint(equalTo: portfolioCard.topAnchor, constant: 20),
      portfolioStack.leadingAnchor.constraint(equalTo: portfolioCard.leadingAnchor, constant: 20),
      portfolioStack.trailingAnchor.constraint(equalTo: portfolioCard.trailingAnchor, constant: -20),
      portfolioStack.bottomAnchor.constraint(equalTo: portfolioCard.bottomAnchor, constant: -20),
    ])
  }

  private func applyTheme(_ theme: INativeHomeThemeViewModel) {
    let background = UIColor(homeHex: theme.backgroundColor, fallback: .systemBackground)
    let surface = UIColor(homeHex: theme.surfaceColor, fallback: .secondarySystemBackground)
    let primary = UIColor(homeHex: theme.primaryTextColor, fallback: .label)
    let secondary = UIColor(homeHex: theme.secondaryTextColor, fallback: .secondaryLabel)
    let disabled = UIColor(homeHex: theme.disabledTextColor, fallback: .tertiaryLabel)
    let accent = UIColor(homeHex: theme.accentColor, fallback: .systemGreen)

    backgroundColor = background
    scrollView.backgroundColor = background
    balanceButton.setTitleColor(primary, for: .normal)
    balanceSkeleton.backgroundColor = surface
    actionSubtitleLabel.textColor = secondary
    tabLabel.textColor = primary
    portfolioCard.backgroundColor = surface
    portfolioTitleLabel.textColor = primary
    portfolioMessageLabel.textColor = secondary
    actionSurfaceColor = surface
    actionActiveSurfaceColor = primary.withAlphaComponent(
      theme.colorScheme == .dark ? 0.134 : 0.122
    )
    actionForegroundColor = primary
    actionIconColor = secondary
    actionPrimaryBackgroundColor = accent
    actionPrimaryForegroundColor = background
    balancePrimaryColor = primary
    balanceDisabledColor = disabled
    tintColor = primary
  }

  private func applyHeader(_ header: INativeHomeHeaderViewModel) {
    let isLoading = header.state == .loading
    balanceSkeleton.isHidden = !isLoading
    balanceButton.isHidden = isLoading
    balanceButton.isEnabled = header.balanceActionEnabled && onIntent != nil
    balanceButton.setAttributedTitle(
      makeBalanceTitle(header.balanceText, isHidden: header.balanceHidden),
      for: .normal
    )
    balanceButton.accessibilityValue = header.balanceHidden ? "Hidden" : header.balanceText
    actionSubtitleLabel.isHidden = header.actionSubtitle.isEmpty

    switch header.actionLayout {
    case .loading:
      actionSubtitleLabel.text = header.actionSubtitle
      showLoadingActions()
    case .zero:
      actionSubtitleLabel.text = header.actionSubtitle
      showActions(header.actions, layout: .zero)
    case .funded:
      actionSubtitleLabel.text = header.actionSubtitle
      showActions(header.actions, layout: .funded)
    }
  }

  private func showLoadingActions() {
    actionsStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
    for _ in 0..<4 {
      let skeleton = UIView()
      skeleton.backgroundColor = balanceSkeleton.backgroundColor
      skeleton.layer.cornerRadius = 16
      skeleton.translatesAutoresizingMaskIntoConstraints = false
      actionsStack.addArrangedSubview(skeleton)
      skeleton.widthAnchor.constraint(
        equalTo: actionsScrollView.frameLayoutGuide.widthAnchor,
        multiplier: 0.25,
        constant: -7.5
      ).isActive = true
    }
  }

  private func showActions(
    _ actions: [INativeHomeHeaderActionViewModel],
    layout: NativeHomeHeaderActionLayout
  ) {
    actionsStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
    for action in actions {
      let isPrimaryZeroAction = layout == .zero && action.id == .addmoney
      let isCompactZeroAction = layout == .zero && !isPrimaryZeroAction
      let controlLayout: HomeContainerActionControl.Layout = if isPrimaryZeroAction {
        .zeroPrimary
      } else if isCompactZeroAction {
        .zeroCompact
      } else {
        .funded
      }
      let button = HomeContainerActionControl(
        action: action,
        layout: controlLayout,
        surfaceColor: actionSurfaceColor,
        activeSurfaceColor: actionActiveSurfaceColor,
        foregroundColor: actionForegroundColor,
        iconColor: actionIconColor,
        primaryBackgroundColor: actionPrimaryBackgroundColor,
        primaryForegroundColor: actionPrimaryForegroundColor
      )
      button.isEnabled = action.enabled && onIntent != nil
      button.alpha = action.enabled ? 1 : 0.4
      button.accessibilityLabel = action.title
      button.accessibilityIdentifier = "native-home-header-action-\(action.id.stringValue)"
      button.translatesAutoresizingMaskIntoConstraints = false
      actionsStack.addArrangedSubview(button)
      if layout == .zero {
        if isPrimaryZeroAction {
          button.widthAnchor.constraint(
            equalTo: actionsScrollView.frameLayoutGuide.widthAnchor,
            constant: -58
          ).isActive = true
        } else {
          button.widthAnchor.constraint(equalToConstant: 48).isActive = true
        }
        button.heightAnchor.constraint(equalToConstant: 48).isActive = true
      } else {
        let count = max(actions.count, 1)
        let totalSpacing = actionsStack.spacing * CGFloat(count - 1)
        button.widthAnchor.constraint(
          equalTo: actionsScrollView.frameLayoutGuide.widthAnchor,
          multiplier: 1 / CGFloat(count),
          constant: -(totalSpacing / CGFloat(count))
        ).isActive = true
        button.heightAnchor.constraint(equalToConstant: 62).isActive = true
      }
      button.addAction(UIAction { [weak self] _ in
        self?.emit(action.id)
      }, for: .touchUpInside)
    }
  }

  private func makeBalanceTitle(_ text: String, isHidden: Bool) -> NSAttributedString {
    let paragraph = NSMutableParagraphStyle()
    paragraph.minimumLineHeight = 48
    paragraph.maximumLineHeight = 48
    let value = NSMutableAttributedString(
      string: text,
      attributes: [
        .font: HomeContainerTypography.medium(48),
        .foregroundColor: balancePrimaryColor,
        .paragraphStyle: paragraph,
      ]
    )
    guard !isHidden,
          let expression = try? NSRegularExpression(
            pattern: "[\\.,][0-9]+(?=[^0-9]*$)"
          )
    else {
      return value
    }
    let range = NSRange(text.startIndex..<text.endIndex, in: text)
    if let match = expression.firstMatch(in: text, range: range) {
      value.addAttribute(.foregroundColor, value: balanceDisabledColor, range: match.range)
    }
    return value
  }

  @objc
  private func handleBalancePress() {
    guard let actionId = currentState?.header.balanceActionId else { return }
    emit(actionId)
  }

  private func emit(_ actionId: NativeHomeHeaderActionId) {
    guard let owner = currentState?.owner else { return }
    onIntent?(INativeHomeIntent(owner: owner, actionId: actionId))
  }
}

private enum HomeContainerTypography {
  static func regular(_ size: CGFloat) -> UIFont {
    UIFont(name: "Roobert-Regular", size: size) ?? .systemFont(ofSize: size)
  }

  static func medium(_ size: CGFloat) -> UIFont {
    UIFont(name: "Roobert-Medium", size: size) ?? .systemFont(ofSize: size, weight: .medium)
  }

  static func semibold(_ size: CGFloat) -> UIFont {
    UIFont(name: "Roobert-SemiBold", size: size) ?? .systemFont(ofSize: size, weight: .semibold)
  }
}

private final class HomeContainerActionControl: UIControl {
  enum Layout: Equatable {
    case funded
    case zeroPrimary
    case zeroCompact
  }

  private let iconView = UIImageView()
  private let titleLabel = UILabel()
  private let normalBackgroundColor: UIColor
  private let activeBackgroundColor: UIColor

  override var isHighlighted: Bool {
    didSet {
      backgroundColor = isHighlighted ? activeBackgroundColor : normalBackgroundColor
    }
  }

  init(
    action: INativeHomeHeaderActionViewModel,
    layout: Layout,
    surfaceColor: UIColor,
    activeSurfaceColor: UIColor,
    foregroundColor: UIColor,
    iconColor: UIColor,
    primaryBackgroundColor: UIColor,
    primaryForegroundColor: UIColor
  ) {
    let isPrimary = layout == .zeroPrimary
    normalBackgroundColor = isPrimary ? primaryBackgroundColor : surfaceColor
    activeBackgroundColor = isPrimary
      ? primaryBackgroundColor.withAlphaComponent(0.72)
      : activeSurfaceColor
    super.init(frame: .zero)

    backgroundColor = normalBackgroundColor
    layer.cornerRadius = layout == .funded ? 16 : 24
    layer.cornerCurve = .continuous
    clipsToBounds = true

    let iconSize: CGFloat = layout == .funded ? 24 : 20
    iconView.image = HomeContainerActionIcons.image(for: action.icon, size: iconSize)
    iconView.tintColor = isPrimary ? primaryForegroundColor : iconColor
    iconView.contentMode = .scaleAspectFit
    iconView.translatesAutoresizingMaskIntoConstraints = false

    titleLabel.text = action.title
    titleLabel.textColor = isPrimary ? primaryForegroundColor : foregroundColor
    titleLabel.font = layout == .funded
      ? HomeContainerTypography.regular(12)
      : HomeContainerTypography.medium(16)
    titleLabel.textAlignment = .center
    titleLabel.adjustsFontForContentSizeCategory = false
    titleLabel.adjustsFontSizeToFitWidth = true
    titleLabel.minimumScaleFactor = 0.85
    titleLabel.lineBreakMode = .byClipping
    titleLabel.translatesAutoresizingMaskIntoConstraints = false

    addSubview(iconView)
    if layout != .zeroCompact {
      addSubview(titleLabel)
    }

    switch layout {
    case .funded:
      NSLayoutConstraint.activate([
        iconView.topAnchor.constraint(equalTo: topAnchor, constant: 10),
        iconView.centerXAnchor.constraint(equalTo: centerXAnchor),
        iconView.widthAnchor.constraint(equalToConstant: 24),
        iconView.heightAnchor.constraint(equalToConstant: 24),
        titleLabel.topAnchor.constraint(equalTo: iconView.bottomAnchor, constant: 4),
        titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 4),
        titleLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -4),
        titleLabel.heightAnchor.constraint(equalToConstant: 16),
      ])
    case .zeroPrimary:
      let row = UIStackView(arrangedSubviews: [iconView, titleLabel])
      row.axis = .horizontal
      row.alignment = .center
      row.spacing = 8
      row.isUserInteractionEnabled = false
      row.translatesAutoresizingMaskIntoConstraints = false
      addSubview(row)
      NSLayoutConstraint.activate([
        iconView.widthAnchor.constraint(equalToConstant: 20),
        iconView.heightAnchor.constraint(equalToConstant: 20),
        titleLabel.heightAnchor.constraint(equalToConstant: 24),
        row.centerXAnchor.constraint(equalTo: centerXAnchor),
        row.centerYAnchor.constraint(equalTo: centerYAnchor),
        row.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: 20),
        row.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -20),
      ])
    case .zeroCompact:
      NSLayoutConstraint.activate([
        iconView.centerXAnchor.constraint(equalTo: centerXAnchor),
        iconView.centerYAnchor.constraint(equalTo: centerYAnchor),
        iconView.widthAnchor.constraint(equalToConstant: 20),
        iconView.heightAnchor.constraint(equalToConstant: 20),
      ])
    }
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }
}

private enum HomeContainerActionIcons {
  static func image(for icon: NativeHomeHeaderActionIcon, size: CGFloat) -> UIImage {
    let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
    let image = renderer.image { context in
      context.cgContext.scaleBy(x: size / 24, y: size / 24)
      UIColor.black.setFill()
      path(for: icon).fill()
    }
    return image.withRenderingMode(.alwaysTemplate)
  }

  private static func path(for icon: NativeHomeHeaderActionIcon) -> UIBezierPath {
    switch icon {
    case .add:
      return polygon([
        (13, 11), (21, 11), (21, 13), (13, 13), (13, 21), (11, 21),
        (11, 13), (3, 13), (3, 11), (11, 11), (11, 3), (13, 3),
      ])
    case .send:
      return polygon([
        (19.414, 10), (18, 11.414), (13, 6.414), (13, 21), (11, 21),
        (11, 6.414), (6, 11.414), (4.586, 10), (12, 2.586),
      ])
    case .receive:
      return polygon([
        (13, 17.586), (18, 12.586), (19.414, 14), (12, 21.414),
        (4.586, 14), (6, 12.586), (11, 17.586), (11, 3), (13, 3),
      ])
    case .more:
      let path = UIBezierPath(rect: CGRect(x: 2, y: 10, width: 4, height: 4))
      path.append(UIBezierPath(rect: CGRect(x: 10, y: 10, width: 4, height: 4)))
      path.append(UIBezierPath(rect: CGRect(x: 18, y: 10, width: 4, height: 4)))
      return path
    case .buy:
      return currencyDollarPath()
    case .swap:
      let path = polygon([
        (9.414, 13), (6.414, 16), (21, 16), (21, 18), (6.414, 18),
        (9.414, 21), (8, 22.414), (2.586, 17), (8, 11.586),
      ])
      path.append(polygon([
        (21.414, 7), (16, 12.414), (14.586, 11), (17.586, 8), (3, 8),
        (3, 6), (17.586, 6), (14.586, 3), (16, 1.586),
      ]))
      return path
    case .perp:
      let path = UIBezierPath(rect: CGRect(x: 13.5, y: 11, width: 2, height: 10))
      path.append(UIBezierPath(rect: CGRect(x: 3, y: 7, width: 2, height: 10)))
      path.append(UIBezierPath(rect: CGRect(x: 19, y: 7, width: 2, height: 10)))
      path.append(UIBezierPath(rect: CGRect(x: 8.5, y: 3, width: 2, height: 10)))
      return path
    case .staking:
      let path = UIBezierPath(ovalIn: CGRect(x: 2, y: 3, width: 14, height: 14))
      path.append(UIBezierPath(ovalIn: CGRect(x: 4, y: 5, width: 10, height: 10)))
      path.append(UIBezierPath(ovalIn: CGRect(x: 8, y: 7, width: 14, height: 14)))
      path.append(UIBezierPath(ovalIn: CGRect(x: 10, y: 9, width: 10, height: 10)))
      path.usesEvenOddFillRule = true
      return path
    }
  }

  private static func polygon(_ points: [(CGFloat, CGFloat)]) -> UIBezierPath {
    let path = UIBezierPath()
    guard let first = points.first else { return path }
    path.move(to: CGPoint(x: first.0, y: first.1))
    for point in points.dropFirst() {
      path.addLine(to: CGPoint(x: point.0, y: point.1))
    }
    path.close()
    return path
  }

  private static func currencyDollarPath() -> UIBezierPath {
    let path = UIBezierPath()
    path.move(to: CGPoint(x: 13, y: 2.807))
    path.addCurve(
      to: CGPoint(x: 18.006, y: 5.052),
      controlPoint1: CGPoint(x: 14.871, y: 3.001),
      controlPoint2: CGPoint(x: 16.741, y: 3.719)
    )
    path.addLine(to: CGPoint(x: 16.555, y: 6.429))
    path.addCurve(
      to: CGPoint(x: 13, y: 4.819),
      controlPoint1: CGPoint(x: 15.727, y: 5.557),
      controlPoint2: CGPoint(x: 14.411, y: 5.004)
    )
    path.addLine(to: CGPoint(x: 13, y: 11.407))
    path.addCurve(
      to: CGPoint(x: 16.696, y: 12.717),
      controlPoint1: CGPoint(x: 14.258, y: 11.735),
      controlPoint2: CGPoint(x: 15.621, y: 12.108)
    )
    path.addCurve(
      to: CGPoint(x: 18.335, y: 14.168),
      controlPoint1: CGPoint(x: 17.325, y: 13.073),
      controlPoint2: CGPoint(x: 17.909, y: 13.537)
    )
    path.addCurve(
      to: CGPoint(x: 19, y: 16.453),
      controlPoint1: CGPoint(x: 18.769, y: 14.811),
      controlPoint2: CGPoint(x: 19, y: 15.573)
    )
    path.addCurve(
      to: CGPoint(x: 16.953, y: 20.036),
      controlPoint1: CGPoint(x: 19, y: 18.056),
      controlPoint2: CGPoint(x: 18.14, y: 19.26)
    )
    path.addCurve(
      to: CGPoint(x: 13, y: 21.228),
      controlPoint1: CGPoint(x: 15.847, y: 20.76),
      controlPoint2: CGPoint(x: 14.429, y: 21.139)
    )
    path.addLine(to: CGPoint(x: 13, y: 23.5))
    path.addLine(to: CGPoint(x: 11, y: 23.5))
    path.addLine(to: CGPoint(x: 11, y: 21.167))
    path.addCurve(
      to: CGPoint(x: 8.32, y: 20.457),
      controlPoint1: CGPoint(x: 10.05, y: 21.09),
      controlPoint2: CGPoint(x: 9.15, y: 20.85)
    )
    path.addCurve(
      to: CGPoint(x: 5.086, y: 17.46),
      controlPoint1: CGPoint(x: 6.948, y: 19.861),
      controlPoint2: CGPoint(x: 5.717, y: 18.885)
    )
    path.addLine(to: CGPoint(x: 6.914, y: 16.65))
    path.addCurve(
      to: CGPoint(x: 9.117, y: 18.622),
      controlPoint1: CGPoint(x: 7.284, y: 17.484),
      controlPoint2: CGPoint(x: 8.053, y: 18.16)
    )
    path.addCurve(
      to: CGPoint(x: 11, y: 19.148),
      controlPoint1: CGPoint(x: 9.72, y: 18.88),
      controlPoint2: CGPoint(x: 10.35, y: 19.06)
    )
    path.addLine(to: CGPoint(x: 11, y: 12.944))
    path.addCurve(
      to: CGPoint(x: 7.76, y: 11.634),
      controlPoint1: CGPoint(x: 9.874, y: 12.629),
      controlPoint2: CGPoint(x: 8.71, y: 12.238)
    )
    path.addCurve(
      to: CGPoint(x: 5.5, y: 7.589),
      controlPoint1: CGPoint(x: 6.447, y: 10.8),
      controlPoint2: CGPoint(x: 5.5, y: 9.53)
    )
    path.addCurve(
      to: CGPoint(x: 7.125, y: 4.242),
      controlPoint1: CGPoint(x: 5.5, y: 6.168),
      controlPoint2: CGPoint(x: 6.149, y: 5.036)
    )
    path.addCurve(
      to: CGPoint(x: 10.608, y: 2.842),
      controlPoint1: CGPoint(x: 8.077, y: 3.469),
      controlPoint2: CGPoint(x: 9.327, y: 3.022)
    )
    path.addCurve(
      to: CGPoint(x: 11, y: 2.799),
      controlPoint1: CGPoint(x: 10.738, y: 2.825),
      controlPoint2: CGPoint(x: 10.868, y: 2.812)
    )
    path.addLine(to: CGPoint(x: 11, y: 0.5))
    path.addLine(to: CGPoint(x: 13, y: 0.5))
    path.close()

    path.move(to: CGPoint(x: 13, y: 19.222))
    path.addCurve(
      to: CGPoint(x: 15.86, y: 18.362),
      controlPoint1: CGPoint(x: 14.133, y: 19.134),
      controlPoint2: CGPoint(x: 15.143, y: 18.831)
    )
    path.addCurve(
      to: CGPoint(x: 17, y: 16.453),
      controlPoint1: CGPoint(x: 16.61, y: 17.872),
      controlPoint2: CGPoint(x: 17, y: 17.24)
    )
    path.addCurve(
      to: CGPoint(x: 16.677, y: 15.286),
      controlPoint1: CGPoint(x: 17, y: 15.942),
      controlPoint2: CGPoint(x: 16.872, y: 15.575)
    )
    path.addCurve(
      to: CGPoint(x: 15.71, y: 14.457),
      controlPoint1: CGPoint(x: 16.474, y: 14.986),
      controlPoint2: CGPoint(x: 16.16, y: 14.712)
    )
    path.addCurve(
      to: CGPoint(x: 13, y: 13.477),
      controlPoint1: CGPoint(x: 14.99, y: 14.049),
      controlPoint2: CGPoint(x: 14.065, y: 13.763)
    )
    path.close()

    path.move(to: CGPoint(x: 10.884, y: 4.822))
    path.addCurve(
      to: CGPoint(x: 8.386, y: 5.794),
      controlPoint1: CGPoint(x: 9.852, y: 4.966),
      controlPoint2: CGPoint(x: 8.978, y: 5.312)
    )
    path.addCurve(
      to: CGPoint(x: 7.5, y: 7.588),
      controlPoint1: CGPoint(x: 7.818, y: 6.256),
      controlPoint2: CGPoint(x: 7.5, y: 6.841)
    )
    path.addCurve(
      to: CGPoint(x: 8.833, y: 9.948),
      controlPoint1: CGPoint(x: 7.5, y: 8.729),
      controlPoint2: CGPoint(x: 7.991, y: 9.412)
    )
    path.addCurve(
      to: CGPoint(x: 11, y: 10.86),
      controlPoint1: CGPoint(x: 9.423, y: 10.323),
      controlPoint2: CGPoint(x: 10.161, y: 10.605)
    )
    path.addLine(to: CGPoint(x: 11, y: 4.81))
    path.close()
    path.usesEvenOddFillRule = true
    return path
  }
}

private extension UIColor {
  convenience init(homeHex: String, fallback: UIColor) {
    let hex = homeHex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
    guard hex.count == 6 || hex.count == 8 else {
      self.init(cgColor: fallback.cgColor)
      return
    }

    var value: UInt64 = 0
    guard Scanner(string: hex).scanHexInt64(&value) else {
      self.init(cgColor: fallback.cgColor)
      return
    }

    let red: CGFloat
    let green: CGFloat
    let blue: CGFloat
    let alpha: CGFloat
    if hex.count == 8 {
      red = CGFloat((value >> 24) & 0xFF) / 255
      green = CGFloat((value >> 16) & 0xFF) / 255
      blue = CGFloat((value >> 8) & 0xFF) / 255
      alpha = CGFloat(value & 0xFF) / 255
    } else {
      red = CGFloat((value >> 16) & 0xFF) / 255
      green = CGFloat((value >> 8) & 0xFF) / 255
      blue = CGFloat(value & 0xFF) / 255
      alpha = 1
    }
    self.init(red: red, green: green, blue: blue, alpha: alpha)
  }
}
