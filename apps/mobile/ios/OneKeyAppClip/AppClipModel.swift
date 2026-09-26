import Foundation
import Network

struct AppClipInvocation {
  enum Experience {
    case market
    case web(URL)
  }

  let attribution: AppClipAttributionRecord
  let experience: Experience
  let inviteCode: String?
  let apiBaseURL: URL
  let appLinkHost: String

  init?(url: URL) {
    guard
      url.scheme?.lowercased() == "https",
      url.user == nil,
      url.password == nil,
      url.port == nil || url.port == 443,
      let host = url.host?.lowercased(),
      host == "app.onekey.so" || host == "app.onekeytest.com"
    else {
      return nil
    }
    let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
    let queryItems = components?.queryItems ?? []
    var query: [String: String] = [:]
    for item in queryItems where query[item.name] == nil {
      let maximumLength = item.name == "web_url" ? 2_048 : 128
      if let value = Self.bounded(item.value, maximumLength: maximumLength) {
        query[item.name] = value
      }
    }
    let path = url.path
    let isMarketPath = path == "/clip/market"
    let isWebPath = path == "/clip/web" || path.hasPrefix("/clip/web/")
    guard isMarketPath || isWebPath else {
      return nil
    }
    let campaignId = Self.safeIdentifier(query["campaign_id"])
    let clickId = Self.safeClickId(query["click_id"])
    // Same key the Android Play install referrer uses for the invite code.
    inviteCode = AppClipInviteCodeStore.sanitize(query["ref_code"])
    let requestedWebURL = query["web_url"].flatMap(URL.init(string:))
    let allowedWebURL = requestedWebURL.flatMap {
      CampaignURLPolicy.isAllowedEntry($0) ? $0 : nil
    }
    if isWebPath, let allowedWebURL {
      experience = .web(allowedWebURL)
    } else {
      experience = .market
    }
    apiBaseURL = URL(
      string: host == "app.onekeytest.com"
        ? "https://utility.onekeytest.com"
        : "https://utility.onekeycn.com"
    )!
    appLinkHost =
      host == "app.onekeytest.com"
      ? "app.onekeytest.com"
      : "app.onekey.so"
    let experienceName: String
    switch experience {
    case .market:
      experienceName = "market"
    case .web:
      experienceName = "web"
    }
    attribution = AppClipAttributionRecord(
      clickId: clickId,
      utmCampaign: query["utm_campaign"],
      utmContent: query["utm_content"],
      utmId: query["utm_id"],
      utmMedium: query["utm_medium"],
      utmSource: query["utm_source"],
      utmTerm: query["utm_term"],
      campaignId: campaignId,
      experience: experienceName,
      route: String(path.prefix(128)),
      selectedAddress: nil,
      selectedIsNative: nil,
      selectedNetwork: nil,
      selectedSymbol: nil,
      lastAction: "open",
      openedAt: Date(),
      updatedAt: Date()
    )
  }

  private static func bounded(_ value: String?, maximumLength: Int) -> String? {
    let value = value?.trimmingCharacters(in: .whitespacesAndNewlines)
    guard let value, !value.isEmpty else {
      return nil
    }
    return String(value.prefix(maximumLength))
  }

  private static func safeClickId(_ value: String?) -> String? {
    guard
      let value,
      value.range(of: "^[A-Za-z0-9_-]{22}$", options: .regularExpression) != nil
    else {
      return nil
    }
    return value
  }

  private static func safeIdentifier(_ value: String?) -> String? {
    guard
      let value,
      value.range(of: "^[A-Za-z0-9_.~-]{1,64}$", options: .regularExpression) != nil
    else {
      return nil
    }
    return value
  }
}

enum AppClipMarketTab: Int, CaseIterable, Identifiable {
  case stocks
  case perps
  case trending

  var id: Int { rawValue }
}

struct AppClipMarketListState<Item: Equatable>: Equatable {
  var items: [Item] = []
  var nextCursor: String?
  var isLoading = false
  var isLoadingMore = false
  var didLoad = false
  var failed = false
  var loadMoreFailed = false
  var lastUpdated: Date?
}

enum AppClipMarketDetail: Equatable {
  case token(AppClipMarketAsset)
  case stock(AppClipMarketStock)
  case perp(AppClipMarketPerp)
}

@MainActor
final class AppClipModel: ObservableObject {
  enum Screen {
    case market
    case detail(AppClipMarketDetail)
    case web(URL)
  }

