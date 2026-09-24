import Charts
import ImageIO
import StoreKit
import SwiftUI
import UIKit

private enum AppClipMarketFilterSheet: Equatable {
  case network
  case timeRange
}

struct AppClipRootView: View {
  @ObservedObject var model: AppClipModel
  @State private var selectedCandleID: AppClipCandle.ID?
  @State private var activeMarketFilterSheet: AppClipMarketFilterSheet?
  @State private var networkSearchText = ""
  @FocusState private var isNetworkSearchFocused: Bool
  private let overlayPresenter = AppInstallOverlayPresenter.shared

  var body: some View {
    ZStack {
      Group {
        switch model.screen {
        case .market:
          marketList
        case .detail(let detail):
          marketDetail(detail)
        case .web(let url):
          webExperience(url)
        }
      }
      if let activeMarketFilterSheet {
        marketFilterOverlay(activeMarketFilterSheet)
          .transition(.opacity)
          .zIndex(1)
      }
    }
    .background(Color.appClipBackground.ignoresSafeArea())
    .onAppear {
      model.start()
    }
  }

  private var marketList: some View {
    VStack(spacing: 0) {
      marketHeader
      marketTabBar
      TabView(
        selection: Binding(
          get: { model.selectedMarketTab },
          set: { model.selectMarketTab($0) }
        )
      ) {
        stockPage
          .tag(AppClipMarketTab.stocks)
        perpsPage
          .tag(AppClipMarketTab.perps)
        trendingPage
          .tag(AppClipMarketTab.trending)
      }
      .tabViewStyle(.page(indexDisplayMode: .never))
      .indexViewStyle(.page(backgroundDisplayMode: .never))
      installFooter(asset: nil)
    }
  }

  private var marketTabBar: some View {
    HStack(spacing: 8) {
      marketTabButton(.stocks, title: String(localized: "market.tab.stocks"))
      marketTabButton(.perps, title: String(localized: "market.tab.perps"))
      marketTabButton(.trending, title: String(localized: "market.tab.trending"))
      Spacer(minLength: 0)
    }
    .frame(height: 44)
    .padding(.horizontal, 20)
  }

  private func marketTabButton(_ tab: AppClipMarketTab, title: String) -> some View {
    let isSelected = model.selectedMarketTab == tab
    return Button {
      model.selectMarketTab(tab)
    } label: {
      Text(title)
        .font(.system(size: 16, weight: .medium))
        .foregroundColor(isSelected ? .primary : .appClipSecondaryText)
        .padding(.horizontal, 4)
        .frame(height: 44)
        .overlay(alignment: .bottom) {
          Rectangle()
            .fill(isSelected ? Color.primary : .clear)
            .frame(height: 2)
        }
    }
    .buttonStyle(.plain)
    .accessibilityIdentifier("app-clip-market-tab-\(tab.rawValue)")
  }

  private var stockPage: some View {
    let state = model.stockState
    return VStack(spacing: 0) {
      marketCategorySelector(
        categories: resolvedStockCategories,
        selectedId: model.selectedStockCategoryId,
        accessibilityPrefix: "app-clip-stock-category",
        action: model.selectStockCategory
      )
      marketColumnHeader
      ScrollView {
        LazyVStack(spacing: 0) {
          if state.items.isEmpty {
            marketPageState(
              isLoading: state.isLoading,
              didLoad: state.didLoad,
              failed: state.failed
            ) {
              Task { await model.refreshMarkets(force: true) }
            }
          } else {
            ForEach(state.items) { stock in
              Button {
                selectedCandleID = nil
                model.select(stock)
              } label: {
                MarketStockRow(stock: stock)
              }
              .buttonStyle(AppClipMarketRowButtonStyle())
              .accessibilityIdentifier("app-clip-stock-\(stock.id)")
              .onAppear {
                if stock.id == state.items.last?.id {
                  model.loadMoreStocks()
                }
              }
            }
            stockLoadMoreState(state)
          }
        }
      }
      .refreshable {
        await model.refreshMarkets(force: true)
      }
    }
  }

  private var perpsPage: some View {
    let state = model.perpsState
    return VStack(spacing: 0) {
      marketCategorySelector(
        categories: resolvedPerpsCategories,
        selectedId: model.selectedPerpsCategoryId,
        accessibilityPrefix: "app-clip-perps-category",
        action: model.selectPerpsCategory
      )
      marketColumnHeader
      ScrollView {
        LazyVStack(spacing: 0) {
          if state.items.isEmpty {
            marketPageState(
              isLoading: state.isLoading,
              didLoad: state.didLoad,
              failed: state.failed
            ) {
              Task { await model.refreshMarkets(force: true) }
            }
          } else {
            ForEach(state.items) { perp in
              Button {
                selectedCandleID = nil
                model.select(perp)
              } label: {
                MarketPerpsRow(perp: perp)
              }
              .buttonStyle(AppClipMarketRowButtonStyle())
              .accessibilityIdentifier("app-clip-perps-\(perp.id)")
            }
          }
        }
      }
      .refreshable {
        await model.refreshMarkets(force: true)
      }
    }
  }

  private var trendingPage: some View {
    let state = model.trendingState
    return VStack(spacing: 0) {
      trendingFilterBar
      marketColumnHeader
      ScrollView {
        LazyVStack(spacing: 0) {
          if state.items.isEmpty {
            marketPageState(
              isLoading: state.isLoading,
              didLoad: state.didLoad,
              failed: state.failed
            ) {
              Task { await model.refreshMarkets(force: true) }
            }
          } else {
            ForEach(state.items) { asset in
              Button {
                selectedCandleID = nil
                model.select(asset)
              } label: {
                MarketAssetRow(asset: asset)
              }
              .buttonStyle(AppClipMarketRowButtonStyle())
              .accessibilityIdentifier("app-clip-market-\(asset.id)")
            }
          }
        }
      }
      .refreshable {
        await model.refreshMarkets(force: true)
      }
    }
  }

