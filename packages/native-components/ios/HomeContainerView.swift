import UIKit

private enum HomeContainerFooterIcons {
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
}

final class HomeContainerView: UIView {
  private enum Section: Hashable {
    case portfolio
  }

  private enum Item: Hashable {
    case title
    case token(String)
    case lowValueAssets
    case riskAssets
    case manageTokens
    case toggle(Bool)
    case loading(Int)
    case empty
  }

  private struct PortfolioRow {
    let id: String
    let symbol: String
    let iconURL: String
    let networkIconURL: String
    let priceText: String
    let priceChangeText: String
    let priceChangeDirection: NativeHomePriceChangeDirection
    let balanceText: String
    let valueText: String
    let valuationState: NativeHomePortfolioValuationState
    let enabled: Bool
  }

  private static let fundedHeaderHeight: CGFloat = 182
  private static let zeroHeaderHeight: CGFloat = 214

  private let collectionLayout = HomeContainerCollectionLayout()
  private lazy var collectionView = UICollectionView(
    frame: .zero,
    collectionViewLayout: collectionLayout
  )
  private let headerHost = UIView()
  private let headerStack = UIStackView()
  private let balanceHost = UIView()
  private let balanceButton = UIButton(type: .system)
  private let balanceSkeleton = UIView()
  private let actionSubtitleLabel = UILabel()
  private let actionsScrollView = UIScrollView()
  private let actionsStack = UIStackView()