  @Published var screen: Screen = .market
  @Published private(set) var selectedMarketTab = AppClipMarketTab.stocks
  @Published private(set) var stockCategories: [AppClipMarketCategory] = []
  @Published private(set) var perpsCategories: [AppClipMarketCategory] = []
  @Published private(set) var networks: [AppClipMarketNetwork] = []
  @Published private(set) var selectedStockCategoryId = "all"
  @Published private(set) var selectedPerpsCategoryId = "crypto"
  @Published private(set) var selectedNetworkId = ""
  @Published private(set) var selectedTimeRange = AppClipMarketTimeRange.oneHour
  @Published private(set) var isNetworkAvailable: Bool?
  @Published private var stockStates: [String: AppClipMarketListState<AppClipMarketStock>] = [:]
  @Published private var perpsStates: [String: AppClipMarketListState<AppClipMarketPerp>] = [:]
  @Published private var trendingStates: [String: AppClipMarketListState<AppClipMarketAsset>] = [:]
  @Published private var isLoadingConfiguration = false
  @Published private(set) var candles: [AppClipCandle] = []
  @Published private(set) var selectedInterval = "1m"
  @Published private(set) var isLoadingCandles = false
  @Published private(set) var candleLoadFailed = false
  @Published private(set) var isCloseOnlySeries = false

  private var attribution = AppClipAttributionRecord(
    clickId: nil,
    experience: "market",
    route: "/clip/market",
    selectedAddress: nil,
    selectedIsNative: nil,
    selectedNetwork: nil,
    lastAction: "open",
    openedAt: Date(),
    updatedAt: Date()
  )
  private var apiBaseURL = URL(string: "https://utility.onekeycn.com")!
  private var appLinkHost = "app.onekey.so"
  private var campaignWebURL: URL?
  private let marketService = AppClipMarketService()
  private let attributionService = AppClipAttributionService()
  private var refreshTask: Task<Void, Never>?
  private var configurationRequestID = UUID()
  private var stockRequestIDs: [String: UUID] = [:]
  private var stockLoadMoreRequestIDs: [String: UUID] = [:]
  private var perpsRequestIDs: [String: UUID] = [:]
  private var trendingRequestIDs: [String: UUID] = [:]
  private var candleRequestID = UUID()
  private var candleRequestDetail: AppClipMarketDetail?
  private var candleRequestInterval: String?
  private var environmentID = UUID()
  private var minLiquidity = 5_000.0
  private var configurationLastUpdated: Date?
  private var hasStarted = false
  private var hasHandledInvocation = false
  private var retryAfterNetworkRecovery = false
  private let networkMonitor = NWPathMonitor()
  private let networkMonitorQueue = DispatchQueue(label: "so.onekey.appclip.network")

  func start() {
    guard hasHandledInvocation, !hasStarted else {
      return
    }
    hasStarted = true
    startNetworkMonitoring()
    if shouldRefreshMarketContent {
      Task { await refreshAllMarketPages() }
    }
    refreshTask = Task { [weak self] in
      while !Task.isCancelled {
        try? await Task.sleep(nanoseconds: 60_000_000_000)
        guard !Task.isCancelled else {
          return
        }
        guard let self, self.shouldRefreshMarketContent else {
          continue
        }
        await self.refreshMarkets()
      }
    }
  }

  func appDidBecomeActive() {
    guard hasHandledInvocation else {
      return
    }
    if !hasStarted {
      start()
      return
    }
    guard shouldRefreshMarketContent, !isLoadingConfiguration else {
      return
    }
    refreshVisibleDetail()
    guard !isRefreshing else {
      return
    }
    if lastUpdated.map({ Date().timeIntervalSince($0) >= 15 }) ?? true {
      Task { await refreshMarkets() }
    }
  }

  func handleInvocation(_ url: URL) {
    guard let invocation = AppClipInvocation(url: url) else {
      return
    }
    let wasStarted = hasStarted
    let wasShowingWeb: Bool
    if case .web = screen {
      wasShowingWeb = true
    } else {
      wasShowingWeb = false
    }
    let environmentChanged = apiBaseURL != invocation.apiBaseURL
    hasHandledInvocation = true
    if environmentChanged {
      invalidateMarketRequests()
    }
    candleRequestID = UUID()
    attribution = invocation.attribution
    apiBaseURL = invocation.apiBaseURL
    appLinkHost = invocation.appLinkHost
    if environmentChanged {
      resetMarketData()
    }
    let needsInitialMarketLoad =
      wasShowingWeb
      && !isLoadingConfiguration
      && configurationLastUpdated == nil
      && stockStates.isEmpty
      && perpsStates.isEmpty
      && trendingStates.isEmpty
    AppClipAttributionStore.save(attribution)
    if let inviteCode = invocation.inviteCode {
      AppClipInviteCodeStore.save(code: inviteCode)
    }
    switch invocation.experience {
    case .market:
      campaignWebURL = nil
      screen = .market
    case .web(let url):
      campaignWebURL = url
      screen = .web(url)
    }
    start()
    let reportRecord = invocation.attribution
    let reportBaseURL = invocation.apiBaseURL
    Task {
      if
        case .market = invocation.experience,
        wasStarted,
        environmentChanged || needsInitialMarketLoad
      {
        await refreshAllMarketPages(force: environmentChanged)
      }
      await report(
        action: "open",
        record: reportRecord,
        baseURL: reportBaseURL
      )
    }
  }