  private var marketHeader: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(String(localized: "market.title"))
        .font(.system(size: 28, weight: .bold))
        .foregroundColor(.primary)
      Text(marketStatusText)
        .font(.system(size: 16, weight: .regular))
        .foregroundColor(.appClipSecondaryText)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 20)
    .padding(.top, 18)
    .padding(.bottom, 18)
  }

  private func marketPageState(
    isLoading: Bool,
    didLoad: Bool,
    failed: Bool,
    retry: @escaping () -> Void
  ) -> some View {
    VStack(spacing: 14) {
      if isLoading || (!didLoad && !failed) {
        ProgressView()
        Text(String(localized: "market.refreshing"))
          .font(.subheadline)
          .foregroundColor(.appClipSecondaryText)
      } else {
        Image(
          systemName: failed && model.isNetworkAvailable == false
            ? "wifi.exclamationmark"
            : "chart.line.downtrend.xyaxis"
        )
          .font(.system(size: 28, weight: .medium))
          .foregroundColor(.appClipSecondaryText)
        Text(
          failed
            ? String(
              localized: model.isNetworkAvailable == false
                ? "market.no_network"
                : "market.unavailable"
            )
            : String(localized: "market.no_results")
        )
          .font(.subheadline)
          .foregroundColor(.appClipSecondaryText)
        retryButton(action: retry)
      }
    }
    .frame(maxWidth: .infinity)
    .frame(minHeight: 260)
  }

  @ViewBuilder
  private func stockLoadMoreState(
    _ state: AppClipMarketListState<AppClipMarketStock>
  ) -> some View {
    if state.isLoadingMore {
      ProgressView()
        .frame(maxWidth: .infinity)
        .frame(height: 52)
    } else if state.loadMoreFailed {
      retryButton {
        model.loadMoreStocks()
      }
      .frame(maxWidth: .infinity)
      .frame(height: 52)
    } else if state.nextCursor == nil, !state.items.isEmpty {
      Text(String(localized: "market.end"))
        .font(.system(size: 12))
        .foregroundColor(.appClipSecondaryText)
        .frame(maxWidth: .infinity)
        .frame(height: 36)
    }
  }

  private var resolvedStockCategories: [AppClipMarketCategory] {
    model.stockCategories.isEmpty
      ? [AppClipMarketCategory(id: "all", name: String(localized: "global.all"))]
      : model.stockCategories
  }

  private var resolvedPerpsCategories: [AppClipMarketCategory] {
    model.perpsCategories.isEmpty
      ? [AppClipMarketCategory(id: "crypto", name: String(localized: "market.crypto"))]
      : model.perpsCategories
  }

  private func marketCategorySelector(
    categories: [AppClipMarketCategory],
    selectedId: String,
    accessibilityPrefix: String,
    action: @escaping (String) -> Void
  ) -> some View {
    ScrollViewReader { proxy in
      ScrollView(.horizontal, showsIndicators: false) {
        HStack(spacing: 8) {
          ForEach(categories) { category in
            Button {
              action(category.id)
              withAnimation(.easeOut(duration: 0.2)) {
                proxy.scrollTo(category.id, anchor: .center)
              }
            } label: {
              Text(category.name)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(
                  category.id == selectedId ? .primary : .appClipSecondaryText
                )
                .padding(.horizontal, 10)
                .frame(height: 30)
                .background(
                  category.id == selectedId ? Color.appClipActive : .clear
                )
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .buttonStyle(.plain)
            .id(category.id)
            .accessibilityIdentifier("\(accessibilityPrefix)-\(category.id)")
          }
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 4)
      }
    }
    .frame(height: 42)
  }

  private var marketColumnHeader: some View {
    HStack(spacing: 8) {
      Text(String(localized: "market.column.name_turnover"))
        .frame(maxWidth: .infinity, alignment: .leading)
      Text(String(localized: "market.column.price"))
        .frame(maxWidth: .infinity, alignment: .trailing)
      Text(String(localized: "market.column.change"))
        .frame(width: 80, alignment: .trailing)
    }
    .font(.system(size: 12, weight: .medium))
    .foregroundColor(.appClipSecondaryText)
    .padding(.horizontal, 20)
    .frame(height: 32)
  }

  private var trendingFilterBar: some View {
    HStack {
      Button {
        presentMarketFilterSheet(.network)
      } label: {
        HStack(spacing: 4) {
          if let network = selectedNetwork, let logoURL = network.logoURL {
            RemoteImage(urls: [logoURL], fallbackSystemName: "link.circle.fill")
              .frame(width: 18, height: 18)
              .clipShape(Circle())
          } else {
            Image(systemName: "circle.grid.2x2.fill")
              .font(.system(size: 16))
          }
          Text(selectedNetwork?.name ?? String(localized: "global.all"))
            .font(.system(size: 14, weight: .medium))
          Image(systemName: "chevron.down")
            .font(.system(size: 10, weight: .semibold))
            .foregroundColor(.appClipSecondaryText)
        }
        .foregroundColor(.primary)
      }
      .buttonStyle(.plain)
      .accessibilityIdentifier("app-clip-market-network")

      Spacer()

      Button {
        presentMarketFilterSheet(.timeRange)
      } label: {
        HStack(spacing: 4) {
          Text(model.selectedTimeRange.rawValue)
            .font(.system(size: 14, weight: .medium))
          Image(systemName: "chevron.down")
            .font(.system(size: 10, weight: .semibold))
            .foregroundColor(.appClipSecondaryText)
        }
        .foregroundColor(.primary)
      }
      .buttonStyle(.plain)
      .accessibilityIdentifier("app-clip-market-time-range")
    }
    .padding(.horizontal, 20)
    .frame(height: 42)
  }

  private var selectedNetwork: AppClipMarketNetwork? {
    model.networks.first { $0.id == model.selectedNetworkId }
  }

  private var filteredNetworks: [AppClipMarketNetwork] {
    let query = networkSearchText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !query.isEmpty else {
      return model.networks
    }
    return model.networks.filter { network in
      network.name.range(
        of: query,
        options: [.caseInsensitive, .diacriticInsensitive]
      ) != nil
        || network.id.range(
          of: query,
          options: [.caseInsensitive, .diacriticInsensitive]
        ) != nil
    }
  }

  private var showsAllNetworksSearchResult: Bool {
    let query = networkSearchText.trimmingCharacters(in: .whitespacesAndNewlines)
    return query.isEmpty
      || String(localized: "global.all_networks").range(
        of: query,
        options: [.caseInsensitive, .diacriticInsensitive]
      ) != nil
  }

  private func presentMarketFilterSheet(_ sheet: AppClipMarketFilterSheet) {
    networkSearchText = ""
    isNetworkSearchFocused = false
    withAnimation(.easeOut(duration: 0.2)) {
      activeMarketFilterSheet = sheet
    }
  }

  private func dismissMarketFilterSheet() {
    isNetworkSearchFocused = false
    withAnimation(.easeOut(duration: 0.2)) {
      activeMarketFilterSheet = nil
    }
  }

  private func marketFilterOverlay(_ sheet: AppClipMarketFilterSheet) -> some View {
    GeometryReader { proxy in
      let keyboardIsReducingAvailableHeight = proxy.safeAreaInsets.bottom > 100
      let bottomMargin = keyboardIsReducingAvailableHeight
        ? 20
        : max(proxy.safeAreaInsets.bottom, 20)
      let topMargin = max(proxy.safeAreaInsets.top, 20)
      let maximumCardHeight = max(proxy.size.height - bottomMargin - topMargin - 20, 0)

      ZStack(alignment: .bottom) {
        Button {
          dismissMarketFilterSheet()
        } label: {
          Color.black.opacity(0.72)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(String(localized: "global.close"))
        .accessibilityIdentifier("app-clip-market-filter-dismiss")

        Group {
          switch sheet {
          case .network:
            marketFilterCard(
              accessibilityIdentifier: "app-clip-market-network-sheet"
            ) {
              networkFilterSheet
            }
            .frame(height: min(networkFilterSheetHeight, maximumCardHeight))
          case .timeRange:
            marketFilterCard(
              accessibilityIdentifier: "app-clip-market-time-range-sheet"
            ) {
              timeRangeFilterSheet
            }
          }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, bottomMargin)
        .transition(.move(edge: .bottom).combined(with: .opacity))
      }
    }
    .ignoresSafeArea(.container, edges: .all)
  }

  private func marketFilterCard<Content: View>(
    accessibilityIdentifier: String,
    @ViewBuilder content: () -> Content
  ) -> some View {
    content()
      .frame(maxWidth: .infinity)
      .background(Color.appClipPanel)
      .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
      .shadow(color: Color.black.opacity(0.18), radius: 18, y: 8)
      .accessibilityElement(children: .contain)
      .accessibilityAddTraits(.isModal)
      .accessibilityIdentifier(accessibilityIdentifier)
  }

  private var networkFilterSheetHeight: CGFloat {
    let rowCount = model.networks.count + 1
    let contentMaximumHeight: CGFloat = isNetworkSearchFocused ? 320 : 420
    let contentHeight = min(contentMaximumHeight, 92 + CGFloat(rowCount * 48))
    return 72 + contentHeight
  }

  private var networkFilterSheet: some View {
    VStack(spacing: 0) {
      HStack(spacing: 8) {
        Text(String(localized: "global.select_network"))
          .font(.system(size: 20, weight: .semibold))
          .foregroundColor(.primary)
          .frame(maxWidth: .infinity, alignment: .leading)
        Button {
          dismissMarketFilterSheet()
        } label: {
          Image(systemName: "xmark")
            .font(.system(size: 12, weight: .semibold))
            .foregroundColor(.appClipSecondaryText)
            .frame(width: 32, height: 32)
            .background(Color.appClipActive)
            .clipShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(String(localized: "global.close"))
        .accessibilityIdentifier("app-clip-market-network-close")
      }
      .padding(.horizontal, 20)
      .frame(height: 72)

      VStack(spacing: 0) {
        HStack(spacing: 8) {
          Image(systemName: "magnifyingglass")
            .font(.system(size: 17, weight: .medium))
            .foregroundColor(.appClipSecondaryText)
          TextField(
            String(localized: "global.search"),
            text: $networkSearchText
          )
          .font(.system(size: 16))
          .foregroundColor(.primary)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
          .submitLabel(.search)
          .focused($isNetworkSearchFocused)
          .accessibilityIdentifier("app-clip-market-network-search")
          if !networkSearchText.isEmpty {
            Button {
              networkSearchText = ""
            } label: {
              Image(systemName: "xmark.circle.fill")
                .font(.system(size: 16))
                .foregroundColor(.appClipSecondaryText)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("app-clip-market-network-search-clear")
          }
        }
        .padding(.horizontal, 12)
        .frame(height: 40)
        .background(Color.appClipActive)
        .clipShape(Capsule())
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 8)

        ScrollViewReader { proxy in
          ScrollView(showsIndicators: false) {
            LazyVStack(spacing: 0) {
              if showsAllNetworksSearchResult {
                networkFilterRow(
                  id: "all",
                  name: String(localized: "global.all_networks"),
                  logoURL: nil,
                  isSelected: model.selectedNetworkId.isEmpty
                ) {
                  model.selectNetwork("")
                  dismissMarketFilterSheet()
                }
              }
              ForEach(filteredNetworks) { network in
                networkFilterRow(
                  id: network.id,
                  name: network.name,
                  logoURL: network.logoURL,
                  isSelected: model.selectedNetworkId == network.id
                ) {
                  model.selectNetwork(network.id)
                  dismissMarketFilterSheet()
                }
              }
              if !showsAllNetworksSearchResult, filteredNetworks.isEmpty {
                Text(String(localized: "market.no_results"))
                  .font(.system(size: 14))
                  .foregroundColor(.appClipSecondaryText)
                  .frame(maxWidth: .infinity)
                  .frame(height: 96)
                  .accessibilityIdentifier("app-clip-market-network-no-results")
              }
            }
            .padding(.horizontal, 8)
            .padding(.bottom, 12)
          }
          .scrollDismissesKeyboard(.interactively)
          .onAppear {
            guard networkSearchText.isEmpty, !model.selectedNetworkId.isEmpty else {
              return
            }
            proxy.scrollTo(model.selectedNetworkId, anchor: .center)
          }
        }
      }
      .frame(maxHeight: .infinity)
    }
  }

  private func networkFilterRow(
    id: String,
    name: String,
    logoURL: URL?,
    isSelected: Bool,
    action: @escaping () -> Void
  ) -> some View {
    Button(action: action) {
      HStack(spacing: 12) {
        Group {
          if let logoURL {
            RemoteImage(urls: [logoURL], fallbackSystemName: "link.circle.fill")
              .clipShape(Circle())
          } else {
            Image(systemName: "circle.grid.2x2.fill")
              .font(.system(size: 28))
              .foregroundColor(.primary)
          }
        }
        .frame(width: 32, height: 32)
        Text(name)
          .font(.system(size: 16, weight: .medium))
          .foregroundColor(.primary)
          .lineLimit(1)
          .frame(maxWidth: .infinity, alignment: .leading)
        if isSelected {
          Image(systemName: "checkmark.circle.fill")
            .font(.system(size: 24, weight: .semibold))
            .foregroundColor(.primary)
            .accessibilityHidden(true)
        }
      }
      .padding(.horizontal, 12)
      .frame(height: 48)
      .contentShape(Rectangle())
    }
    .buttonStyle(AppClipMarketRowButtonStyle())
    .id(id)
    .accessibilityValue(isSelected ? String(localized: "global.selected") : "")
    .accessibilityIdentifier("app-clip-market-network-option-\(id)")
  }

  private var timeRangeFilterSheet: some View {
    VStack(spacing: 4) {
      ForEach(AppClipMarketTimeRange.allCases) { timeRange in
        let isSelected = model.selectedTimeRange == timeRange
        Button {
          model.selectTimeRange(timeRange)
          dismissMarketFilterSheet()
        } label: {
          Text(timeRange.rawValue)
            .font(.system(size: 14, weight: .medium))
            .foregroundColor(isSelected ? .primary : .appClipSecondaryText)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .frame(height: 40)
            .background(isSelected ? Color.appClipActive : .clear)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityValue(isSelected ? String(localized: "global.selected") : "")
        .accessibilityIdentifier(
          "app-clip-market-time-range-option-\(timeRange.rawValue)"
        )
      }
    }
    .padding(8)
  }

  @ViewBuilder
  private func marketDetail(_ detail: AppClipMarketDetail) -> some View {
    unifiedMarketDetail(detail)
  }

  private func unifiedMarketDetail(_ detail: AppClipMarketDetail) -> some View {
    VStack(spacing: 0) {
      HStack {
        Button {
          selectedCandleID = nil
          model.showMarket()
        } label: {
          Image(systemName: "chevron.left")
            .font(.system(size: 16, weight: .semibold))
            .foregroundColor(.primary)
            .frame(width: 44, height: 44)
            .background(Color.appClipSurface)
            .clipShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("app-clip-market-back")
        Spacer()
      }
      .frame(height: 64)
      .padding(.horizontal, 20)

      VStack(alignment: .leading, spacing: 5) {
        HStack(spacing: 10) {
          marketDetailLogo(detail)
            .frame(width: 32, height: 32)
          Text(marketDetailTitle(detail))
            .font(.system(size: 32, weight: .bold))
            .foregroundColor(.primary)
            .lineLimit(1)
        }
        Text(marketDetailSubtitle(detail))
          .font(.system(size: 14, weight: .medium))
          .foregroundColor(.appClipSecondaryText)
          .lineLimit(1)
        Text(formattedPrice(selectedCandle?.c ?? marketDetailSnapshotPrice(detail)))
          .font(.system(size: 40, weight: .bold))
          .foregroundColor(.primary)
          .monospacedDigit()
          .lineLimit(1)
          .minimumScaleFactor(0.55)
          .padding(.top, 5)
          .accessibilityIdentifier("app-clip-detail-price")
        HStack(spacing: 6) {
          Text(formattedPercentage(marketDetailChange(detail)))
            .foregroundColor(changeColor(marketDetailChange(detail)))
          Text(marketDetailChangePeriodLabel(detail))
            .foregroundColor(.appClipSecondaryText)
        }
        .font(.system(size: 18, weight: .semibold))
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 20)
      .padding(.top, 4)
      .padding(.bottom, 6)

      chartState(detail: detail)
        .frame(minHeight: 260)
        .layoutPriority(1)
        .accessibilityIdentifier("app-clip-detail-chart")

      HStack(spacing: 8) {
        ForEach(marketDetailPeriods(detail), id: \.self) { interval in
          Button {
            selectedCandleID = nil
            Task { await model.selectDetailInterval(interval, detail: detail) }
          } label: {
            Text(interval)
              .font(.system(size: 14, weight: .semibold))
              .foregroundColor(
                interval == model.selectedInterval ? .appClipBackground : .appClipSecondaryText
              )
              .frame(maxWidth: .infinity)
              .frame(height: 32)
              .background(
                interval == model.selectedInterval ? Color.primary : .clear
              )
              .clipShape(Capsule())
          }
          .buttonStyle(.plain)
          .accessibilityIdentifier("app-clip-detail-period-\(interval)")
        }
      }
      .padding(.horizontal, 12)
      .padding(.top, 7)
      .padding(.bottom, 5)

      Label(String(localized: "market.powered_by"), systemImage: "bolt.fill")
        .font(.system(size: 12, weight: .medium))
        .foregroundColor(.appClipSecondaryText)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.vertical, 6)

      installFooter(asset: marketDetailTokenAsset(detail), usesDetailStyle: true)
    }
    .background(Color.appClipBackground.ignoresSafeArea())
  }

  @ViewBuilder
  private func marketDetailLogo(_ detail: AppClipMarketDetail) -> some View {
    switch detail {
    case .token(let asset):
      TokenLogo(asset: asset)
    case .stock(let stock):
      RemoteImage(
        urls: stock.logoURL.map { [$0] } ?? [],
        fallbackSystemName: "chart.line.uptrend.xyaxis.circle.fill"
      )
      .clipShape(Circle())
    case .perp(let perp):
      RemoteImage(
        urls: perp.logoURL.map { [$0] } ?? [],
        fallbackSystemName: "chart.line.uptrend.xyaxis.circle.fill"
      )
      .clipShape(Circle())
    }
  }

  private func marketDetailTitle(_ detail: AppClipMarketDetail) -> String {
    switch detail {
    case .token(let asset):
      return asset.symbol
    case .stock(let stock):
      return stock.symbol
    case .perp(let perp):
      return perp.displayName
    }
  }

  private func marketDetailSubtitle(_ detail: AppClipMarketDetail) -> String {
    switch detail {
    case .token(let asset):
      return "\(asset.detailSubtitle) · Spot"
    case .stock(let stock):
      return stock.name
    case .perp(let perp):
      let label = String(localized: "market.tab.perps")
      guard let leverage = formattedLeverage(perp.maxLeverage) else {
        return label
      }
      return "\(label) · \(leverage)"
    }
  }

  private func marketDetailSnapshotPrice(_ detail: AppClipMarketDetail) -> Double? {
    switch detail {
    case .token(let asset):
      return asset.price
    case .stock(let stock):
      return stock.price
    case .perp(let perp):
      return perp.markPrice
    }
  }

  private func marketDetailChange(_ detail: AppClipMarketDetail) -> Double? {
    switch detail {
    case .token(let asset):
      return asset.priceChangePercent
    case .stock(let stock):
      return stock.priceChangePercent
    case .perp(let perp):
      return perp.priceChangePercent
    }
  }

  private func marketDetailChangePeriodLabel(_ detail: AppClipMarketDetail) -> String {
    switch detail {
    case .token:
      return model.selectedTimeRange.rawValue
    case .stock, .perp:
      return "24h"
    }
  }

  private func marketDetailPeriods(_ detail: AppClipMarketDetail) -> [String] {
    switch detail {
    case .stock:
      return ["1H", "1D", "1W", "1M", "1Y", "All"]
    case .token, .perp:
      return ["1m", "15m", "1H", "4H"]
    }
  }

  private func marketDetailTokenAsset(
    _ detail: AppClipMarketDetail
  ) -> AppClipMarketAsset? {
    guard case .token(let asset) = detail else {
      return nil
    }
    return asset
  }

  @ViewBuilder
  private func chartState(detail: AppClipMarketDetail) -> some View {
    if model.isLoadingCandles && model.candles.isEmpty {
      ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    } else if model.candleLoadFailed && model.candles.isEmpty {
      VStack(spacing: 12) {
        Image(systemName: "chart.xyaxis.line")
          .font(.system(size: 28))
          .foregroundColor(.appClipSecondaryText)
        Text(String(localized: "chart.unavailable"))
          .font(.subheadline)
          .foregroundColor(.appClipSecondaryText)
        retryButton {
          model.retryDetailCandles(detail: detail)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    } else {
      PriceChart(
        candles: model.candles,
        selectedCandleID: $selectedCandleID
      )
      .padding(.horizontal, 12)
    }
  }

  private var selectedCandle: AppClipCandle? {
    guard let selectedCandleID else {
      return nil
    }
    return model.candles.first { $0.id == selectedCandleID }
  }

  private func webExperience(_ url: URL) -> some View {
    VStack(spacing: 0) {
      simpleHeader(
        title: String(localized: "campaign.title"),
        subtitle: String(localized: "campaign.secure_webview")
      )
      CampaignWebView(url: url)
      installFooter(asset: nil)
    }
  }

  private func simpleHeader(title: String, subtitle: String) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(title)
        .font(.system(size: 28, weight: .bold))
      Text(subtitle)
        .font(.system(size: 16))
        .foregroundColor(.appClipSecondaryText)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 20)
    .padding(.vertical, 18)
  }

  private func retryButton(action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Text(String(localized: "global.retry"))
        .font(.system(size: 14, weight: .semibold))
        .foregroundColor(.primary)
        .padding(.horizontal, 18)
        .frame(height: 36)
        .background(Color.appClipSurface)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
    .buttonStyle(.plain)
  }

  private func installFooter(
    asset: AppClipMarketAsset?,
    usesDetailStyle: Bool = false
  ) -> some View {
    VStack(spacing: 8) {
      Button {
        let fullAppURL = model.recordInstallCTA(asset: asset)
        overlayPresenter.openFullAppOrPresent(
          fullAppURL: fullAppURL,
          campaignToken: model.campaignToken
        )
      } label: {
        Text(
          asset.map { String(format: String(localized: "cta.trade_symbol"), $0.symbol) }
            ?? String(localized: "cta.trade")
        )
        .font(.system(size: 17, weight: .semibold))
        .foregroundColor(.appClipAccentText)
        .frame(maxWidth: .infinity)
        .frame(height: 52)
        .background(Color.appClipAccent)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
      }
      .buttonStyle(.plain)
      .accessibilityIdentifier("app-clip-install-cta")
      Text(String(localized: "cta.note"))
        .font(.system(size: 13))
        .foregroundColor(.appClipSecondaryText)
    }
    .padding(.horizontal, 18)
    .padding(.top, 12)
    .padding(.bottom, 10)
    .background(usesDetailStyle ? Color.appClipBackground : Color.appClipFooter)
    .overlay(alignment: .top) {
      Divider()
        .background(Color.appClipSeparator)
    }
  }

  private var marketStatusText: String {
    let time = model.lastUpdated.map { Self.statusTimeFormatter.string(from: $0) }
    if model.marketRefreshFailed {
      if let time {
        return String(format: String(localized: "market.update_failed"), time)
      }
      return String(
        localized: model.isNetworkAvailable == false
          ? "market.no_network"
          : "market.unavailable"
      )
    }
    if !model.activeDidLoad || (model.isRefreshing && model.activeIsEmpty) {
      return String(localized: "market.refreshing")
    }
    if model.activeIsEmpty {
      return String(localized: "market.no_results")
    }
    return String(localized: "market.realtime")
  }

  private static let statusTimeFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateStyle = .none
    formatter.timeStyle = .short
    return formatter
  }()
}

private struct MarketStockRow: View {
  let stock: AppClipMarketStock

  var body: some View {
    HStack(spacing: 0) {
      HStack(spacing: 14) {
        RemoteImage(
          urls: stock.logoURL.map { [$0] } ?? [],
          fallbackSystemName: "chart.line.uptrend.xyaxis.circle.fill"
        )
        .frame(width: 40, height: 40)
        .clipShape(Circle())
        VStack(alignment: .leading, spacing: 0) {
          Text(stock.symbol)
            .font(.system(size: 16, weight: .medium))
            .foregroundColor(.primary)
            .lineLimit(1)
          Text(stock.name)
            .font(.system(size: 14))
            .foregroundColor(.appClipSecondaryText)
            .lineLimit(1)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      HStack(spacing: 8) {
        Text(formattedPrice(stock.price))
          .font(.system(size: 16, weight: .medium))
          .foregroundColor(.primary)
          .monospacedDigit()
          .lineLimit(1)
          .minimumScaleFactor(0.7)
        PriceChangeBadge(change: stock.priceChangePercent)
      }
    }
    .padding(.horizontal, 20)
    .frame(height: 72)
    .contentShape(Rectangle())
    .accessibilityElement(children: .combine)
  }
}

private struct MarketPerpsRow: View {
  let perp: AppClipMarketPerp

  var body: some View {
    HStack(spacing: 0) {
      HStack(spacing: 8) {
        RemoteImage(
          urls: perp.logoURL.map { [$0] } ?? [],
          fallbackSystemName: "chart.line.uptrend.xyaxis.circle.fill"
        )
        .frame(width: 32, height: 32)
        .clipShape(Circle())
        VStack(alignment: .leading, spacing: 0) {
          HStack(spacing: 4) {
            Text(perp.displayName)
              .font(.system(size: 16, weight: .medium))
              .foregroundColor(.primary)
              .lineLimit(1)
            if let leverage = formattedLeverage(perp.maxLeverage) {
              Text(leverage)
                .font(.system(size: 10))
                .foregroundColor(.appClipInfoText)
                .padding(.horizontal, 4)
                .frame(height: 16)
                .background(Color.appClipInfo)
                .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
            }
          }
          Text(formattedMarketAmount(perp.volume))
            .font(.system(size: 12))
            .foregroundColor(.appClipSecondaryText)
            .lineLimit(1)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      HStack(spacing: 8) {
        Text(formattedPrice(perp.markPrice))
          .font(.system(size: 16, weight: .medium))
          .foregroundColor(.primary)
          .monospacedDigit()
          .lineLimit(1)
          .minimumScaleFactor(0.7)
        PriceChangeBadge(change: perp.priceChangePercent)
      }
    }
    .padding(.horizontal, 16)
    .frame(height: 64)
    .contentShape(Rectangle())
    .accessibilityElement(children: .combine)
  }
}

private struct MarketAssetRow: View {
  let asset: AppClipMarketAsset

  var body: some View {
    HStack(spacing: 0) {
      HStack(spacing: 12) {
        TokenLogo(asset: asset)
        VStack(alignment: .leading, spacing: 2) {
          Text(asset.symbol)
            .font(.system(size: 16, weight: .medium))
            .foregroundColor(.primary)
            .lineLimit(1)
          if let turnover = asset.turnover, turnover > 0 {
            Text(formattedMarketAmount(turnover))
              .font(.system(size: 14))
              .foregroundColor(.appClipSecondaryText)
              .lineLimit(1)
          }
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      HStack(spacing: 8) {
        Text(formattedPrice(asset.price))
          .font(.system(size: 16, weight: .medium))
          .foregroundColor(.primary)
          .monospacedDigit()
          .lineLimit(1)
          .minimumScaleFactor(0.7)
        PriceChangeBadge(change: asset.priceChangePercent)
      }
    }
    .contentShape(Rectangle())
    .padding(.horizontal, 20)
    .frame(height: 72)
  }
}

private struct TokenLogo: View {
  let asset: AppClipMarketAsset

  var body: some View {
    RemoteImage(urls: asset.logoURLs, fallbackSystemName: "bitcoinsign.circle.fill")
      .frame(width: 32, height: 32)
      .clipShape(Circle())
      .overlay(alignment: .bottomTrailing) {
        if let networkLogoURL = asset.networkLogoURL {
          RemoteImage(urls: [networkLogoURL], fallbackSystemName: "link.circle.fill")
            .frame(width: 16, height: 16)
            .clipShape(Circle())
            .overlay(Circle().stroke(Color.appClipBackground, lineWidth: 2))
            .offset(x: 2, y: 2)
        }
      }
  }
}

private final class AppClipImageMemoryCache: @unchecked Sendable {
  private let cache = NSCache<NSURL, UIImage>()

  init() {
    cache.countLimit = 160
    cache.totalCostLimit = 24 * 1_024 * 1_024
  }

  func image(for url: URL) -> UIImage? {
    cache.object(forKey: url as NSURL)
  }

  func insert(_ image: UIImage, for url: URL) {
    let cost = image.cgImage.map { $0.bytesPerRow * $0.height } ?? 0
    cache.setObject(image, forKey: url as NSURL, cost: cost)
  }
}

private final class AppClipLogoRedirectDelegate: NSObject, URLSessionTaskDelegate {
  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void
  ) {
    completionHandler(
      request.url.flatMap(AppClipMarketService.allowedLogoURL) == nil ? nil : request
    )
  }
}

private actor AppClipImagePipeline {
  static let shared = AppClipImagePipeline()

  nonisolated let memoryCache = AppClipImageMemoryCache()
  private let session: URLSession
  private var inFlight: [URL: Task<UIImage, Error>] = [:]

  init() {
    let configuration = URLSessionConfiguration.default
    configuration.requestCachePolicy = .returnCacheDataElseLoad
    configuration.urlCache = URLCache(
      memoryCapacity: 8 * 1_024 * 1_024,
      diskCapacity: 32 * 1_024 * 1_024,
      diskPath: "OneKeyAppClipImages"
    )
    configuration.httpMaximumConnectionsPerHost = 4
    session = URLSession(
      configuration: configuration,
      delegate: AppClipLogoRedirectDelegate(),
      delegateQueue: nil
    )
  }

  nonisolated func cachedImage(for url: URL) -> UIImage? {
    memoryCache.image(for: url)
  }

  func image(for url: URL) async throws -> UIImage {
    if let cached = memoryCache.image(for: url) {
      return cached
    }
    if let task = inFlight[url] {
      return try await task.value
    }
    let session = session
    let task = Task<UIImage, Error> {
      var request = URLRequest(url: url)
      request.timeoutInterval = 10
      request.cachePolicy = .returnCacheDataElseLoad
      let (data, response) = try await session.data(for: request)
      guard
        let response = response as? HTTPURLResponse,
        (200..<300).contains(response.statusCode),
        data.count <= 8 * 1_024 * 1_024,
        response.url.flatMap(AppClipMarketService.allowedLogoURL) != nil,
        let source = CGImageSourceCreateWithData(data as CFData, [
          kCGImageSourceShouldCache: false,
        ] as CFDictionary),
        let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
        let width = properties[kCGImagePropertyPixelWidth] as? Int,
        let height = properties[kCGImagePropertyPixelHeight] as? Int,
        width > 0,
        height > 0,
        width <= 1_024,
        height <= 1_024,
        let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, [
          kCGImageSourceCreateThumbnailFromImageAlways: true,
          kCGImageSourceThumbnailMaxPixelSize: 128,
          kCGImageSourceShouldCacheImmediately: true,
        ] as CFDictionary)
      else {
        throw URLError(.cannotDecodeContentData)
      }
      return UIImage(cgImage: thumbnail)
    }
    inFlight[url] = task
    defer {
      inFlight[url] = nil
    }
    let image = try await task.value
    memoryCache.insert(image, for: url)
    return image
  }
}

private struct RemoteImage: View {
  let urls: [URL]
  let fallbackSystemName: String
  @State private var loadedImage: UIImage?
  @State private var loadedURL: URL?
  @State private var isLoading = false

  var body: some View {
    content
      .task(id: urls) {
        await loadImage()
      }
  }

  @ViewBuilder
  private var content: some View {
    if let image = visibleImage {
      Image(uiImage: image)
        .resizable()
        .scaledToFill()
    } else if isLoading {
      Color.appClipSurface.overlay(ProgressView().controlSize(.mini))
    } else {
      fallback
    }
  }

  private var visibleImage: UIImage? {
    if let loadedURL, urls.contains(loadedURL), let loadedImage {
      return loadedImage
    }
    for url in urls {
      if let cached = AppClipImagePipeline.shared.cachedImage(for: url) {
        return cached
      }
    }
    return nil
  }

  @MainActor
  private func loadImage() async {
    let requestURLs = urls
    if let cached = requestURLs.compactMap({ url in
      AppClipImagePipeline.shared.cachedImage(for: url).map { (url, $0) }
    }).first {
      loadedURL = cached.0
      loadedImage = cached.1
      isLoading = false
      return
    }
    loadedURL = nil
    loadedImage = nil
    guard !requestURLs.isEmpty else {
      isLoading = false
      return
    }
    isLoading = true
    for url in requestURLs {
      do {
        let image = try await AppClipImagePipeline.shared.image(for: url)
        guard !Task.isCancelled, urls == requestURLs else {
          return
        }
        loadedURL = url
        loadedImage = image
        isLoading = false
        return
      } catch {
        guard !Task.isCancelled, urls == requestURLs else {
          return
        }
      }
    }
    if urls == requestURLs {
      isLoading = false
    }
  }

  private var fallback: some View {
    Color.appClipSurface.overlay(
      Image(systemName: fallbackSystemName)
        .resizable()
        .scaledToFit()
        .foregroundColor(.appClipSecondaryText)
        .padding(3)
    )
  }
}

private struct PriceChangeBadge: View {
  let change: Double?

  var body: some View {
    Text(formattedPercentage(change))
      .font(.system(size: 14, weight: .medium))
      .foregroundColor(.white)
      .lineLimit(1)
      .minimumScaleFactor(0.75)
      .frame(width: 80, height: 32)
      .background(badgeColor)
      .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
  }

  private var badgeColor: Color {
    guard let change else {
      return .appClipNeutralStrong
    }
    if change > 0 {
      return .appClipPositive
    }
    if change < 0 {
      return .appClipNegative
    }
    return .appClipNeutralStrong
  }
}

private struct AppClipMarketRowButtonStyle: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .frame(maxWidth: .infinity)
      .contentShape(Rectangle())
      .background(
        RoundedRectangle(cornerRadius: 12, style: .circular)
          .fill(configuration.isPressed ? Color.appClipActive : .clear)
      )
      .clipShape(RoundedRectangle(cornerRadius: 12, style: .circular))
  }
}

private struct PriceChart: View {
  let candles: [AppClipCandle]
  @Binding var selectedCandleID: AppClipCandle.ID?

  var body: some View {
    Group {
      if #available(iOS 16.0, *) {
        AppleMarketChart(
          candles: candles,
          selectedCandleID: $selectedCandleID
        )
      } else {
        LegacyMarketChart(candles: candles, selectedCandleID: $selectedCandleID)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.appClipChart)
  }
}

@available(iOS 16.0, *)
private struct AppleMarketChart: View {
  let candles: [AppClipCandle]
  @Binding var selectedCandleID: AppClipCandle.ID?

  var body: some View {
    let priceDomain = chartPriceDomain(candles)
    let lineColor = chartTrendColor(candles)

    Chart {
      ForEach(candles) { candle in
        LineMark(
          x: .value("Time", Date(timeIntervalSince1970: candle.t)),
          y: .value("Price", candle.c)
        )
        .foregroundStyle(lineColor)
        .lineStyle(StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
      }
      if let selectedCandle {
        let selectedDate = Date(timeIntervalSince1970: selectedCandle.t)
        RuleMark(x: .value("Selected time", selectedDate))
          .foregroundStyle(Color.appClipSecondaryText.opacity(0.5))
          .lineStyle(StrokeStyle(lineWidth: 1))
        PointMark(
          x: .value("Selected time", selectedDate),
          y: .value("Selected close", selectedCandle.c)
        )
        .symbol {
          ChartPoint(color: lineColor)
        }
      } else if let lastCandle = candles.last {
        PointMark(
          x: .value("Latest time", Date(timeIntervalSince1970: lastCandle.t)),
          y: .value("Latest close", lastCandle.c)
        )
        .symbol {
          ChartPoint(color: lineColor)
        }
      }
    }
    .chartXScale(domain: chartTimeDomain)
    .chartYScale(domain: priceDomain)
    .chartXAxis(.hidden)
    .chartYAxis(.hidden)
    .chartOverlay { proxy in
      GeometryReader { geometry in
        let plotFrame = geometry[proxy.plotAreaFrame]
        ZStack(alignment: .topLeading) {
          Rectangle()
            .fill(Color.clear)
            .contentShape(Rectangle())
            .highPriorityGesture(
              DragGesture(minimumDistance: 0)
                .onChanged { value in
                  let plotX = min(
                    max(value.location.x - plotFrame.minX, 0),
                    plotFrame.width
                  )
                  if let date = proxy.value(atX: plotX, as: Date.self),
                    let candle = nearestCandle(to: date, in: candles)
                  {
                    selectedCandleID = candle.id
                  } else if let candle = candle(at: plotX, width: plotFrame.width, in: candles) {
                    selectedCandleID = candle.id
                  }
                }
                .onEnded { _ in
                  selectedCandleID = nil
                }
            )
          if let selectedCandle,
            let chartX = proxy.position(
              forX: Date(timeIntervalSince1970: selectedCandle.t)
            )
          {
            ChartSelectionTooltip(candle: selectedCandle)
              .frame(width: 208)
              .position(
                x: min(
                  max(plotFrame.minX + chartX, plotFrame.minX + 104),
                  plotFrame.maxX - 104
                ),
                y: plotFrame.minY + 38
              )
          }
        }
      }
    }
  }

  private var chartTimeDomain: ClosedRange<Date> {
    let first = candles.first.map { Date(timeIntervalSince1970: $0.t) } ?? Date()
    let last = candles.last.map { Date(timeIntervalSince1970: $0.t) } ?? first
    let duration = max(last.timeIntervalSince(first), 1)
    let padding = duration * 0.02
    return first.addingTimeInterval(-padding)...last.addingTimeInterval(padding)
  }

  private var selectedCandle: AppClipCandle? {
    guard let selectedCandleID else {
      return nil
    }
    return candles.first { $0.id == selectedCandleID }
  }
}

private struct LegacyMarketChart: View {
  let candles: [AppClipCandle]
  @Binding var selectedCandleID: AppClipCandle.ID?

  var body: some View {
    GeometryReader { geometry in
      let horizontalInset: CGFloat = 8
      let plotWidth = max(geometry.size.width - horizontalInset * 2, 1)
      ZStack(alignment: .topLeading) {
        Canvas { context, size in
          drawChart(context: context, size: size)
        }
        Rectangle()
          .fill(Color.clear)
          .contentShape(Rectangle())
          .highPriorityGesture(
            DragGesture(minimumDistance: 0)
              .onChanged { value in
                let x = min(max(value.location.x - horizontalInset, 0), plotWidth)
                let rawIndex = x / plotWidth * CGFloat(candles.count - 1)
                let index = min(
                  max(Int(rawIndex.rounded()), 0),
                  max(candles.count - 1, 0)
                )
                guard candles.indices.contains(index) else {
                  return
                }
                selectedCandleID = candles[index].id
              }
              .onEnded { _ in
                selectedCandleID = nil
              }
          )
        if let selectedCandle,
          let selectedIndex = candles.firstIndex(of: selectedCandle)
        {
          let denominator = CGFloat(max(candles.count - 1, 1))
          let x = horizontalInset + plotWidth * CGFloat(selectedIndex) / denominator
          ChartSelectionTooltip(candle: selectedCandle)
            .frame(width: 208)
            .position(
              x: min(max(x, 104), geometry.size.width - 104),
              y: 38
            )
        }
      }
    }
  }

  private var selectedCandle: AppClipCandle? {
    guard let selectedCandleID else {
      return nil
    }
    return candles.first { $0.id == selectedCandleID }
  }

  private func drawChart(context: GraphicsContext, size: CGSize) {
    guard !candles.isEmpty else {
      return
    }
    let priceDomain = chartPriceDomain(candles)
    let lowerBound = priceDomain.lowerBound
    let range = priceDomain.upperBound - lowerBound
    let horizontalInset: CGFloat = 8
    let verticalInset: CGFloat = 14
    let width = max(size.width - horizontalInset * 2, 1)
    let height = max(size.height - verticalInset * 2, 1)
    let denominator = CGFloat(max(candles.count - 1, 1))
    let lineColor = chartTrendColor(candles)

    func y(_ value: Double) -> CGFloat {
      verticalInset + height * (1 - CGFloat((value - lowerBound) / range))
    }

    var line = Path()
    for (index, candle) in candles.enumerated() {
      let x = horizontalInset + width * CGFloat(index) / denominator
      let point = CGPoint(x: x, y: y(candle.c))
      if index == 0 {
        line.move(to: point)
      } else {
        line.addLine(to: point)
      }
    }
    context.stroke(
      line,
      with: .color(lineColor),
      style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round)
    )

    let activeCandle = selectedCandle ?? candles.last
    guard let activeCandle, let activeIndex = candles.firstIndex(of: activeCandle) else {
      return
    }
    let x = horizontalInset + width * CGFloat(activeIndex) / denominator
    if selectedCandle != nil {
      var crosshair = Path()
      crosshair.move(to: CGPoint(x: x, y: verticalInset))
      crosshair.addLine(to: CGPoint(x: x, y: size.height - verticalInset))
      context.stroke(
        crosshair,
        with: .color(Color.appClipSecondaryText.opacity(0.5)),
        lineWidth: 1
      )
    }
    let pointY = y(activeCandle.c)
    let halo = CGRect(x: x - 9, y: pointY - 9, width: 18, height: 18)
    let point = CGRect(x: x - 4, y: pointY - 4, width: 8, height: 8)
    context.fill(Path(ellipseIn: halo), with: .color(lineColor.opacity(0.16)))
    context.fill(Path(ellipseIn: point), with: .color(lineColor))
  }
}

private struct ChartPoint: View {
  let color: Color

  var body: some View {
    ZStack {
      Circle()
        .fill(color.opacity(0.16))
        .frame(width: 18, height: 18)
      Circle()
        .fill(color)
        .frame(width: 8, height: 8)
    }
  }
}

private struct ChartSelectionTooltip: View {
  let candle: AppClipCandle

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(formattedChartDate(candle.t))
          .foregroundColor(.appClipSecondaryText)
        Spacer(minLength: 0)
        Text(formattedChartPrice(candle.c))
          .fontWeight(.semibold)
      }
      Text("O \(formattedChartPrice(candle.o))  H \(formattedChartPrice(candle.h))")
      Text("L \(formattedChartPrice(candle.l))  V \(formattedChartVolume(candle.v))")
    }
    .font(.system(size: 9, weight: .medium, design: .monospaced))
    .foregroundColor(.primary)
    .padding(.horizontal, 8)
    .padding(.vertical, 6)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Color.appClipFooter.opacity(0.96))
    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    .overlay {
      RoundedRectangle(cornerRadius: 8, style: .continuous)
        .stroke(Color.appClipSeparator, lineWidth: 1)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityIdentifier("app-clip-chart-selection")
    .accessibilityLabel(chartSelectionAccessibilityLabel(candle))
  }
}

@MainActor
private final class AppInstallOverlayPresenter: NSObject, @preconcurrency SKOverlayDelegate {
  static let shared = AppInstallOverlayPresenter()

  private static let appStoreURL = URL(
    string: "itms-apps://apps.apple.com/app/id1609559473"
  )
  private static let appStoreWebURL = URL(
    string: "https://apps.apple.com/app/id1609559473"
  )

  private var overlay: SKOverlay?
  private var activeOperationID = UUID()
  private var didFallbackToAppStore = false

  func openFullAppOrPresent(fullAppURL: URL?, campaignToken: String?) {
    let operationID = beginOperation()
    guard let fullAppURL else {
      presentFullApp(campaignToken: campaignToken, operationID: operationID)
      return
    }
    UIApplication.shared.open(
      fullAppURL,
      options: [.universalLinksOnly: true]
    ) { [weak self] opened in
      Task { @MainActor in
        guard let self, operationID == self.activeOperationID, !opened else {
          return
        }
        self.presentFullApp(campaignToken: campaignToken, operationID: operationID)
      }
    }
  }

  private func beginOperation() -> UUID {
    overlay?.delegate = nil
    overlay = nil
    let operationID = UUID()
    activeOperationID = operationID
    didFallbackToAppStore = false
    return operationID
  }

  private func presentFullApp(campaignToken: String?, operationID: UUID) {
    guard operationID == activeOperationID else {
      return
    }
    guard
      let scene = UIApplication.shared.connectedScenes
        .compactMap({ $0 as? UIWindowScene })
        .first(where: { $0.activationState == .foregroundActive })
    else {
      openAppStore(operationID: operationID)
      return
    }
    let configuration = SKOverlay.AppClipConfiguration(position: .bottom)
    configuration.campaignToken = campaignToken
    let overlay = SKOverlay(configuration: configuration)
    overlay.delegate = self
    self.overlay = overlay
    overlay.present(in: scene)
  }

  func storeOverlayDidFailToLoad(_ overlay: SKOverlay, error: any Error) {
    guard overlay === self.overlay else {
      return
    }
    openAppStore(operationID: activeOperationID)
  }

  private func openAppStore(operationID: UUID) {
    guard operationID == activeOperationID, !didFallbackToAppStore else {
      return
    }
    didFallbackToAppStore = true
    overlay?.delegate = nil
    overlay = nil
    #if targetEnvironment(simulator)
      openAppStoreWebPage(operationID: operationID)
    #else
      guard let appStoreURL = Self.appStoreURL else {
        openAppStoreWebPage(operationID: operationID)
        return
      }
      UIApplication.shared.open(appStoreURL) { [weak self] opened in
        guard !opened else {
          return
        }
        Task { @MainActor in
          self?.openAppStoreWebPage(operationID: operationID)
        }
      }
    #endif
  }

  private func openAppStoreWebPage(operationID: UUID) {
    guard operationID == activeOperationID, let appStoreWebURL = Self.appStoreWebURL else {
      return
    }
    UIApplication.shared.open(appStoreWebURL)
  }
}

private func formattedPrice(_ value: Double?) -> String {
  guard let value, value.isFinite else {
    return "--"
  }
  let formatter = NumberFormatter()
  formatter.locale = Locale.current
  formatter.numberStyle = .currency
  formatter.currencyCode = "USD"
  formatter.currencySymbol = "$"
  if abs(value) >= 1 {
    formatter.minimumFractionDigits = 2
    formatter.maximumFractionDigits = abs(value) >= 1_000 ? 2 : 4
  } else if abs(value) >= 0.01 {
    formatter.minimumFractionDigits = 2
    formatter.maximumFractionDigits = 4
  } else {
    formatter.minimumFractionDigits = 4
    formatter.maximumFractionDigits = 8
  }
  return formatter.string(from: NSNumber(value: value)) ?? "--"
}

private func formattedPercentage(_ value: Double?) -> String {
  guard let value, value.isFinite else {
    return "--"
  }
  return String(format: "%+.2f%%", value)
}

private func formattedLeverage(_ value: Double?) -> String? {
  guard let value, value.isFinite, value > 0 else {
    return nil
  }
  if value.rounded() == value {
    return "\(Int(value))x"
  }
  return "\(value.formatted(.number.precision(.fractionLength(0...1))))x"
}

private func formattedMarketAmount(_ value: Double?) -> String {
  guard let value, value.isFinite, value > 0 else {
    return "--"
  }
  let absoluteValue = abs(value)
  let amount: Double
  let suffix: String
  switch absoluteValue {
  case 1_000_000_000_000...:
    amount = value / 1_000_000_000_000
    suffix = "T"
  case 1_000_000_000...:
    amount = value / 1_000_000_000
    suffix = "B"
  case 1_000_000...:
    amount = value / 1_000_000
    suffix = "M"
  case 1_000...:
    amount = value / 1_000
    suffix = "K"
  default:
    amount = value
    suffix = ""
  }
  return String(format: "$%.2f%@", amount, suffix)
}

private func changeColor(_ value: Double?) -> Color {
  guard let value else {
    return .appClipSecondaryText
  }
  if value > 0 {
    return .appClipPositive
  }
  if value < 0 {
    return .appClipNegative
  }
  return .appClipSecondaryText
}

private func chartTrendColor(_ candles: [AppClipCandle]) -> Color {
  guard let first = candles.first, let last = candles.last else {
    return .appClipPositive
  }
  return last.c >= first.c ? .appClipPositive : .appClipNegative
}

private func chartPriceDomain(_ candles: [AppClipCandle]) -> ClosedRange<Double> {
  let lowest = candles.map(\.c).min() ?? 0
  let highest = candles.map(\.c).max() ?? 0
  let baseline = max(abs(lowest), abs(highest))
  let minimumPadding = baseline > 0 ? baseline * 0.000_001 : 0.000_001
  let padding = max((highest - lowest) * 0.12, minimumPadding)
  return (lowest - padding)...(highest + padding)
}

private func formattedChartPrice(_ value: Double) -> String {
  let fractionLength: ClosedRange<Int>
  if abs(value) >= 1 {
    fractionLength = 2...2
  } else if abs(value) >= 0.0001 {
    fractionLength = 0...8
  } else {
    fractionLength = 0...10
  }
  return value.formatted(.number.precision(.fractionLength(fractionLength)))
}

private func formattedChartDate(_ timestamp: Double) -> String {
  Date(timeIntervalSince1970: timestamp).formatted(date: .numeric, time: .shortened)
}

private func formattedChartVolume(_ value: Double) -> String {
  guard value.isFinite else {
    return "--"
  }
  return value.formatted(.number.precision(.fractionLength(0...4)))
}

private func nearestCandle(
  to date: Date,
  in candles: [AppClipCandle]
) -> AppClipCandle? {
  candles.min {
    abs($0.t - date.timeIntervalSince1970) < abs($1.t - date.timeIntervalSince1970)
  }
}

private func candle(
  at x: CGFloat,
  width: CGFloat,
  in candles: [AppClipCandle]
) -> AppClipCandle? {
  guard !candles.isEmpty, width > 0 else {
    return nil
  }
  let progress = min(max(x / width, 0), 1)
  let index = min(Int((progress * CGFloat(candles.count)).rounded(.down)), candles.count - 1)
  return candles[index]
}

private func chartSelectionAccessibilityLabel(_ candle: AppClipCandle) -> String {
  [
    formattedChartDate(candle.t),
    "O \(formattedChartPrice(candle.o))",
    "H \(formattedChartPrice(candle.h))",
    "L \(formattedChartPrice(candle.l))",
    "C \(formattedChartPrice(candle.c))",
    "V \(formattedChartVolume(candle.v))",
  ].joined(separator: ", ")
}

extension Color {
  fileprivate static let appClipBackground = adaptive(light: 0xFFFFFF, dark: 0x000000)
  fileprivate static let appClipPanel = adaptive(light: 0xFCFCFC, dark: 0x1A1A1A)
  fileprivate static let appClipSurface = adaptive(light: 0xF0F0F0, dark: 0x222222)
  fileprivate static let appClipActive = adaptive(light: 0xECECEC, dark: 0x262626)
  fileprivate static let appClipInfo = adaptive(light: 0xE9F1FF, dark: 0x172947)
  fileprivate static let appClipInfoText = adaptive(light: 0x315D9A, dark: 0x8AB4F8)
  fileprivate static let appClipFooter = adaptive(light: 0xFCFCFC, dark: 0x111111)
  fileprivate static let appClipChart = adaptive(light: 0xFFFFFF, dark: 0x000000)
  fileprivate static let appClipSeparator = adaptive(light: 0xE8E8E8, dark: 0x2A2A2A)
  fileprivate static let appClipSecondaryText = adaptive(light: 0x646464, dark: 0xB4B4B4)
  fileprivate static let appClipNeutralStrong = adaptive(light: 0x8D8D8D, dark: 0x6E6E6E)
  fileprivate static let appClipPositive = adaptive(light: 0x30A46C, dark: 0x30A46C)
  fileprivate static let appClipNegative = adaptive(light: 0xE5484D, dark: 0xE5484D)
  fileprivate static let appClipAccent = adaptive(light: 0x22AB15, dark: 0x3EDC2F)
  fileprivate static let appClipAccentText = adaptive(light: 0x000000, dark: 0x000000)

  private static func adaptive(light: UInt, dark: UInt) -> Color {
    Color(
      UIColor { traits in
        UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
      }
    )
  }
}

extension UIColor {
  fileprivate convenience init(hex: UInt) {
    self.init(
      red: CGFloat((hex >> 16) & 0xFF) / 255,
      green: CGFloat((hex >> 8) & 0xFF) / 255,
      blue: CGFloat(hex & 0xFF) / 255,
      alpha: 1
    )
  }
}