  private var currentState: INativeHomeViewModel?
  private var onIntent: ((_ intent: INativeHomeIntent) -> Void)?
  private var dataSource: UICollectionViewDiffableDataSource<Section, Item>?
  private var portfolioRows: [String: PortfolioRow] = [:]
  private var portfolioTitle = ""
  private var portfolioEmptyText = ""
  private var portfolioShowMoreTitle = ""
  private var portfolioShowLessTitle = ""
  private var portfolioInitialVisibleItemCount = 6
  private var showsAllPortfolioItems = false
  private var currentHeaderHeight = HomeContainerView.fundedHeaderHeight
  private var currentOwnerSessionId = ""
  private var tabTitle = ""
  private var actionSurfaceColor = UIColor.secondarySystemBackground
  private var actionActiveSurfaceColor = UIColor.tertiarySystemBackground
  private var actionForegroundColor = UIColor.label
  private var actionIconColor = UIColor.secondaryLabel
  private var actionPrimaryBackgroundColor = UIColor.label
  private var actionPrimaryForegroundColor = UIColor.systemBackground
  private var balancePrimaryColor = UIColor.label
  private var balanceDisabledColor = UIColor.tertiaryLabel
  private var portfolioBackgroundColor = UIColor.systemBackground
  private var portfolioSurfaceColor = UIColor.secondarySystemBackground
  private var portfolioActiveColor = UIColor.systemGray5
  private var portfolioPrimaryTextColor = UIColor.label
  private var portfolioSecondaryTextColor = UIColor.secondaryLabel
  private var portfolioDisabledTextColor = UIColor.tertiaryLabel
  private var portfolioSuccessTextColor = UIColor.systemGreen
  private var portfolioCriticalTextColor = UIColor.systemRed
  private var portfolioSwitchOffColor = UIColor.systemGray4
  private var portfolioSwitchThumbColor = UIColor.systemBackground

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
      portfolioRows = [:]
      applyPortfolioSnapshot(animatingDifferences: false)
      return
    }

    let ownerChanged = currentOwnerSessionId != state.owner.sessionId
    if ownerChanged {
      currentOwnerSessionId = state.owner.sessionId
      showsAllPortfolioItems = false
    }
    applyTheme(state.theme)
    applyHeader(state.header)
    tabTitle = state.tabs.first(where: { $0.id == state.selectedTab })?.title ?? ""
    portfolioTitle = state.portfolio.title
    portfolioEmptyText = state.portfolio.emptyText
    portfolioShowMoreTitle = state.portfolio.showMoreTitle
    portfolioShowLessTitle = state.portfolio.showLessTitle
    portfolioInitialVisibleItemCount = max(Int(state.portfolio.initialVisibleItemCount), 1)
    var rows: [String: PortfolioRow] = [:]
    for item in state.portfolio.items {
      rows[item.id] = PortfolioRow(
        id: item.id,
        symbol: item.symbol,
        iconURL: item.iconUrl,
        networkIconURL: item.networkIconUrl,
        priceText: item.priceText,
        priceChangeText: item.priceChangeText,
        priceChangeDirection: item.priceChangeDirection,
        balanceText: item.balanceText,
        valueText: item.valueText,
        valuationState: item.valuationState,
        enabled: item.enabled
      )
    }
    portfolioRows = rows
    applyPortfolioSnapshot(animatingDifferences: !ownerChanged)
  }

  func dispose() {
    currentState = nil
    onIntent = nil
    balanceButton.isEnabled = false
    actionsStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
    portfolioRows = [:]
    applyPortfolioSnapshot(animatingDifferences: false)
  }

  private func configureView() {
    accessibilityIdentifier = "native-home-slice-3"

    collectionLayout.minimumLineSpacing = 0
    collectionLayout.minimumInteritemSpacing = 0
    collectionView.alwaysBounceVertical = true
    collectionView.showsVerticalScrollIndicator = false
    collectionView.contentInsetAdjustmentBehavior = .never
    collectionView.contentInset = UIEdgeInsets(
      top: currentHeaderHeight,
      left: 0,
      bottom: 96,
      right: 0
    )
    collectionView.scrollIndicatorInsets = collectionView.contentInset
    collectionView.delegate = self
    collectionView.accessibilityIdentifier = "native-home-portfolio-list"
    collectionView.translatesAutoresizingMaskIntoConstraints = false
    addSubview(collectionView)

    headerHost.translatesAutoresizingMaskIntoConstraints = true
    collectionView.addSubview(headerHost)

    headerStack.axis = .vertical
    headerStack.spacing = 0
    headerStack.translatesAutoresizingMaskIntoConstraints = false
    headerHost.addSubview(headerStack)

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

    headerStack.addArrangedSubview(balanceHost)
    headerStack.addArrangedSubview(actionSubtitleLabel)
    headerStack.setCustomSpacing(20, after: balanceHost)
    headerStack.setCustomSpacing(12, after: actionSubtitleLabel)
    headerStack.addArrangedSubview(actionsScrollView)

    collectionView.register(
      HomeContainerPortfolioTitleCell.self,
      forCellWithReuseIdentifier: HomeContainerPortfolioTitleCell.reuseIdentifier
    )
    collectionView.register(
      HomeContainerPortfolioTokenCell.self,
      forCellWithReuseIdentifier: HomeContainerPortfolioTokenCell.reuseIdentifier
    )
    collectionView.register(
      HomeContainerPortfolioFooterCell.self,
      forCellWithReuseIdentifier: HomeContainerPortfolioFooterCell.reuseIdentifier
    )
    collectionView.register(
      HomeContainerPortfolioManageTokensCell.self,
      forCellWithReuseIdentifier: HomeContainerPortfolioManageTokensCell.reuseIdentifier
    )
    collectionView.register(
      HomeContainerPortfolioStatusCell.self,
      forCellWithReuseIdentifier: HomeContainerPortfolioStatusCell.reuseIdentifier
    )
    collectionView.register(
      HomeContainerPortfolioToggleCell.self,
      forCellWithReuseIdentifier: HomeContainerPortfolioToggleCell.reuseIdentifier
    )
    collectionView.register(
      HomeContainerTabHeaderView.self,
      forSupplementaryViewOfKind: UICollectionView.elementKindSectionHeader,
      withReuseIdentifier: HomeContainerTabHeaderView.reuseIdentifier
    )

    configureDataSource()

    NSLayoutConstraint.activate([
      collectionView.topAnchor.constraint(equalTo: topAnchor),
      collectionView.leadingAnchor.constraint(equalTo: leadingAnchor),
      collectionView.trailingAnchor.constraint(equalTo: trailingAnchor),
      collectionView.bottomAnchor.constraint(equalTo: bottomAnchor),
      headerStack.topAnchor.constraint(equalTo: headerHost.topAnchor, constant: 20),
      headerStack.leadingAnchor.constraint(equalTo: headerHost.leadingAnchor, constant: 20),
      headerStack.trailingAnchor.constraint(equalTo: headerHost.trailingAnchor, constant: -20),
      headerStack.bottomAnchor.constraint(equalTo: headerHost.bottomAnchor, constant: -32),
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
    ])

    collectionView.setContentOffset(
      CGPoint(x: 0, y: -currentHeaderHeight),
      animated: false
    )
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    headerHost.frame = CGRect(
      x: 0,
      y: -currentHeaderHeight,
      width: collectionView.bounds.width,
      height: currentHeaderHeight
    )
  }

  private func applyTheme(_ theme: INativeHomeThemeViewModel) {
    let background = UIColor(homeHex: theme.backgroundColor, fallback: .systemBackground)
    let surface = UIColor(homeHex: theme.surfaceColor, fallback: .secondarySystemBackground)
    let primary = UIColor(homeHex: theme.primaryTextColor, fallback: .label)
    let secondary = UIColor(homeHex: theme.secondaryTextColor, fallback: .secondaryLabel)
    let disabled = UIColor(homeHex: theme.disabledTextColor, fallback: .tertiaryLabel)
    let success = UIColor(homeHex: theme.successTextColor, fallback: .systemGreen)
    let critical = UIColor(homeHex: theme.criticalTextColor, fallback: .systemRed)
    let accent = UIColor(homeHex: theme.accentColor, fallback: .systemGreen)

    backgroundColor = background
    collectionView.backgroundColor = background
    headerHost.backgroundColor = background
    balanceButton.setTitleColor(primary, for: .normal)
    balanceSkeleton.backgroundColor = surface
    actionSubtitleLabel.textColor = secondary
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
    portfolioBackgroundColor = background
    portfolioSurfaceColor = surface
    portfolioActiveColor = primary.withAlphaComponent(
      theme.colorScheme == .dark ? 0.105 : 0.09
    )
    portfolioPrimaryTextColor = primary
    portfolioSecondaryTextColor = secondary
    portfolioDisabledTextColor = disabled
    portfolioSuccessTextColor = success
    portfolioCriticalTextColor = critical
    portfolioSwitchOffColor = primary.withAlphaComponent(
      theme.colorScheme == .dark ? 0.134 : 0.122
    )
    portfolioSwitchThumbColor = background
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
      updateHeaderHeight(Self.fundedHeaderHeight)
    case .zero:
      actionSubtitleLabel.text = header.actionSubtitle
      showActions(header.actions, layout: .zero)
      updateHeaderHeight(Self.zeroHeaderHeight)
    case .funded:
      actionSubtitleLabel.text = header.actionSubtitle
      showActions(header.actions, layout: .funded)
      updateHeaderHeight(Self.fundedHeaderHeight)
    }
  }

  private func updateHeaderHeight(_ height: CGFloat) {
    guard height != currentHeaderHeight else { return }
    let previousHeight = currentHeaderHeight
    currentHeaderHeight = height
    collectionView.contentInset.top = height
    collectionView.scrollIndicatorInsets.top = height
    collectionView.contentOffset.y -= height - previousHeight
    setNeedsLayout()
  }

  private func configureDataSource() {
    dataSource = UICollectionViewDiffableDataSource<Section, Item>(
      collectionView: collectionView
    ) { [weak self] collectionView, indexPath, item in
      guard let self else { return nil }
      switch item {
      case .title:
        let cell = collectionView.dequeueReusableCell(
          withReuseIdentifier: HomeContainerPortfolioTitleCell.reuseIdentifier,
          for: indexPath
        ) as? HomeContainerPortfolioTitleCell
        cell?.apply(
          title: portfolioTitle,
          filter: currentState?.portfolio.deFiTokensFilter,
          backgroundColor: portfolioBackgroundColor,
          primaryTextColor: portfolioPrimaryTextColor,
          secondaryTextColor: portfolioSecondaryTextColor,
          disabledTextColor: portfolioDisabledTextColor,
          switchOffColor: portfolioSwitchOffColor,
          switchThumbColor: portfolioSwitchThumbColor
        ) { [weak self] value in
          self?.emitPortfolioAction(.toggledefitokens, value: value)
        }
        return cell
      case let .token(id):
        let cell = collectionView.dequeueReusableCell(
          withReuseIdentifier: HomeContainerPortfolioTokenCell.reuseIdentifier,
          for: indexPath
        ) as? HomeContainerPortfolioTokenCell
        if let row = portfolioRows[id] {
          cell?.apply(
            id: row.id,
            symbol: row.symbol,
            iconURL: row.iconURL,
            networkIconURL: row.networkIconURL,
            priceText: row.priceText,
            priceChangeText: row.priceChangeText,
            priceChangeDirection: row.priceChangeDirection,
            balanceText: row.balanceText,
            valueText: row.valueText,
            valuationState: row.valuationState,
            enabled: row.enabled,
            backgroundColor: portfolioBackgroundColor,
            surfaceColor: portfolioSurfaceColor,
            activeColor: portfolioActiveColor,
            primaryTextColor: portfolioPrimaryTextColor,
            secondaryTextColor: portfolioSecondaryTextColor,
            successTextColor: portfolioSuccessTextColor,
            criticalTextColor: portfolioCriticalTextColor
          )
        }
        return cell
      case .lowValueAssets:
        let cell = collectionView.dequeueReusableCell(
          withReuseIdentifier: HomeContainerPortfolioFooterCell.reuseIdentifier,
          for: indexPath
        ) as? HomeContainerPortfolioFooterCell
        if let item = currentState?.portfolio.lowValueAssets {
          cell?.apply(
            title: item.title,
            value: item.valueText,
            icon: HomeContainerFooterIcons.lowValueSolid,
            accessibilityIdentifier: "native-home-low-value-assets",
            enabled: item.enabled,
            backgroundColor: portfolioBackgroundColor,
            surfaceColor: portfolioSurfaceColor,
            activeColor: portfolioActiveColor,
            primaryTextColor: portfolioPrimaryTextColor,
            secondaryTextColor: portfolioSecondaryTextColor
          )
        }
        return cell
      case .riskAssets:
        let cell = collectionView.dequeueReusableCell(
          withReuseIdentifier: HomeContainerPortfolioFooterCell.reuseIdentifier,
          for: indexPath
        ) as? HomeContainerPortfolioFooterCell
        if let item = currentState?.portfolio.riskAssets {
          cell?.apply(
            title: item.title,
            value: "",
            icon: HomeContainerFooterIcons.riskSolid,
            accessibilityIdentifier: "native-home-risk-assets",
            enabled: item.enabled,
            backgroundColor: portfolioBackgroundColor,
            surfaceColor: portfolioSurfaceColor,
            activeColor: portfolioActiveColor,
            primaryTextColor: portfolioPrimaryTextColor,
            secondaryTextColor: portfolioSecondaryTextColor
          )
        }
        return cell
      case .manageTokens:
        let cell = collectionView.dequeueReusableCell(
          withReuseIdentifier: HomeContainerPortfolioManageTokensCell.reuseIdentifier,
          for: indexPath
        ) as? HomeContainerPortfolioManageTokensCell
        if let item = currentState?.portfolio.manageTokens {
          cell?.apply(
            instruction: item.instruction,
            actionTitle: item.actionTitle,
            enabled: item.enabled,
            backgroundColor: portfolioBackgroundColor,
            disabledTextColor: portfolioSecondaryTextColor.withAlphaComponent(0.72),
            actionTextColor: portfolioSecondaryTextColor
          ) { [weak self] in
            self?.emitPortfolioAction(.managetokens)
          }
        }
        return cell
      case let .toggle(isExpanded):
        let cell = collectionView.dequeueReusableCell(
          withReuseIdentifier: HomeContainerPortfolioToggleCell.reuseIdentifier,
          for: indexPath
        ) as? HomeContainerPortfolioToggleCell
        cell?.apply(
          title: isExpanded ? portfolioShowLessTitle : portfolioShowMoreTitle,
          isExpanded: isExpanded,
          backgroundColor: portfolioBackgroundColor,
          surfaceColor: portfolioSurfaceColor,
          activeSurfaceColor: portfolioPrimaryTextColor.withAlphaComponent(0.122),
          textColor: portfolioPrimaryTextColor
        ) { [weak self] in
          guard let self else { return }
          showsAllPortfolioItems.toggle()
          applyPortfolioSnapshot(animatingDifferences: true)
        }
        return cell
      case .loading:
        let cell = collectionView.dequeueReusableCell(
          withReuseIdentifier: HomeContainerPortfolioTokenCell.reuseIdentifier,
          for: indexPath
        ) as? HomeContainerPortfolioTokenCell
        cell?.applyLoading(
          backgroundColor: portfolioBackgroundColor,
          surfaceColor: portfolioSurfaceColor
        )
        return cell
      case .empty:
        let cell = collectionView.dequeueReusableCell(
          withReuseIdentifier: HomeContainerPortfolioStatusCell.reuseIdentifier,
          for: indexPath
        ) as? HomeContainerPortfolioStatusCell
        cell?.apply(
          text: portfolioEmptyText,
          backgroundColor: portfolioBackgroundColor,
          textColor: portfolioSecondaryTextColor,
          surfaceColor: portfolioSurfaceColor
        )
        return cell
      }
    }

    dataSource?.supplementaryViewProvider = {
      [weak self] collectionView, kind, indexPath in
      guard let self, kind == UICollectionView.elementKindSectionHeader else {
        return nil
      }
      let view = collectionView.dequeueReusableSupplementaryView(
        ofKind: kind,
        withReuseIdentifier: HomeContainerTabHeaderView.reuseIdentifier,
        for: indexPath
      ) as? HomeContainerTabHeaderView
      view?.apply(
        title: tabTitle,
        backgroundColor: portfolioBackgroundColor,
        textColor: portfolioPrimaryTextColor
      )
      return view
    }
  }

  private func applyPortfolioSnapshot(animatingDifferences: Bool) {
    guard let dataSource else { return }
    var snapshot = NSDiffableDataSourceSnapshot<Section, Item>()
    snapshot.appendSections([.portfolio])
    guard let portfolio = currentState?.portfolio else {
      dataSource.apply(snapshot, animatingDifferences: false)
      return
    }

    var items: [Item] = [.title]
    switch portfolio.state {
    case .initialloading:
      items.append(contentsOf: (0..<4).map(Item.loading))
    case .empty:
      items.append(.empty)
    case .ready:
      var seenIds = Set<String>()
      let allIds = portfolio.items.map(\.id).filter { seenIds.insert($0).inserted }
      let hasOverflow = allIds.count > portfolioInitialVisibleItemCount
      let visibleIds = showsAllPortfolioItems
        ? allIds
        : Array(allIds.prefix(portfolioInitialVisibleItemCount))
      items.append(contentsOf: visibleIds.map(Item.token))
      if showsAllPortfolioItems || !hasOverflow {
        if portfolio.lowValueAssets.visible {
          items.append(.lowValueAssets)
        }
        if portfolio.riskAssets.visible {
          items.append(.riskAssets)
        }
        if portfolio.manageTokens.visible {
          items.append(.manageTokens)
        }
      }
      if hasOverflow {
        items.append(.toggle(showsAllPortfolioItems))
      }
    }
    snapshot.appendItems(items, toSection: .portfolio)

    let previousItems = Set(dataSource.snapshot().itemIdentifiers)
    let reloadItems = items.filter(previousItems.contains)
    if !reloadItems.isEmpty {
      snapshot.reloadItems(reloadItems)
    }
    dataSource.apply(snapshot, animatingDifferences: animatingDifferences)
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
    onIntent?(
      INativeHomeIntent(
        owner: owner,
        headerActionId: actionId,
        portfolioItemId: nil,
        portfolioActionId: nil,
        portfolioActionValue: nil
      )
    )
  }

  private func emitPortfolioItem(_ itemId: String) {
    guard let owner = currentState?.owner else { return }
    onIntent?(
      INativeHomeIntent(
        owner: owner,
        headerActionId: nil,
        portfolioItemId: itemId,
        portfolioActionId: nil,
        portfolioActionValue: nil
      )
    )
  }

  private func emitPortfolioAction(
    _ actionId: NativeHomePortfolioActionId,
    value: Bool? = nil
  ) {
    guard let owner = currentState?.owner else { return }
    onIntent?(
      INativeHomeIntent(
        owner: owner,
        headerActionId: nil,
        portfolioItemId: nil,
        portfolioActionId: actionId,
        portfolioActionValue: value
      )
    )
  }
}