  func refreshMarkets(force: Bool = false) async {
    if configurationLastUpdated.map({ Date().timeIntervalSince($0) >= 3_600 }) ?? true {
      await refreshConfiguration(force: force)
    }
    switch selectedMarketTab {
    case .stocks:
      await refreshStocks(force: force)
    case .perps:
      await refreshPerps(force: force)
    case .trending:
      await refreshTrending(force: force)
    }
  }

  func selectMarketTab(_ tab: AppClipMarketTab) {
    guard selectedMarketTab != tab else {
      return
    }
    selectedMarketTab = tab
    let shouldRefresh =
      !activeDidLoad
      || marketRefreshFailed
      || (lastUpdated.map { Date().timeIntervalSince($0) >= 15 } ?? true)
    guard !isRefreshing, shouldRefresh else {
      return
    }
    Task {
      guard selectedMarketTab == tab else {
        return
      }
      await refreshMarkets()
    }
  }

  func selectStockCategory(_ categoryId: String) {
    guard selectedStockCategoryId != categoryId else {
      return
    }
    selectedStockCategoryId = categoryId
    let state = stockStates[categoryId] ?? AppClipMarketListState()
    guard (!state.didLoad || state.failed), !state.isLoading else {
      return
    }
    Task { await refreshStocks() }
  }

  func selectPerpsCategory(_ categoryId: String) {
    guard selectedPerpsCategoryId != categoryId else {
      return
    }
    selectedPerpsCategoryId = categoryId
    let state = perpsStates[categoryId] ?? AppClipMarketListState()
    guard (!state.didLoad || state.failed), !state.isLoading else {
      return
    }
    Task { await refreshPerps() }
  }

  func selectNetwork(_ networkId: String) {
    guard selectedNetworkId != networkId else {
      return
    }
    selectedNetworkId = networkId
    refreshSelectedTrendingFilterIfNeeded()
  }

  func selectTimeRange(_ timeRange: AppClipMarketTimeRange) {
    guard selectedTimeRange != timeRange else {
      return
    }
    selectedTimeRange = timeRange
    refreshSelectedTrendingFilterIfNeeded()
  }

  func loadMoreStocks() {
    let categoryId = selectedStockCategoryId
    let key = categoryId
    guard
      var state = stockStates[key],
      let cursor = state.nextCursor,
      !state.isLoading,
      !state.isLoadingMore
    else {
      return
    }
    let requestID = UUID()
    let requestEnvironmentID = environmentID
    let requestBaseURL = apiBaseURL
    stockLoadMoreRequestIDs[key] = requestID
    state.isLoadingMore = true
    state.loadMoreFailed = false
    stockStates[key] = state
    Task {
      do {
        let page = try await marketService.fetchStocks(
          baseURL: requestBaseURL,
          category: categoryId == "all" ? nil : categoryId,
          cursor: cursor
        )
        guard
          environmentID == requestEnvironmentID,
          apiBaseURL == requestBaseURL,
          stockLoadMoreRequestIDs[key] == requestID,
          var current = stockStates[key]
        else {
          return
        }
        var knownIds = Set(current.items.map(\.id))
        current.items.append(contentsOf: page.items.filter { knownIds.insert($0.id).inserted })
        current.nextCursor = page.nextCursor
        current.isLoadingMore = false
        current.loadMoreFailed = false
        current.lastUpdated = Date()
        stockStates[key] = current
        retryMarketRefreshAfterNetworkRecoveryIfNeeded()
      } catch {
        guard
          environmentID == requestEnvironmentID,
          apiBaseURL == requestBaseURL,
          stockLoadMoreRequestIDs[key] == requestID,
          var current = stockStates[key]
        else {
          return
        }
        current.isLoadingMore = false
        current.loadMoreFailed = true
        stockStates[key] = current
        retryMarketRefreshAfterNetworkRecoveryIfNeeded()
      }
    }
  }

  var stockState: AppClipMarketListState<AppClipMarketStock> {
    stockStates[selectedStockCategoryId] ?? AppClipMarketListState()
  }

  var perpsState: AppClipMarketListState<AppClipMarketPerp> {
    perpsStates[selectedPerpsCategoryId] ?? AppClipMarketListState()
  }

  var trendingState: AppClipMarketListState<AppClipMarketAsset> {
    trendingStates[trendingKey] ?? AppClipMarketListState()
  }

  var assets: [AppClipMarketAsset] {
    trendingState.items
  }

