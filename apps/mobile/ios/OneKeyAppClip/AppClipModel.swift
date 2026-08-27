import Foundation

struct AppClipInvocation {
  enum Experience {
    case market
    case web(URL)
  }

  let attribution: AppClipAttributionRecord
  let experience: Experience
  let apiBaseURL: URL
  let appLinkHost: String

  init(url: URL) {
    let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
    let queryItems = components?.queryItems ?? []
    var query: [String: String] = [:]
    for item in queryItems where query[item.name] == nil {
      let maximumLength = item.name == "web_url" ? 2_048 : 128
      if let value = Self.bounded(item.value, maximumLength: maximumLength) {
        query[item.name] = value
      }
    }
    let path = url.path.isEmpty ? "/clip/market" : url.path
    let campaignId = Self.safeIdentifier(query["campaign_id"])
    let clickId = Self.safeClickId(query["click_id"])
    let requestedWebURL = query["web_url"].flatMap(URL.init(string:))
    let isWebPath = path.hasPrefix("/clip/web")
    let allowedWebURL = requestedWebURL.flatMap {
      CampaignURLPolicy.isAllowed($0) ? $0 : nil
    }
    if isWebPath, let allowedWebURL {
      experience = .web(allowedWebURL)
    } else {
      experience = .market
    }
    apiBaseURL = URL(
      string: url.host?.lowercased() == "app.onekeytest.com"
        ? "https://utility.onekeytest.com"
        : "https://utility.onekeycn.com"
    )!
    appLinkHost =
      url.host?.lowercased() == "app.onekeytest.com"
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

@MainActor
final class AppClipModel: ObservableObject {
  enum Screen {
    case market
    case detail(AppClipMarketAsset)
    case web(URL)
  }

  @Published private(set) var assets: [AppClipMarketAsset] = []
  @Published var screen: Screen = .market
  @Published private(set) var isRefreshing = false
  @Published private(set) var marketRefreshFailed = false
  @Published private(set) var lastUpdated: Date?
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
  private var marketRequestID = UUID()
  private var candleRequestID = UUID()
  private var hasStarted = false

  func start() {
    guard !hasStarted else {
      return
    }
    hasStarted = true
    Task { await refreshMarkets() }
    refreshTask = Task { [weak self] in
      while !Task.isCancelled {
        try? await Task.sleep(nanoseconds: 60_000_000_000)
        guard !Task.isCancelled else {
          return
        }
        await self?.refreshMarkets()
      }
    }
  }

  func appDidBecomeActive() {
    start()
    guard
      !isRefreshing,
      lastUpdated.map({ Date().timeIntervalSince($0) >= 15 }) ?? true
    else {
      return
    }
    Task { await refreshMarkets() }
  }

  func handleInvocation(_ url: URL) {
    let invocation = AppClipInvocation(url: url)
    marketRequestID = UUID()
    candleRequestID = UUID()
    attribution = invocation.attribution
    apiBaseURL = invocation.apiBaseURL
    appLinkHost = invocation.appLinkHost
    AppClipAttributionStore.save(attribution)
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
      await refreshMarkets(force: true)
      await report(
        action: "open",
        record: reportRecord,
        baseURL: reportBaseURL
      )
    }
  }

  func refreshMarkets(force: Bool = false) async {
    guard force || !isRefreshing else {
      return
    }
    let requestID = UUID()
    let requestBaseURL = apiBaseURL
    marketRequestID = requestID
    isRefreshing = true
    defer {
      if marketRequestID == requestID {
        isRefreshing = false
      }
    }
    do {
      let result = try await marketService.fetchMarketAssets(baseURL: requestBaseURL)
      guard marketRequestID == requestID, apiBaseURL == requestBaseURL else {
        return
      }
      guard !result.isEmpty else {
        throw URLError(.zeroByteResource)
      }
      assets = result
      lastUpdated = Date()
      marketRefreshFailed = false
    } catch {
      guard marketRequestID == requestID, apiBaseURL == requestBaseURL else {
        return
      }
      marketRefreshFailed = true
    }
  }

  func select(_ asset: AppClipMarketAsset) {
    let initialInterval = "1m"
    screen = .detail(asset)
    candles = []
    selectedInterval = initialInterval
    candleLoadFailed = false
    isCloseOnlySeries = false
    setSelectedAsset(asset)
    attribution.lastAction = "market_select"
    attribution.updatedAt = Date()
    AppClipAttributionStore.save(attribution)
    let reportRecord = attribution
    let reportBaseURL = apiBaseURL
    let candleRequest = prepareCandleRequest()
    Task {
      await loadCandles(
        asset: asset,
        interval: initialInterval,
        requestID: candleRequest.id,
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

  func selectInterval(_ interval: String, asset: AppClipMarketAsset) async {
    guard interval != selectedInterval || candles.isEmpty else {
      return
    }
    selectedInterval = interval
    let candleRequest = prepareCandleRequest()
    await loadCandles(
      asset: asset,
      interval: interval,
      requestID: candleRequest.id,
      baseURL: candleRequest.baseURL
    )
  }

  func retryCandles(asset: AppClipMarketAsset) {
    let interval = selectedInterval
    let candleRequest = prepareCandleRequest()
    Task {
      await loadCandles(
        asset: asset,
        interval: interval,
        requestID: candleRequest.id,
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

  private func prepareCandleRequest() -> (id: UUID, baseURL: URL) {
    let requestID = UUID()
    candleRequestID = requestID
    isLoadingCandles = true
    candleLoadFailed = false
    candles = []
    return (requestID, apiBaseURL)
  }

  private func loadCandles(
    asset: AppClipMarketAsset,
    interval: String,
    requestID: UUID,
    baseURL: URL
  ) async {
    defer {
      if candleRequestID == requestID {
        isLoadingCandles = false
      }
    }
    do {
      let result = try await marketService.fetchCandles(
        asset: asset,
        interval: interval,
        baseURL: baseURL
      )
      guard
        isCurrentCandleRequest(
          requestID: requestID,
          baseURL: baseURL,
          assetID: asset.id,
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
          baseURL: baseURL,
          assetID: asset.id,
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
    baseURL: URL,
    assetID: AppClipMarketAsset.ID,
    interval: String
  ) -> Bool {
    guard
      candleRequestID == requestID,
      apiBaseURL == baseURL,
      selectedInterval == interval,
      case .detail(let currentAsset) = screen
    else {
      return false
    }
    return currentAsset.id == assetID
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