extension HomeContainerView: UICollectionViewDelegateFlowLayout {
  func collectionView(
    _ collectionView: UICollectionView,
    layout collectionViewLayout: UICollectionViewLayout,
    sizeForItemAt indexPath: IndexPath
  ) -> CGSize {
    guard let item = dataSource?.itemIdentifier(for: indexPath) else {
      return CGSize(width: collectionView.bounds.width, height: 56)
    }
    let height: CGFloat = switch item {
    case .title: 56
    case .token, .loading: 60
    case .lowValueAssets, .riskAssets: 56
    case .manageTokens: 60
    case let .toggle(isExpanded): isExpanded ? 70 : 50
    case .empty: 240
    }
    return CGSize(width: collectionView.bounds.width, height: height)
  }

  func collectionView(
    _ collectionView: UICollectionView,
    layout collectionViewLayout: UICollectionViewLayout,
    referenceSizeForHeaderInSection section: Int
  ) -> CGSize {
    CGSize(width: collectionView.bounds.width, height: 52)
  }

  func collectionView(
    _ collectionView: UICollectionView,
    didSelectItemAt indexPath: IndexPath
  ) {
    collectionView.deselectItem(at: indexPath, animated: false)
    guard let item = dataSource?.itemIdentifier(for: indexPath) else { return }
    switch item {
    case let .token(id):
      guard portfolioRows[id]?.enabled == true else { return }
      emitPortfolioItem(id)
    case .lowValueAssets:
      guard currentState?.portfolio.lowValueAssets.enabled == true else { return }
      emitPortfolioAction(.openlowvalueassets)
    case .riskAssets:
      guard currentState?.portfolio.riskAssets.enabled == true else { return }
      emitPortfolioAction(.openriskassets)
    case .title, .manageTokens, .toggle, .loading, .empty:
      break
    }
  }
}