  var isRefreshing: Bool {
    switch selectedMarketTab {
    case .stocks:
      return stockState.isLoading
    case .perps:
      return perpsState.isLoading
    case .trending:
      return trendingState.isLoading
    }
  }

  var marketRefreshFailed: Bool {
    switch selectedMarketTab {
    case .stocks:
      return stockState.failed
    case .perps:
      return perpsState.failed
    case .trending:
      return trendingState.failed
    }
  }

  var activeDidLoad: Bool {
    switch selectedMarketTab {
    case .stocks:
      return stockState.didLoad
    case .perps:
      return perpsState.didLoad
    case .trending:
      return trendingState.didLoad
    }
  }

  var activeIsEmpty: Bool {
    switch selectedMarketTab {
    case .stocks:
      return stockState.items.isEmpty
    case .perps:
      return perpsState.items.isEmpty
    case .trending:
      return trendingState.items.isEmpty
    }
  }

  var lastUpdated: Date? {
    switch selectedMarketTab {
    case .stocks:
      return stockState.lastUpdated
    case .perps:
      return perpsState.lastUpdated
    case .trending:
      return trendingState.lastUpdated
    }
  }

  private var trendingKey: String {
    "\(selectedNetworkId)|\(selectedTimeRange.rawValue)"
  }

  private var shouldRefreshMarketContent: Bool {
    if case .web = screen {
      return false
    }
    return true
  }

  private func refreshAllMarketPages(force: Bool = false) async {
    let requestEnvironmentID = environmentID
    await refreshConfiguration(force: force)
    guard environmentID == requestEnvironmentID else {
      return
    }
    async let stocks: Void = refreshStocks(force: force)
    async let perps: Void = refreshPerps(force: force)
    async let trending: Void = refreshTrending(force: force)
    _ = await (stocks, perps, trending)
  }

  private func refreshConfiguration(force: Bool = false) async {
    guard force || !isLoadingConfiguration else {
      return
    }
    let requestID = UUID()
    let requestEnvironmentID = environmentID
    let requestBaseURL = apiBaseURL
    configurationRequestID = requestID
    isLoadingConfiguration = true
    defer {
      if configurationRequestID == requestID {
        isLoadingConfiguration = false
      }
    }
    do {
      let configuration = try await marketService.fetchConfiguration(baseURL: requestBaseURL)
      guard
        environmentID == requestEnvironmentID,
        apiBaseURL == requestBaseURL,
        configurationRequestID == requestID
      else {
        return
      }
      networks = configuration.networks
      stockCategories = configuration.stockCategories
      perpsCategories = configuration.perpsCategories
      minLiquidity = configuration.minLiquidity
      configurationLastUpdated = Date()
      synchronizeSelectedFilters()
    } catch {
      guard
        environmentID == requestEnvironmentID,
        apiBaseURL == requestBaseURL,
        configurationRequestID == requestID
      else {
        return
      }
    }
  }

  private func refreshStocks(force: Bool = false) async {
    let categoryId = selectedStockCategoryId
    let key = categoryId
    var state = stockStates[key] ?? AppClipMarketListState()
    guard force || (!state.isLoading && !state.isLoadingMore) else {
      return
    }
    let requestID = UUID()
    let requestEnvironmentID = environmentID
    let requestBaseURL = apiBaseURL
    let requestLimit = max(20, state.items.count)
    stockRequestIDs[key] = requestID
    stockLoadMoreRequestIDs[key] = UUID()
    state.isLoading = true
    state.failed = false
    state.isLoadingMore = false
    state.loadMoreFailed = false
    stockStates[key] = state
    do {
      let page = try await marketService.fetchStocks(
        baseURL: requestBaseURL,
        category: categoryId == "all" ? nil : categoryId,
        limit: requestLimit
      )
      guard
        environmentID == requestEnvironmentID,
        apiBaseURL == requestBaseURL,
        stockRequestIDs[key] == requestID
      else {
        return
      }
      var current = stockStates[key] ?? AppClipMarketListState()
      current.items = page.items
      current.nextCursor = page.nextCursor
      current.isLoading = false
      current.didLoad = true
      current.failed = false
      current.lastUpdated = Date()
      stockStates[key] = current
      if case .detail(.stock(let visibleStock)) = screen {
        let refreshedStock = page.items.first(where: { $0.id == visibleStock.id }) ?? visibleStock
        refreshVisibleDetail(with: .stock(refreshedStock))
      }
      retryMarketRefreshAfterNetworkRecoveryIfNeeded()
    } catch {
      guard
        environmentID == requestEnvironmentID,
        apiBaseURL == requestBaseURL,
        stockRequestIDs[key] == requestID
      else {
        return
      }
      var current = stockStates[key] ?? AppClipMarketListState()
      current.isLoading = false
      current.failed = true
      stockStates[key] = current
      retryMarketRefreshAfterNetworkRecoveryIfNeeded()
    }
  }

  private func refreshPerps(force: Bool = false) async {
    let categoryId = selectedPerpsCategoryId
    let key = categoryId
    var state = perpsStates[key] ?? AppClipMarketListState()
    guard force || !state.isLoading else {
      return
    }
    let requestID = UUID()
    let requestEnvironmentID = environmentID
    let requestBaseURL = apiBaseURL
    perpsRequestIDs[key] = requestID
    state.isLoading = true
    state.failed = false
    perpsStates[key] = state
    do {
      let items = try await marketService.fetchPerps(
        baseURL: requestBaseURL,
        category: categoryId
      )
      guard
        environmentID == requestEnvironmentID,
        apiBaseURL == requestBaseURL,
        perpsRequestIDs[key] == requestID
      else {
        return
      }
      var current = perpsStates[key] ?? AppClipMarketListState()
      current.items = items
      current.isLoading = false
      current.didLoad = true
      current.failed = false
      current.lastUpdated = Date()
      perpsStates[key] = current
      if case .detail(.perp(let visiblePerp)) = screen {
        let refreshedPerp = items.first(where: { $0.id == visiblePerp.id }) ?? visiblePerp
        refreshVisibleDetail(with: .perp(refreshedPerp))
      }
      retryMarketRefreshAfterNetworkRecoveryIfNeeded()
    } catch {
      guard
        environmentID == requestEnvironmentID,
        apiBaseURL == requestBaseURL,
        perpsRequestIDs[key] == requestID
      else {
        return
      }
      var current = perpsStates[key] ?? AppClipMarketListState()
      current.isLoading = false
      current.failed = true
      perpsStates[key] = current
      retryMarketRefreshAfterNetworkRecoveryIfNeeded()
    }
  }

  private func refreshTrending(force: Bool = false) async {
    let key = trendingKey
    let networkId = selectedNetworkId
    let timeRange = selectedTimeRange
    let requestNetworks = networks
    let requestMinLiquidity = minLiquidity
    var state = trendingStates[key] ?? AppClipMarketListState()
    guard force || !state.isLoading else {
      return
    }
    let requestID = UUID()
    let requestEnvironmentID = environmentID
    let requestBaseURL = apiBaseURL
    trendingRequestIDs[key] = requestID
    state.isLoading = true
    state.failed = false
    trendingStates[key] = state
    do {
      let items = try await marketService.fetchMarketAssets(
        baseURL: requestBaseURL,
        networkId: networkId,
        timeRange: timeRange,
        minLiquidity: requestMinLiquidity,
        networks: requestNetworks
      )
      guard
        environmentID == requestEnvironmentID,
        apiBaseURL == requestBaseURL,
        trendingRequestIDs[key] == requestID
      else {
        return
      }
      var current = trendingStates[key] ?? AppClipMarketListState()
      current.items = items
      current.isLoading = false
      current.didLoad = true
      current.failed = false
      current.lastUpdated = Date()
      trendingStates[key] = current
      if case .detail(.token(let visibleAsset)) = screen {
        let refreshedAsset = items.first(where: { $0.id == visibleAsset.id }) ?? visibleAsset
        refreshVisibleDetail(with: .token(refreshedAsset))
      }
      retryMarketRefreshAfterNetworkRecoveryIfNeeded()
    } catch {
      guard
        environmentID == requestEnvironmentID,
        apiBaseURL == requestBaseURL,
        trendingRequestIDs[key] == requestID
      else {
        return
      }
      var current = trendingStates[key] ?? AppClipMarketListState()
      current.isLoading = false
      current.failed = true
      trendingStates[key] = current
      retryMarketRefreshAfterNetworkRecoveryIfNeeded()
    }
  }

  private func synchronizeSelectedFilters() {
    if
      !stockCategories.isEmpty,
      !stockCategories.contains(where: { $0.id == selectedStockCategoryId })
    {
      selectedStockCategoryId =
        stockCategories.first(where: { $0.id == "all" })?.id ?? stockCategories[0].id
    }
    if
      !perpsCategories.isEmpty,
      !perpsCategories.contains(where: { $0.id == selectedPerpsCategoryId })
    {
      selectedPerpsCategoryId =
        perpsCategories.first(where: { $0.id == "crypto" })?.id ?? perpsCategories[0].id
    }
    if
      !selectedNetworkId.isEmpty,
      !networks.contains(where: { $0.id == selectedNetworkId })
    {
      selectedNetworkId = ""
    }
  }

  private func refreshSelectedTrendingFilterIfNeeded() {
    let state = trendingStates[trendingKey] ?? AppClipMarketListState()
    guard (!state.didLoad || state.failed), !state.isLoading else {
      return
    }
    Task { await refreshTrending() }
  }