private final class HomeContainerCollectionLayout: UICollectionViewFlowLayout {
  override func layoutAttributesForElements(
    in rect: CGRect
  ) -> [UICollectionViewLayoutAttributes]? {
    guard let collectionView,
          var attributes = super.layoutAttributesForElements(in: rect)?.compactMap({
            $0.copy() as? UICollectionViewLayoutAttributes
          })
    else {
      return super.layoutAttributesForElements(in: rect)
    }
    if !attributes.contains(where: {
      $0.representedElementKind == UICollectionView.elementKindSectionHeader
    }),
      let header = super.layoutAttributesForSupplementaryView(
        ofKind: UICollectionView.elementKindSectionHeader,
        at: IndexPath(item: 0, section: 0)
      )?.copy() as? UICollectionViewLayoutAttributes
    {
      attributes.append(header)
    }
    for attribute in attributes
      where attribute.representedElementKind == UICollectionView.elementKindSectionHeader {
      attribute.frame.origin.y = max(attribute.frame.origin.y, collectionView.contentOffset.y)
      attribute.zIndex = 100
    }
    return attributes
  }

  override func layoutAttributesForSupplementaryView(
    ofKind elementKind: String,
    at indexPath: IndexPath
  ) -> UICollectionViewLayoutAttributes? {
    guard let attributes = super.layoutAttributesForSupplementaryView(
      ofKind: elementKind,
      at: indexPath
    )?.copy() as? UICollectionViewLayoutAttributes else {
      return nil
    }
    if elementKind == UICollectionView.elementKindSectionHeader,
       let collectionView {
      attributes.frame.origin.y = max(
        attributes.frame.origin.y,
        collectionView.contentOffset.y
      )
      attributes.zIndex = 100
    }
    return attributes
  }

  override func shouldInvalidateLayout(forBoundsChange newBounds: CGRect) -> Bool {
    true
  }
}

private final class HomeContainerTabHeaderView: UICollectionReusableView {
  static let reuseIdentifier = "HomeContainerTabHeaderView"
  private let titleLabel = UILabel()

  override init(frame: CGRect) {
    super.init(frame: frame)
    titleLabel.font = HomeContainerTypography.semibold(18)
    titleLabel.adjustsFontForContentSizeCategory = false
    titleLabel.translatesAutoresizingMaskIntoConstraints = false
    addSubview(titleLabel)
    accessibilityIdentifier = "native-home-tab-portfolio"
    NSLayoutConstraint.activate([
      titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 20),
      titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -20),
      titleLabel.topAnchor.constraint(equalTo: topAnchor, constant: 14),
      titleLabel.heightAnchor.constraint(equalToConstant: 24),
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func apply(title: String, backgroundColor: UIColor, textColor: UIColor) {
    self.backgroundColor = backgroundColor
    titleLabel.text = title
    titleLabel.textColor = textColor
  }
}

private final class HomeContainerPortfolioTitleCell: UICollectionViewCell {
  static let reuseIdentifier = "HomeContainerPortfolioTitleCell"
  private let titleLabel = UILabel()
  private let filterLabel = UILabel()
  private let filterSwitchHost = UIView()
  private let filterSwitch = UIControl()
  private let filterSwitchThumb = UIView()
  private let filterLoading = UIActivityIndicatorView(style: .medium)
  private var filterSwitchThumbLeadingConstraint: NSLayoutConstraint?
  private var filterSelected = false
  private var onFilterChange: ((Bool) -> Void)?