  private func startNetworkMonitoring() {
    networkMonitor.pathUpdateHandler = { [weak self] path in
      let isAvailable = path.status == .satisfied
      Task { @MainActor [weak self] in
        self?.handleNetworkStatus(isAvailable)
      }
    }
    networkMonitor.start(queue: networkMonitorQueue)
  }

  private func handleNetworkStatus(_ isAvailable: Bool) {
    let previousStatus = isNetworkAvailable
    isNetworkAvailable = isAvailable
    guard
      previousStatus == false,
      isAvailable,
      shouldRefreshMarketContent,
      marketRefreshFailed || !activeDidLoad || activeIsEmpty
    else {
      return
    }
    guard !isLoadingConfiguration, !isRefreshing else {
      retryAfterNetworkRecovery = true
      return
    }
    Task { await refreshMarkets(force: true) }
  }

  private func retryMarketRefreshAfterNetworkRecoveryIfNeeded() {
    guard retryAfterNetworkRecovery, !isRefreshing else {
      return
    }
    retryAfterNetworkRecovery = false
    guard
      shouldRefreshMarketContent,
      marketRefreshFailed || !activeDidLoad || activeIsEmpty
    else {
      return
    }
    Task { await refreshMarkets(force: true) }
  }

  private func invalidateMarketRequests() {
    environmentID = UUID()
    configurationRequestID = UUID()
    stockRequestIDs.removeAll()
    stockLoadMoreRequestIDs.removeAll()
    perpsRequestIDs.removeAll()
    trendingRequestIDs.removeAll()
    retryAfterNetworkRecovery = false
    isLoadingConfiguration = false
    stockStates = stockStates.mapValues { state in
      var state = state
      state.isLoading = false
      state.isLoadingMore = false
      return state
    }
    perpsStates = perpsStates.mapValues { state in
      var state = state
      state.isLoading = false
      return state
    }
    trendingStates = trendingStates.mapValues { state in
      var state = state
      state.isLoading = false
      return state
    }
  }

  private func resetMarketData() {
    stockCategories = []
    perpsCategories = []
    networks = []
    selectedStockCategoryId = "all"
    selectedPerpsCategoryId = "crypto"
    selectedNetworkId = ""
    selectedTimeRange = .oneHour
    stockStates = [:]
    perpsStates = [:]
    trendingStates = [:]
    minLiquidity = 5_000
    configurationLastUpdated = nil
  }

  func select(_ asset: AppClipMarketAsset) {
    setSelectedAsset(asset)
    showDetail(.token(asset), initialInterval: "1m")
  }

  func select(_ stock: AppClipMarketStock) {
    clearSelectedAsset()
    showDetail(.stock(stock), initialInterval: "1D")
  }

  func select(_ perp: AppClipMarketPerp) {
    clearSelectedAsset()
    showDetail(.perp(perp), initialInterval: "1H")
  }

  func selectDetailInterval(_ interval: String, detail: AppClipMarketDetail) async {
    guard isSameDetail(detail, as: screen) else {
      return
    }
    guard interval != selectedInterval || candles.isEmpty else {
      return
    }
    selectedInterval = interval
    let candleRequest = prepareCandleRequest(for: detail, interval: interval)
    await loadDetailCandles(
      detail: detail,
      interval: interval,
      requestID: candleRequest.id,
      requestEnvironmentID: candleRequest.environmentID,
      baseURL: candleRequest.baseURL
    )
  }

  func retryDetailCandles(detail: AppClipMarketDetail) {
    guard isSameDetail(detail, as: screen) else {
      return
    }
    let interval = selectedInterval
    let candleRequest = prepareCandleRequest(for: detail, interval: interval)
    Task {
      await loadDetailCandles(
        detail: detail,
        interval: interval,
        requestID: candleRequest.id,
        requestEnvironmentID: candleRequest.environmentID,
        baseURL: candleRequest.baseURL
      )
    }
  }

  func showMarket() {
    candleRequestID = UUID()
    screen = .market
  }

  func recordInstallCTA(asset: AppClipMarketAsset? = nil) -> URL? {
    if let asset {
      setSelectedAsset(asset)
    } else {
      attribution.selectedAddress = nil
      attribution.selectedIsNative = nil
      attribution.selectedNetwork = nil
      attribution.selectedSymbol = nil
    }
    attribution.lastAction = "install_cta"
    attribution.updatedAt = Date()
    AppClipAttributionStore.save(attribution)
    let reportRecord = attribution
    let reportBaseURL = apiBaseURL
    Task {
      await report(
        action: "install_cta",
        record: reportRecord,
        baseURL: reportBaseURL
      )
    }
    return fullAppURL(asset: asset)
  }

  var campaignToken: String? {
    attribution.campaignId
  }