  override init(frame: CGRect) {
    super.init(frame: frame)
    titleLabel.font = HomeContainerTypography.semibold(20)
    titleLabel.adjustsFontForContentSizeCategory = false
    titleLabel.translatesAutoresizingMaskIntoConstraints = false
    contentView.addSubview(titleLabel)

    filterLabel.font = HomeContainerTypography.regular(12)
    filterLabel.adjustsFontForContentSizeCategory = false
    filterLabel.translatesAutoresizingMaskIntoConstraints = false
    contentView.addSubview(filterLabel)

    filterSwitchHost.translatesAutoresizingMaskIntoConstraints = false
    contentView.addSubview(filterSwitchHost)
    filterSwitch.layer.cornerRadius = 10
    filterSwitch.clipsToBounds = true
    filterSwitch.translatesAutoresizingMaskIntoConstraints = false
    filterSwitch.addTarget(self, action: #selector(handleFilterChange), for: .touchUpInside)
    filterSwitch.accessibilityIdentifier = "native-home-defi-token-switch"
    filterSwitch.isAccessibilityElement = true
    filterSwitchHost.addSubview(filterSwitch)

    filterSwitchThumb.layer.cornerRadius = 8
    filterSwitchThumb.isUserInteractionEnabled = false
    filterSwitchThumb.translatesAutoresizingMaskIntoConstraints = false
    filterSwitch.addSubview(filterSwitchThumb)

    filterLoading.hidesWhenStopped = true
    filterLoading.transform = CGAffineTransform(scaleX: 0.55, y: 0.55)
    filterLoading.translatesAutoresizingMaskIntoConstraints = false
    filterSwitchThumb.addSubview(filterLoading)

    let filterSwitchThumbLeadingConstraint = filterSwitchThumb.leadingAnchor.constraint(
      equalTo: filterSwitch.leadingAnchor,
      constant: 2
    )
    self.filterSwitchThumbLeadingConstraint = filterSwitchThumbLeadingConstraint

    NSLayoutConstraint.activate([
      titleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
      titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: filterLabel.leadingAnchor, constant: -12),
      titleLabel.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
      titleLabel.heightAnchor.constraint(equalToConstant: 28),
      filterSwitchHost.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
      filterSwitchHost.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
      filterSwitchHost.widthAnchor.constraint(equalToConstant: 32),
      filterSwitchHost.heightAnchor.constraint(equalToConstant: 20),
      filterSwitch.leadingAnchor.constraint(equalTo: filterSwitchHost.leadingAnchor),
      filterSwitch.trailingAnchor.constraint(equalTo: filterSwitchHost.trailingAnchor),
      filterSwitch.topAnchor.constraint(equalTo: filterSwitchHost.topAnchor),
      filterSwitch.bottomAnchor.constraint(equalTo: filterSwitchHost.bottomAnchor),
      filterSwitchThumbLeadingConstraint,
      filterSwitchThumb.centerYAnchor.constraint(equalTo: filterSwitch.centerYAnchor),
      filterSwitchThumb.widthAnchor.constraint(equalToConstant: 16),
      filterSwitchThumb.heightAnchor.constraint(equalToConstant: 16),
      filterLoading.centerXAnchor.constraint(equalTo: filterSwitchThumb.centerXAnchor),
      filterLoading.centerYAnchor.constraint(equalTo: filterSwitchThumb.centerYAnchor),
      filterLabel.trailingAnchor.constraint(equalTo: filterSwitchHost.leadingAnchor, constant: -8),
      filterLabel.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func prepareForReuse() {
    super.prepareForReuse()
    onFilterChange = nil
  }

  func apply(
    title: String,
    filter: INativeHomePortfolioDeFiTokensViewModel?,
    backgroundColor: UIColor,
    primaryTextColor: UIColor,
    secondaryTextColor: UIColor,
    disabledTextColor: UIColor,
    switchOffColor: UIColor,
    switchThumbColor: UIColor,
    onFilterChange: @escaping (Bool) -> Void
  ) {
    contentView.backgroundColor = backgroundColor
    titleLabel.text = title
    titleLabel.textColor = primaryTextColor
    filterLabel.text = filter?.title
    filterLabel.textColor = filter?.enabled == true && filter?.loading != true
      ? secondaryTextColor
      : disabledTextColor
    filterLabel.isHidden = filter?.visible != true
    filterSwitchHost.isHidden = filter?.visible != true
    filterSelected = filter?.selected == true
    filterSwitch.isEnabled = filter?.enabled == true
    filterSwitch.alpha = filter?.enabled == true && filter?.loading != true ? 1 : 0.5
    filterSwitch.backgroundColor = filterSelected ? primaryTextColor : switchOffColor
    filterSwitchThumb.backgroundColor = switchThumbColor
    filterSwitchThumbLeadingConstraint?.constant = filterSelected ? 14 : 2
    filterSwitch.accessibilityValue = filterSelected ? "1" : "0"
    filterSwitch.accessibilityTraits = filterSelected ? [.button, .selected] : .button
    if filter?.loading == true {
      filterLoading.startAnimating()
    } else {
      filterLoading.stopAnimating()
    }
    self.onFilterChange = onFilterChange
  }

  @objc
  private func handleFilterChange() {
    filterSelected.toggle()
    filterSwitchThumbLeadingConstraint?.constant = filterSelected ? 14 : 2
    filterSwitch.accessibilityValue = filterSelected ? "1" : "0"
    filterSwitch.accessibilityTraits = filterSelected ? [.button, .selected] : .button
    UIView.animate(withDuration: 0.2) {
      self.filterSwitch.layoutIfNeeded()
    }
    onFilterChange?(filterSelected)
  }
}

private final class HomeContainerPortfolioTokenCell: UICollectionViewCell {
  static let reuseIdentifier = "HomeContainerPortfolioTokenCell"

  private let highlightView = UIView()
  private let tokenImageView = UIImageView()
  private let networkImageView = UIImageView()
  private let titleLabel = UILabel()
  private let priceLabel = UILabel()
  private let priceChangeLabel = UILabel()
  private let balanceLabel = UILabel()
  private let valueLabel = UILabel()
  private let leadingSkeleton = UIView()
  private let trailingTopSkeleton = UIView()
  private let trailingBottomSkeleton = UIView()
  private var tokenImageTask: URLSessionDataTask?
  private var networkImageTask: URLSessionDataTask?
  private var representedId = ""
  private var activeColor = UIColor.systemGray5
  private var isInteractive = false

  override var isHighlighted: Bool {
    didSet {
      updateHighlight()
    }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)

    highlightView.layer.cornerRadius = 12
    highlightView.layer.cornerCurve = .continuous
    highlightView.isHidden = true
    highlightView.isUserInteractionEnabled = false
    highlightView.translatesAutoresizingMaskIntoConstraints = false
    contentView.addSubview(highlightView)

    tokenImageView.contentMode = .scaleAspectFill
    tokenImageView.clipsToBounds = true
    tokenImageView.layer.cornerRadius = 20
    tokenImageView.translatesAutoresizingMaskIntoConstraints = false
    contentView.addSubview(tokenImageView)

    networkImageView.contentMode = .scaleAspectFill
    networkImageView.clipsToBounds = true
    networkImageView.layer.cornerRadius = 8
    networkImageView.layer.borderWidth = 2
    networkImageView.translatesAutoresizingMaskIntoConstraints = false
    contentView.addSubview(networkImageView)

    titleLabel.font = HomeContainerTypography.medium(16)
    titleLabel.adjustsFontForContentSizeCategory = false
    titleLabel.lineBreakMode = .byTruncatingTail
    titleLabel.translatesAutoresizingMaskIntoConstraints = false
    contentView.addSubview(titleLabel)

    for label in [priceLabel, priceChangeLabel, valueLabel] {
      label.font = HomeContainerTypography.regular(14)
      label.adjustsFontForContentSizeCategory = false
      label.lineBreakMode = .byTruncatingTail
      label.translatesAutoresizingMaskIntoConstraints = false
      contentView.addSubview(label)
    }
    balanceLabel.font = HomeContainerTypography.medium(16)
    balanceLabel.adjustsFontForContentSizeCategory = false
    balanceLabel.textAlignment = .right
    balanceLabel.lineBreakMode = .byTruncatingHead
    balanceLabel.translatesAutoresizingMaskIntoConstraints = false
    contentView.addSubview(balanceLabel)
    valueLabel.textAlignment = .right

    balanceLabel.setContentCompressionResistancePriority(.required, for: .horizontal)
    valueLabel.setContentCompressionResistancePriority(.required, for: .horizontal)
    priceChangeLabel.setContentCompressionResistancePriority(.defaultHigh, for: .horizontal)

    for skeleton in [leadingSkeleton, trailingTopSkeleton, trailingBottomSkeleton] {
      skeleton.layer.cornerRadius = 5
      skeleton.translatesAutoresizingMaskIntoConstraints = false
      contentView.addSubview(skeleton)
    }

    NSLayoutConstraint.activate([
      highlightView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 8),
      highlightView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -8),
      highlightView.topAnchor.constraint(equalTo: contentView.topAnchor),
      highlightView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
      tokenImageView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
      tokenImageView.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
      tokenImageView.widthAnchor.constraint(equalToConstant: 40),
      tokenImageView.heightAnchor.constraint(equalToConstant: 40),
      networkImageView.trailingAnchor.constraint(equalTo: tokenImageView.trailingAnchor, constant: 2),
      networkImageView.bottomAnchor.constraint(equalTo: tokenImageView.bottomAnchor, constant: 2),
      networkImageView.widthAnchor.constraint(equalToConstant: 16),
      networkImageView.heightAnchor.constraint(equalToConstant: 16),
      titleLabel.leadingAnchor.constraint(equalTo: tokenImageView.trailingAnchor, constant: 12),
      titleLabel.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 8),
      titleLabel.heightAnchor.constraint(equalToConstant: 24),
      titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: balanceLabel.leadingAnchor, constant: -12),
      priceLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
      priceLabel.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 32),
      priceLabel.heightAnchor.constraint(equalToConstant: 20),
      priceChangeLabel.leadingAnchor.constraint(equalTo: priceLabel.trailingAnchor, constant: 4),
      priceChangeLabel.topAnchor.constraint(equalTo: priceLabel.topAnchor),
      priceChangeLabel.heightAnchor.constraint(equalTo: priceLabel.heightAnchor),
      priceChangeLabel.trailingAnchor.constraint(lessThanOrEqualTo: valueLabel.leadingAnchor, constant: -12),
      balanceLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
      balanceLabel.topAnchor.constraint(equalTo: titleLabel.topAnchor),
      balanceLabel.heightAnchor.constraint(equalTo: titleLabel.heightAnchor),
      balanceLabel.leadingAnchor.constraint(greaterThanOrEqualTo: contentView.centerXAnchor),
      valueLabel.trailingAnchor.constraint(equalTo: balanceLabel.trailingAnchor),
      valueLabel.topAnchor.constraint(equalTo: priceLabel.topAnchor),
      valueLabel.heightAnchor.constraint(equalTo: priceLabel.heightAnchor),
      valueLabel.leadingAnchor.constraint(greaterThanOrEqualTo: contentView.centerXAnchor),
      leadingSkeleton.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
      leadingSkeleton.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 37),
      leadingSkeleton.widthAnchor.constraint(equalToConstant: 88),
      leadingSkeleton.heightAnchor.constraint(equalToConstant: 10),
      trailingTopSkeleton.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
      trailingTopSkeleton.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 10),
      trailingTopSkeleton.widthAnchor.constraint(equalToConstant: 72),
      trailingTopSkeleton.heightAnchor.constraint(equalToConstant: 12),
      trailingBottomSkeleton.trailingAnchor.constraint(equalTo: trailingTopSkeleton.trailingAnchor),
      trailingBottomSkeleton.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 37),
      trailingBottomSkeleton.widthAnchor.constraint(equalToConstant: 52),
      trailingBottomSkeleton.heightAnchor.constraint(equalToConstant: 10),
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func prepareForReuse() {
    super.prepareForReuse()
    representedId = ""
    tokenImageTask?.cancel()
    networkImageTask?.cancel()
    tokenImageTask = nil
    networkImageTask = nil
    tokenImageView.image = nil
    networkImageView.image = nil
    isInteractive = false
    updateHighlight()
  }

  func apply(
    id: String,
    symbol: String,
    iconURL: String,
    networkIconURL: String,
    priceText: String,
    priceChangeText: String,
    priceChangeDirection: NativeHomePriceChangeDirection,
    balanceText: String,
    valueText: String,
    valuationState: NativeHomePortfolioValuationState,
    enabled: Bool,
    backgroundColor: UIColor,
    surfaceColor: UIColor,
    activeColor: UIColor,
    primaryTextColor: UIColor,
    secondaryTextColor: UIColor,
    successTextColor: UIColor,
    criticalTextColor: UIColor
  ) {
    representedId = id
    contentView.backgroundColor = backgroundColor
    self.activeColor = activeColor
    isInteractive = enabled
    updateHighlight()
    tokenImageView.backgroundColor = surfaceColor
    networkImageView.backgroundColor = backgroundColor
    networkImageView.layer.borderColor = backgroundColor.cgColor
    titleLabel.text = symbol
    titleLabel.textColor = primaryTextColor
    priceLabel.text = priceText
    priceLabel.textColor = secondaryTextColor
    priceChangeLabel.text = priceChangeText
    priceChangeLabel.textColor = switch priceChangeDirection {
    case .positive: successTextColor
    case .negative: criticalTextColor
    case .neutral: secondaryTextColor
    }
    balanceLabel.text = balanceText
    balanceLabel.textColor = primaryTextColor
    valueLabel.text = valueText
    valueLabel.textColor = secondaryTextColor
    leadingSkeleton.backgroundColor = surfaceColor
    trailingTopSkeleton.backgroundColor = surfaceColor
    trailingBottomSkeleton.backgroundColor = surfaceColor
    let showsValuation = valuationState == .ready
    priceLabel.isHidden = !showsValuation
    priceChangeLabel.isHidden = !showsValuation
    balanceLabel.isHidden = !showsValuation
    valueLabel.isHidden = !showsValuation
    leadingSkeleton.isHidden = showsValuation
    trailingTopSkeleton.isHidden = showsValuation
    trailingBottomSkeleton.isHidden = showsValuation
    alpha = enabled ? 1 : 0.4
    isUserInteractionEnabled = enabled
    accessibilityIdentifier = "native-home-portfolio-item-\(id)"
    accessibilityLabel = [symbol, priceText, priceChangeText, balanceText, valueText]
      .filter { !$0.isEmpty }
      .joined(separator: ", ")
    accessibilityTraits = enabled ? .button : .button.union(.notEnabled)
    loadImage(from: iconURL, representedId: id, imageView: tokenImageView, isNetwork: false)
    networkImageView.isHidden = networkIconURL.isEmpty
    if !networkIconURL.isEmpty {
      loadImage(
        from: networkIconURL,
        representedId: id,
        imageView: networkImageView,
        isNetwork: true
      )
    }
  }

  func applyLoading(backgroundColor: UIColor, surfaceColor: UIColor) {
    representedId = ""
    contentView.backgroundColor = backgroundColor
    isInteractive = false
    updateHighlight()
    tokenImageView.image = nil
    tokenImageView.backgroundColor = surfaceColor
    networkImageView.isHidden = true
    titleLabel.text = ""
    priceLabel.text = ""
    priceChangeLabel.text = ""
    balanceLabel.text = ""
    valueLabel.text = ""
    priceLabel.isHidden = true
    priceChangeLabel.isHidden = true
    balanceLabel.isHidden = true
    valueLabel.isHidden = true
    leadingSkeleton.backgroundColor = surfaceColor
    trailingTopSkeleton.backgroundColor = surfaceColor
    trailingBottomSkeleton.backgroundColor = surfaceColor
    leadingSkeleton.isHidden = false
    trailingTopSkeleton.isHidden = false
    trailingBottomSkeleton.isHidden = false
    alpha = 1
    isUserInteractionEnabled = false
    accessibilityIdentifier = nil
  }

  private func updateHighlight() {
    highlightView.backgroundColor = activeColor
    highlightView.isHidden = !isInteractive || !isHighlighted
  }

  private func loadImage(
    from urlString: String,
    representedId: String,
    imageView: UIImageView,
    isNetwork: Bool
  ) {
    guard let url = URL(string: urlString),
          let scheme = url.scheme?.lowercased(),
          scheme == "https" || scheme == "http"
    else {
      return
    }
    let task = URLSession.shared.dataTask(with: url) { [weak self, weak imageView] data, _, _ in
      guard let self,
            self.representedId == representedId,
            let data,
            let image = UIImage(data: data)
      else {
        return
      }
      DispatchQueue.main.async {
        guard self.representedId == representedId else { return }
        imageView?.image = image
      }
    }
    if isNetwork {
      networkImageTask?.cancel()
      networkImageTask = task
    } else {
      tokenImageTask?.cancel()
      tokenImageTask = task
    }
    task.resume()
  }
}

private final class HomeContainerPortfolioFooterCell: UICollectionViewCell {
  static let reuseIdentifier = "HomeContainerPortfolioFooterCell"

  private let highlightView = UIView()
  private let iconHost = UIView()
  private let iconView = UIImageView()
  private let titleLabel = UILabel()
  private let valueLabel = UILabel()
  private var activeColor = UIColor.systemGray5
  private var isInteractive = false

  override var isHighlighted: Bool {
    didSet {
      updateHighlight()
    }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    highlightView.layer.cornerRadius = 12
    highlightView.layer.cornerCurve = .continuous
    highlightView.isHidden = true
    highlightView.isUserInteractionEnabled = false
    highlightView.translatesAutoresizingMaskIntoConstraints = false
    contentView.addSubview(highlightView)

    iconHost.layer.cornerRadius = 20
    iconHost.translatesAutoresizingMaskIntoConstraints = false
    contentView.addSubview(iconHost)

    iconView.contentMode = .center
    iconView.translatesAutoresizingMaskIntoConstraints = false
    iconHost.addSubview(iconView)

    titleLabel.font = HomeContainerTypography.medium(16)
    titleLabel.adjustsFontForContentSizeCategory = false
    titleLabel.lineBreakMode = .byTruncatingTail
    titleLabel.translatesAutoresizingMaskIntoConstraints = false
    contentView.addSubview(titleLabel)

    valueLabel.font = HomeContainerTypography.medium(16)
    valueLabel.adjustsFontForContentSizeCategory = false
    valueLabel.textAlignment = .right
    valueLabel.translatesAutoresizingMaskIntoConstraints = false
    contentView.addSubview(valueLabel)

    NSLayoutConstraint.activate([
      highlightView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 8),
      highlightView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -8),
      highlightView.topAnchor.constraint(equalTo: contentView.topAnchor),
      highlightView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
      iconHost.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
      iconHost.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
      iconHost.widthAnchor.constraint(equalToConstant: 40),
      iconHost.heightAnchor.constraint(equalToConstant: 40),
      iconView.leadingAnchor.constraint(equalTo: iconHost.leadingAnchor),
      iconView.trailingAnchor.constraint(equalTo: iconHost.trailingAnchor),
      iconView.topAnchor.constraint(equalTo: iconHost.topAnchor),
      iconView.bottomAnchor.constraint(equalTo: iconHost.bottomAnchor),
      titleLabel.leadingAnchor.constraint(equalTo: iconHost.trailingAnchor, constant: 12),
      titleLabel.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
      titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: valueLabel.leadingAnchor, constant: -12),
      valueLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
      valueLabel.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func apply(
    title: String,
    value: String,
    icon: UIImage,
    accessibilityIdentifier: String,
    enabled: Bool,
    backgroundColor: UIColor,
    surfaceColor: UIColor,
    activeColor: UIColor,
    primaryTextColor: UIColor,
    secondaryTextColor: UIColor
  ) {
    contentView.backgroundColor = backgroundColor
    self.activeColor = activeColor
    isInteractive = enabled
    isUserInteractionEnabled = enabled
    updateHighlight()
    contentView.alpha = enabled ? 1 : 0.45
    contentView.accessibilityIdentifier = accessibilityIdentifier
    iconHost.backgroundColor = surfaceColor
    iconView.image = icon
    iconView.tintColor = secondaryTextColor
    titleLabel.text = title
    titleLabel.textColor = primaryTextColor
    valueLabel.text = value
    valueLabel.textColor = primaryTextColor
  }