  private func setSelectedAsset(_ asset: AppClipMarketAsset) {
    attribution.selectedAddress = asset.address
    attribution.selectedIsNative = asset.isNative
    attribution.selectedNetwork = asset.networkId
    attribution.selectedSymbol = asset.symbol
  }

  private func clearSelectedAsset() {
    attribution.selectedAddress = nil
    attribution.selectedIsNative = nil
    attribution.selectedNetwork = nil
    attribution.selectedSymbol = nil
  }

  private func showDetail(
    _ detail: AppClipMarketDetail,
    initialInterval: String
  ) {
    screen = .detail(detail)
    candles = []
    selectedInterval = initialInterval
    candleLoadFailed = false
    isCloseOnlySeries = false
    attribution.lastAction = "market_select"
    attribution.updatedAt = Date()
    AppClipAttributionStore.save(attribution)
    let reportRecord = attribution
    let reportBaseURL = apiBaseURL
    let candleRequest = prepareCandleRequest(for: detail, interval: initialInterval)
    Task {
      await loadDetailCandles(
        detail: detail,
        interval: initialInterval,
        requestID: candleRequest.id,
        requestEnvironmentID: candleRequest.environmentID,
        baseURL: candleRequest.baseURL
      )
    }
    Task {
      await report(
        action: "market_select",
        record: reportRecord,
        baseURL: reportBaseURL
      )
    }
  }

  private func fullAppURL(asset: AppClipMarketAsset?) -> URL? {
    var components = URLComponents()
    components.scheme = "https"
    components.host = appLinkHost
    components.path = campaignWebURL == nil ? "/clip/market" : "/clip/web"
    var queryItems = [
      URLQueryItem(name: "click_id", value: attribution.clickId),
      URLQueryItem(name: "campaign_id", value: attribution.campaignId),
      URLQueryItem(name: "utm_campaign", value: attribution.utmCampaign),
      URLQueryItem(name: "utm_content", value: attribution.utmContent),
      URLQueryItem(name: "utm_id", value: attribution.utmId),
      URLQueryItem(name: "utm_medium", value: attribution.utmMedium),
      URLQueryItem(name: "utm_source", value: attribution.utmSource),
      URLQueryItem(name: "utm_term", value: attribution.utmTerm),
    ]
    if let campaignWebURL {
      queryItems.append(URLQueryItem(name: "web_url", value: campaignWebURL.absoluteString))
    } else if let asset {
      queryItems.append(contentsOf: [
        URLQueryItem(name: "symbol", value: asset.symbol),
        URLQueryItem(name: "network", value: asset.networkId),
        URLQueryItem(name: "address", value: asset.address),
        URLQueryItem(name: "is_native", value: String(asset.isNative)),
      ])
    }
    components.queryItems = queryItems.filter { $0.value != nil }
    return components.url
  }

  private func refreshVisibleDetail(with refreshedDetail: AppClipMarketDetail? = nil) {
    guard case .detail(let currentDetail) = screen else {
      return
    }
    let detail = refreshedDetail ?? currentDetail
    guard isSameDetail(detail, as: screen) else {
      return
    }
    if detail != currentDetail {
      screen = .detail(detail)
    }
    let interval = selectedInterval
    guard !hasPendingCandleRequest(for: detail, interval: interval) else {
      return
    }
    let candleRequest = prepareCandleRequest(
      for: detail,
      interval: interval,
      clearsExistingCandles: false
    )
    Task {
      await loadDetailCandles(
        detail: detail,
        interval: interval,
        requestID: candleRequest.id,
        requestEnvironmentID: candleRequest.environmentID,
        baseURL: candleRequest.baseURL
      )
    }
  }

  private func hasPendingCandleRequest(
    for detail: AppClipMarketDetail,
    interval: String
  ) -> Bool {
    guard
      isLoadingCandles,
      candleRequestInterval == interval,
      let candleRequestDetail
    else {
      return false
    }
    return hasSameDetailIdentity(detail, candleRequestDetail)
  }

  private func prepareCandleRequest(
    for detail: AppClipMarketDetail,
    interval: String,
    clearsExistingCandles: Bool = true
  ) -> (id: UUID, environmentID: UUID, baseURL: URL) {
    let requestID = UUID()
    candleRequestID = requestID
    candleRequestDetail = detail
    candleRequestInterval = interval
    isLoadingCandles = true
    candleLoadFailed = false
    if clearsExistingCandles {
      candles = []
    }
    return (requestID, environmentID, apiBaseURL)
  }