  private func updateHighlight() {
    highlightView.backgroundColor = activeColor
    highlightView.isHidden = !isInteractive || !isHighlighted
  }
}

private final class HomeContainerPortfolioManageTokensCell: UICollectionViewCell {
  static let reuseIdentifier = "HomeContainerPortfolioManageTokensCell"

  private let stack = UIStackView()
  private let instructionLabel = UILabel()
  private let actionButton = UIButton(type: .system)
  private var onPress: (() -> Void)?

  override init(frame: CGRect) {
    super.init(frame: frame)
    stack.axis = .horizontal
    stack.alignment = .center
    stack.spacing = 10
    stack.translatesAutoresizingMaskIntoConstraints = false
    contentView.addSubview(stack)

    instructionLabel.font = HomeContainerTypography.regular(14)
    instructionLabel.adjustsFontForContentSizeCategory = false
    instructionLabel.textAlignment = .center
    instructionLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
    stack.addArrangedSubview(instructionLabel)

    actionButton.titleLabel?.font = HomeContainerTypography.regular(14)
    actionButton.titleLabel?.adjustsFontForContentSizeCategory = false
    actionButton.accessibilityIdentifier = "native-home-manage-tokens"
    actionButton.addTarget(self, action: #selector(handlePress), for: .touchUpInside)
    stack.addArrangedSubview(actionButton)

    NSLayoutConstraint.activate([
      stack.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
      stack.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
      stack.leadingAnchor.constraint(greaterThanOrEqualTo: contentView.leadingAnchor, constant: 20),
      stack.trailingAnchor.constraint(lessThanOrEqualTo: contentView.trailingAnchor, constant: -20),
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func prepareForReuse() {
    super.prepareForReuse()
    onPress = nil
  }

  func apply(
    instruction: String,
    actionTitle: String,
    enabled: Bool,
    backgroundColor: UIColor,
    disabledTextColor: UIColor,
    actionTextColor: UIColor,
    onPress: @escaping () -> Void
  ) {
    contentView.backgroundColor = backgroundColor
    instructionLabel.text = instruction
    instructionLabel.textColor = disabledTextColor
    actionButton.setTitle("\(actionTitle) →", for: .normal)
    actionButton.setTitleColor(actionTextColor, for: .normal)
    actionButton.isEnabled = enabled
    self.onPress = onPress
  }

  @objc
  private func handlePress() {
    onPress?()
  }
}

private final class HomeContainerPortfolioToggleCell: UICollectionViewCell {
  static let reuseIdentifier = "HomeContainerPortfolioToggleCell"

  private let button = UIButton(type: .custom)
  private var onPress: (() -> Void)?
  private var normalBackgroundColor = UIColor.secondarySystemBackground
  private var activeBackgroundColor = UIColor.tertiarySystemBackground

  override init(frame: CGRect) {
    super.init(frame: frame)
    button.titleLabel?.font = HomeContainerTypography.medium(16)
    button.titleLabel?.adjustsFontForContentSizeCategory = false
    button.layer.cornerRadius = 18
    button.translatesAutoresizingMaskIntoConstraints = false
    button.addTarget(self, action: #selector(handlePress), for: .touchUpInside)
    button.addTarget(self, action: #selector(handleTouchDown), for: .touchDown)
    button.addTarget(
      self,
      action: #selector(handleTouchUp),
      for: [.touchCancel, .touchDragExit, .touchUpInside, .touchUpOutside]
    )
    contentView.addSubview(button)
    NSLayoutConstraint.activate([
      button.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 12),
      button.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
      button.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
      button.heightAnchor.constraint(equalToConstant: 36),
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func prepareForReuse() {
    super.prepareForReuse()
    onPress = nil
  }

  func apply(
    title: String,
    isExpanded: Bool,
    backgroundColor: UIColor,
    surfaceColor: UIColor,
    activeSurfaceColor: UIColor,
    textColor: UIColor,
    onPress: @escaping () -> Void
  ) {
    contentView.backgroundColor = backgroundColor
    normalBackgroundColor = surfaceColor
    activeBackgroundColor = activeSurfaceColor
    button.backgroundColor = surfaceColor
    button.setTitle(title, for: .normal)
    button.setTitleColor(textColor, for: .normal)
    button.accessibilityIdentifier = isExpanded
      ? "native-home-token-list-show-less"
      : "native-home-token-list-show-more"
    self.onPress = onPress
  }

  @objc
  private func handleTouchDown() {
    button.backgroundColor = activeBackgroundColor
  }

  @objc
  private func handleTouchUp() {
    button.backgroundColor = normalBackgroundColor
  }

  @objc
  private func handlePress() {
    onPress?()
  }
}

private final class HomeContainerPortfolioStatusCell: UICollectionViewCell {
  static let reuseIdentifier = "HomeContainerPortfolioStatusCell"
  private let iconHost = UIView()
  private let iconLabel = UILabel()
  private let messageLabel = UILabel()

  override init(frame: CGRect) {
    super.init(frame: frame)
    iconHost.layer.cornerRadius = 28
    iconHost.translatesAutoresizingMaskIntoConstraints = false
    contentView.addSubview(iconHost)

    iconLabel.text = "?"
    iconLabel.font = HomeContainerTypography.semibold(24)
    iconLabel.textAlignment = .center
    iconLabel.translatesAutoresizingMaskIntoConstraints = false
    iconHost.addSubview(iconLabel)

    messageLabel.font = HomeContainerTypography.medium(16)
    messageLabel.textAlignment = .center
    messageLabel.numberOfLines = 2
    messageLabel.translatesAutoresizingMaskIntoConstraints = false
    contentView.addSubview(messageLabel)

    NSLayoutConstraint.activate([
      iconHost.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
      iconHost.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 44),
      iconHost.widthAnchor.constraint(equalToConstant: 56),
      iconHost.heightAnchor.constraint(equalToConstant: 56),
      iconLabel.centerXAnchor.constraint(equalTo: iconHost.centerXAnchor),
      iconLabel.centerYAnchor.constraint(equalTo: iconHost.centerYAnchor),
      messageLabel.topAnchor.constraint(equalTo: iconHost.bottomAnchor, constant: 16),
      messageLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 32),
      messageLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -32),
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func apply(
    text: String,
    backgroundColor: UIColor,
    textColor: UIColor,
    surfaceColor: UIColor
  ) {
    contentView.backgroundColor = backgroundColor
    iconHost.backgroundColor = surfaceColor
    iconLabel.textColor = textColor
    messageLabel.text = text
    messageLabel.textColor = textColor
    accessibilityIdentifier = "native-home-portfolio-empty"
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