  private func loadDetailCandles(
    detail: AppClipMarketDetail,
    interval: String,
    requestID: UUID,
    requestEnvironmentID: UUID,
    baseURL: URL
  ) async {
    defer {
      if candleRequestID == requestID {
        isLoadingCandles = false
        candleRequestDetail = nil
        candleRequestInterval = nil
      }
    }
    do {
      let result: AppClipKlineResult
      switch detail {
      case .token(let asset):
        result = try await marketService.fetchCandles(
          asset: asset,
          interval: interval,
          baseURL: baseURL
        )
      case .stock(let stock):
        result = try await marketService.fetchStockCandles(
          stockID: stock.id,
          period: interval.lowercased(),
          baseURL: baseURL
        )
      case .perp(let perp):
        let timeTo = Int(Date().timeIntervalSince1970)
        let timeFrom = timeTo - Self.perpCandleTimeSpan(for: interval)
        result = try await marketService.fetchPerpCandles(
          coin: perp.id,
          interval: interval.lowercased(),
          timeFrom: timeFrom,
          timeTo: timeTo
        )
      }
      guard
        isCurrentCandleRequest(
          requestID: requestID,
          requestEnvironmentID: requestEnvironmentID,
          baseURL: baseURL,
          detail: detail,
          interval: interval
        )
      else {
        return
      }
      guard !result.candles.isEmpty else {
        candleLoadFailed = true
        return
      }
      candles = result.candles
      isCloseOnlySeries = result.isCloseOnly
    } catch {
      guard
        isCurrentCandleRequest(
          requestID: requestID,
          requestEnvironmentID: requestEnvironmentID,
          baseURL: baseURL,
          detail: detail,
          interval: interval
        )
      else {
        return
      }
      candleLoadFailed = true
      isCloseOnlySeries = false
    }
  }

  private func isCurrentCandleRequest(
    requestID: UUID,
    requestEnvironmentID: UUID,
    baseURL: URL,
    detail: AppClipMarketDetail,
    interval: String
  ) -> Bool {
    guard
      candleRequestID == requestID,
      environmentID == requestEnvironmentID,
      apiBaseURL == baseURL,
      selectedInterval == interval,
      isSameDetail(detail, as: screen)
    else {
      return false
    }
    return true
  }

  private func isSameDetail(
    _ detail: AppClipMarketDetail,
    as screen: Screen
  ) -> Bool {
    guard case .detail(let currentDetail) = screen else {
      return false
    }
    return hasSameDetailIdentity(detail, currentDetail)
  }

  private func hasSameDetailIdentity(
    _ first: AppClipMarketDetail,
    _ second: AppClipMarketDetail
  ) -> Bool {
    switch (first, second) {
    case (.token(let requested), .token(let current)):
      return requested.id == current.id
    case (.stock(let requested), .stock(let current)):
      return requested.id == current.id
    case (.perp(let requested), .perp(let current)):
      return requested.id == current.id
    default:
      return false
    }
  }

  private static func perpCandleTimeSpan(for interval: String) -> Int {
    switch interval.lowercased() {
    case "1m":
      return 2 * 24 * 60 * 60
    case "15m":
      return 7 * 24 * 60 * 60
    case "1h":
      return 30 * 24 * 60 * 60
    case "4h":
      return 90 * 24 * 60 * 60
    default:
      return 7 * 24 * 60 * 60
    }
  }

  private func report(
    action: String,
    record: AppClipAttributionRecord,
    baseURL: URL
  ) async {
    guard record.clickId != nil else {
      return
    }
    try? await attributionService.report(
      record: record,
      action: action,
      baseURL: baseURL
    )
  }
}

private struct AppClipAttributionEventRequest: Encodable {
  let action: String
  let campaignId: String?
  let clickId: String
  let experience: String
  let route: String
  let selectedAddress: String?
  let selectedIsNative: Bool?
  let selectedNetwork: String?
  let selectedSymbol: String?
}

private actor AppClipAttributionService {
  func report(
    record: AppClipAttributionRecord,
    action: String,
    baseURL: URL
  ) async throws {
    guard let clickId = record.clickId else {
      return
    }
    let endpoint = baseURL.appendingPathComponent(
      "/utility/v1/app-clip-attribution/event"
    )
    var request = URLRequest(url: endpoint)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
    request.setValue("OneKeyWallet/\(version ?? "1")", forHTTPHeaderField: "User-Agent")
    request.setValue("ios", forHTTPHeaderField: "x-onekey-request-platform")
    request.timeoutInterval = 8
    request.httpBody = try JSONEncoder().encode(
      AppClipAttributionEventRequest(
        action: action,
        campaignId: record.campaignId,
        clickId: clickId,
        experience: record.experience,
        route: record.route,
        selectedAddress: record.selectedAddress.flatMap { $0.isEmpty ? nil : $0 },
        selectedIsNative: record.selectedIsNative,
        selectedNetwork: record.selectedNetwork,
        selectedSymbol: record.selectedSymbol
      )
    )
    let (_, response) = try await URLSession.shared.data(for: request)
    guard
      let response = response as? HTTPURLResponse,
      (200..<300).contains(response.statusCode)
    else {
      throw URLError(.badServerResponse)
    }
  }
}
