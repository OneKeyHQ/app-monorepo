import Foundation
import ImageIO
import UniformTypeIdentifiers

actor MarketWidgetService {
  static let shared = MarketWidgetService()
  private let store: MarketWidgetStore
  private let session: URLSession
  private var trendingRequest: Task<MarketWidgetCatalog, Error>?
  private var requests: [String: Task<MarketWidgetQuote, Error>] = [:]
  private var chartRequests: [String: Task<MarketWidgetQuote, Error>] = [:]
  private var searchRequests: [String: (id: UUID, task: Task<[MarketWidgetAsset], Error>)] = [:]
  private var searchCache: [String: (assets: [MarketWidgetAsset], fetchedAt: Date)] = [:]
  private var suggestionRefresh: (id: UUID, task: Task<Void, Never>)?
  private var editorMetadataRequest: Task<Void, Never>?

  init(store: MarketWidgetStore = MarketWidgetStore(), session: URLSession = .shared) {
    self.store = store
    self.session = session
  }

  func quote(for asset: MarketWidgetAsset, locale: String, includingChart: Bool = false,
             force: Bool = false) async throws -> MarketWidgetQuote {
    guard store.permitsRequests(for: asset) else { throw MarketWidgetError.invalidConfiguration }
    var quote = try await price(for: asset, locale: locale, force: force)
    if includingChart && asset.kind != .stock { quote = await withChart(quote, asset: asset, locale: locale) }
    guard store.permitsRequests(for: asset) else { throw MarketWidgetError.invalidConfiguration }
    return quote.merging(store.quote(for: asset))
  }

  private func price(for asset: MarketWidgetAsset, locale: String, force: Bool) async throws -> MarketWidgetQuote {
    if let cached = store.quote(for: asset),
       Date().timeIntervalSince(cached.fetchedAt) < (force ? 15 : 300) { return cached }
    if let request = requests[asset.id] { return try await request.value }
    let request = Task {
      let quote = try await Self.fetch(asset: asset, locale: locale, store: store, session: session)
      try? store.saveQuote(quote)
      return quote
    }
    requests[asset.id] = request
    defer { requests[asset.id] = nil }
    return try await request.value
  }

  private func withChart(_ quote: MarketWidgetQuote, asset: MarketWidgetAsset, locale: String) async -> MarketWidgetQuote {
    let current = quote.merging(store.quote(for: asset))
    if current.chart != nil, let fetchedAt = current.chartFetchedAt,
       Date().timeIntervalSince(fetchedAt) < 900 { return current }
    if let request = chartRequests[asset.id] {
      return current.merging(try? await request.value)
    }
    let request = Task {
      let points = try await Self.fetchChart(asset: asset, locale: locale, store: store, session: session)
      guard store.permitsRequests(for: asset) else { throw MarketWidgetError.invalidConfiguration }
      var updated = quote
      updated.chart = points
      updated.chartFetchedAt = Date()
      try? store.saveQuote(updated)
      return updated
    }
    chartRequests[asset.id] = request
    defer { chartRequests[asset.id] = nil }
    return current.merging(try? await request.value)
  }

  func trending(locale: String) async throws -> MarketWidgetCatalog {
    guard let configuration = store.configuration().configuration, configuration.privacyMasked != true else {
      throw MarketWidgetError.invalidConfiguration
    }
    if let cached = store.trending(), Date().timeIntervalSince(cached.fetchedAt) < 900 { return cached }
    if let trendingRequest { return try await trendingRequest.value }
    let task = Task {
      var request = try Self.request(for: MarketWidgetAsset.defaults[0], locale: locale)
      request.url = URL(string: "https://utility.onekeycn.com/utility/v2/market/trending")
      let catalog = try Self.decodeTrending(try await Self.response(for: request, session: session), fetchedAt: Date())
      try store.saveTrending(catalog)
      return catalog
    }
    trendingRequest = task
    defer { trendingRequest = nil }
    return try await task.value
  }

  func suggestedAssets(locale: String) async -> [MarketWidgetAsset] {
    guard permitsCatalogRequests else { clearSearches(); return [] }
    guard !Task.isCancelled else { return [] }
    var assets = store.assets(for: .watchlist) + store.assets(for: .hot)
    if assets.isEmpty {
      _ = try? await trending(locale: locale)
      assets = store.assets(for: .watchlist) + store.assets(for: .hot)
    } else if suggestionRefresh == nil {
      let id = UUID()
      let task = Task {
        _ = try? await trending(locale: locale)
        if suggestionRefresh?.id == id { suggestionRefresh = nil }
      }
      suggestionRefresh = (id, task)
    }
    guard !Task.isCancelled, permitsCatalogRequests else { return [] }
    var seen = Set<String>()
    let suggestions = (assets.isEmpty ? MarketWidgetAsset.defaults : assets)
      .filter { seen.insert($0.id).inserted }
    // Suggestion rows use available display metadata without fetching a quote for every candidate.
    let enriched = suggestions.map { store.assetWithMetadata($0) }
    try? store.cacheLockScreenCandidates(enriched)
    guard !Task.isCancelled, permitsCatalogRequests else { return [] }
    return enriched
  }

  func search(query: String, locale: String) async throws -> [MarketWidgetAsset] {
    try Task.checkCancellation()
    guard permitsCatalogRequests else { clearSearches(); throw MarketWidgetError.privacyMasked }
    let query = query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !query.isEmpty else { return await suggestedAssets(locale: locale) }
    guard query.count <= 200, !query.unicodeScalars.contains(where: CharacterSet.controlCharacters.contains) else {
      throw MarketWidgetError.invalidConfiguration
    }
    let key = locale + "|" + query
    searchCache = searchCache.filter { Date().timeIntervalSince($0.value.fetchedAt) < 300 }
    if let cached = searchCache[key] {
      try store.cacheLockScreenCandidates(cached.assets)
      return cached.assets
    }
    // System search calls can arrive for each keystroke; canceled prefixes must not start network requests.
    try await Task.sleep(nanoseconds: 250_000_000)
    guard permitsCatalogRequests else { clearSearches(); throw MarketWidgetError.privacyMasked }
    if let cached = searchCache[key] {
      try store.cacheLockScreenCandidates(cached.assets)
      return cached.assets
    }
    let request: (id: UUID, task: Task<[MarketWidgetAsset], Error>)
    if let pending = searchRequests[key] { request = pending }
    else {
      request = (UUID(), Task {
        async let tokens = try? Self.decodeSearch(await Self.response(
          for: Self.searchRequest(query: query, locale: locale), session: session))
        async let stocks = try? Self.decodeStockSearch(await Self.response(
          for: Self.searchRequest(query: query, locale: locale, stocks: true), session: session))
        let results = await (tokens, stocks)
        guard results.0 != nil || results.1 != nil else { throw MarketWidgetError.invalidResponse }
        var seen = Set<String>()
        return ((results.0 ?? []) + (results.1 ?? [])).filter { seen.insert($0.id).inserted }
      })
      searchRequests[key] = request
    }
    defer { if searchRequests[key]?.id == request.id { searchRequests[key] = nil } }
    let assets = try await request.task.value
    try Task.checkCancellation()
    guard permitsCatalogRequests else { clearSearches(); throw MarketWidgetError.privacyMasked }
    try store.cacheLockScreenCandidates(assets)
    if searchCache.count >= 20, let oldest = searchCache.min(by: { $0.value.fetchedAt < $1.value.fetchedAt })?.key {
      searchCache[oldest] = nil
    }
    searchCache[key] = (assets, Date())
    return assets
  }

  private var permitsCatalogRequests: Bool {
    store.configuration().configuration.map { $0.privacyMasked != true } == true
  }

  private func clearSearches() {
    suggestionRefresh?.task.cancel()
    suggestionRefresh = nil
    searchRequests.values.forEach { $0.task.cancel() }
    searchRequests.removeAll()
    searchCache.removeAll()
  }

  static func searchRequest(query: String, locale: String, stocks: Bool = false) throws -> URLRequest {
    var request = try self.request(for: MarketWidgetAsset.defaults[0], locale: locale)
    guard let url = request.url, var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
      throw URLError(.badURL)
    }
    components.path = stocks ? "/utility/v1/stocks/search" : "/utility/v2/market/search"
    components.queryItems = [URLQueryItem(name: "query", value: query)]
    request.url = components.url
    return request
  }

  static func decodeSearch(_ data: Data) throws -> [MarketWidgetAsset] {
    guard data.count <= 1_048_576 else { throw MarketWidgetError.invalidResponse }
    let envelope = try JSONDecoder().decode(TrendingEnvelope.self, from: data)
    guard envelope.code == 0, let entries = envelope.data, entries.count <= 100 else {
      throw MarketWidgetError.invalidResponse
    }
    var seen = Set<String>()
    return entries.compactMap { entry in
      guard entry.perpsCoin == nil else { return nil }
      let asset: MarketWidgetAsset
      if let stockId = entry.stockId, (entry.network ?? "").isEmpty {
        asset = .init(kind: .stock, assetId: nil, chainId: nil, contractAddress: nil,
          isNative: nil, symbol: entry.symbol, name: entry.name, logoURL: entry.logoUrl,
          stockId: stockId.uppercased())
      } else if let assetId = entry.assetId, !assetId.isEmpty {
        asset = .init(kind: .asset, assetId: assetId, chainId: nil, contractAddress: nil,
          isNative: nil, symbol: entry.symbol, name: entry.name, logoURL: entry.logoUrl)
      } else {
        asset = .init(kind: .token, assetId: nil, chainId: entry.network, contractAddress: entry.address,
          isNative: entry.isNative, requestTokenAddress: entry.address,
          symbol: entry.symbol, name: entry.name, logoURL: entry.logoUrl)
      }
      return asset.isValid && seen.insert(asset.id).inserted ? asset : nil
    }
  }

  static func decodeStockSearch(_ data: Data) throws -> [MarketWidgetAsset] {
    let envelope = try JSONDecoder().decode(StockSearchEnvelope.self, from: data)
    guard envelope.code == 0, let items = envelope.data?.items, items.count <= 100 else {
      throw MarketWidgetError.invalidResponse
    }
    return items.compactMap { item in
      guard item.currency == "USD" else { return nil }
      let asset = MarketWidgetAsset(kind: .stock, assetId: nil, chainId: nil, contractAddress: nil,
        isNative: nil, symbol: item.symbol ?? item.stockId, name: item.name ?? "",
        logoURL: item.logoUrl, stockId: item.stockId.uppercased())
      return asset.isValid ? asset : nil
    }
  }

  func refreshEditorMetadata() async {
    guard let configuration = store.configuration().configuration, configuration.privacyMasked != true else { return }
    if let request = editorMetadataRequest { await request.value; return }
    let request = Task {
      _ = try? await trending(locale: configuration.locale)
      await Self.prepareEditorMetadata(store: store, session: session)
    }
    editorMetadataRequest = request
    defer { editorMetadataRequest = nil }
    await request.value
  }

  static func prepareEditorMetadata(store: MarketWidgetStore = MarketWidgetStore(),
                                    session: URLSession = .shared) async {
    guard let configuration = store.configuration().configuration, configuration.privacyMasked != true else { return }
    var seen = Set<String>()
    let assets = (store.assets(for: .watchlist) + store.assets(for: .hot)
      + store.profiles().compactMap(\.asset) + [store.desktopSettings(kind: .single)?.asset].compactMap { $0 })
      .filter { seen.insert($0.id).inserted }
      .filter { asset in
        let known = store.assetWithMetadata(asset)
        return known.symbol.isEmpty || known.name.isEmpty
      }
    // Only display metadata is needed here; charts and icon downloads remain widget work.
    for start in stride(from: 0, to: assets.count, by: 4) {
      await withTaskGroup(of: Void.self) { group in
        for asset in assets[start..<min(start + 4, assets.count)] {
          group.addTask {
            guard store.permitsRequests(for: asset) else { return }
            do {
              let data = try await response(for: request(for: asset, locale: configuration.locale), session: session)
              let quote = try decode(data, asset: asset, fetchedAt: Date())
              try store.saveMetadata(quote.asset)
            } catch { return }
          }
        }
      }
    }
  }

  static func request(for asset: MarketWidgetAsset, locale: String) throws -> URLRequest {
    guard asset.isValid else { throw MarketWidgetError.invalidConfiguration }
    var components = URLComponents()
    components.scheme = "https"
    components.host = "utility.onekeycn.com"
    if asset.kind == .stock {
      components.path = "/utility/v1/stocks/\(asset.stockId ?? "")"
    } else if asset.kind == .asset {
      components.path = "/utility/v1/market/asset/detail"
      components.queryItems = [URLQueryItem(name: "assetId", value: asset.assetId)]
    } else {
      components.path = "/utility/v2/market/token/detail"
      components.queryItems = [
        URLQueryItem(name: "networkId", value: asset.chainId),
        URLQueryItem(name: "tokenAddress", value: asset.requestTokenAddress ?? asset.contractAddress),
      ]
    }
    components.queryItems?.append(URLQueryItem(name: "currency", value: "usd"))
    guard let url = components.url else { throw URLError(.badURL) }
    var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 10)
    let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1"
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.setValue("OneKeyWallet/\(version)", forHTTPHeaderField: "User-Agent")
    request.setValue("ios", forHTTPHeaderField: "X-Onekey-Request-Platform")
    request.setValue("OneKey Market Widget", forHTTPHeaderField: "X-Onekey-Request-Platform-Name")
    request.setValue("OneKey Market Widget", forHTTPHeaderField: "X-Onekey-Request-Device-Name")
    request.setValue("usd", forHTTPHeaderField: "X-Onekey-Request-Currency")
    request.setValue(locale, forHTTPHeaderField: "X-Onekey-Request-Locale")
    request.setValue(version, forHTTPHeaderField: "X-Onekey-Request-Version")
    request.setValue(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1",
                     forHTTPHeaderField: "X-Onekey-Request-Build-Number")
    let requestId = UUID().uuidString
    request.setValue(requestId, forHTTPHeaderField: "X-Onekey-Request-ID")
    request.setValue(requestId, forHTTPHeaderField: "X-Amzn-Trace-Id")
    return request
  }

  private static func response(for request: URLRequest, session: URLSession = .shared) async throws -> Data {
    let (data, response) = try await session.data(for: request)
    guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode),
          data.count <= 1_048_576 else { throw MarketWidgetError.invalidResponse }
    return data
  }

  static func fetch(asset: MarketWidgetAsset, locale: String, store: MarketWidgetStore = MarketWidgetStore(),
                    session: URLSession = .shared) async throws -> MarketWidgetQuote {
    guard store.permitsRequests(for: asset) else { throw MarketWidgetError.invalidConfiguration }
    let quote = try decode(try await response(for: request(for: asset, locale: locale), session: session), asset: asset, fetchedAt: Date())
    // A detail request can finish after the host masks widgets or removes this asset.
    guard store.permitsRequests(for: asset) else { throw MarketWidgetError.invalidConfiguration }
    await fetchIcon(asset: quote.asset, store: store, session: session)
    return quote.merging(store.quote(for: asset))
  }

  static func chartRequest(for asset: MarketWidgetAsset, locale: String, now: Date = Date()) throws -> URLRequest {
    guard asset.kind != .stock else { throw MarketWidgetError.invalidConfiguration }
    var request = try self.request(for: asset, locale: locale)
    guard let url = request.url, var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
      throw MarketWidgetError.invalidConfiguration
    }
    components.path = components.path.replacingOccurrences(of: "/detail", with: "/kline")
    components.queryItems = (components.queryItems ?? []) + [
      URLQueryItem(name: "interval", value: "1H"),
      URLQueryItem(name: "timeFrom", value: String(Int(now.timeIntervalSince1970) - 86400)),
      URLQueryItem(name: "timeTo", value: String(Int(now.timeIntervalSince1970))),
    ]
    request.url = components.url
    return request
  }

  private static func fetchChart(asset: MarketWidgetAsset, locale: String, store: MarketWidgetStore,
                                 session: URLSession) async throws -> [MarketWidgetChartPoint] {
    guard store.permitsRequests(for: asset) else { throw MarketWidgetError.invalidConfiguration }
    return try decodeChart(try await response(for: chartRequest(for: asset, locale: locale), session: session))
  }

  static func decodeChart(_ data: Data, now: Date = Date()) throws -> [MarketWidgetChartPoint] {
    let envelope = try JSONDecoder().decode(ChartEnvelope.self, from: data)
    guard envelope.code == 0, let values = envelope.data?.points, values.count <= 96 else {
      throw MarketWidgetError.invalidResponse
    }
    var timestamps = Set<Double>()
    let points = values.compactMap { point -> MarketWidgetChartPoint? in
      guard let close = point.c.value, let number = Double(close), number.isFinite, number > 0,
            point.t.isFinite, point.t > now.timeIntervalSince1970 - 90000,
            point.t <= now.timeIntervalSince1970 + 60, timestamps.insert(point.t).inserted else { return nil }
      return .init(timestamp: point.t, value: number)
    }.sorted { $0.timestamp < $1.timestamp }
    guard points.count >= 12, let first = points.first, let last = points.last,
          last.timestamp - first.timestamp >= 18 * 3600 else {
      throw MarketWidgetError.invalidResponse
    }
    return points
  }

  static func decodeTrending(_ data: Data, fetchedAt: Date) throws -> MarketWidgetCatalog {
    let envelope = try JSONDecoder().decode(TrendingEnvelope.self, from: data)
    guard envelope.code == 0, let entries = envelope.data, entries.count <= 100 else {
      throw MarketWidgetError.invalidResponse
    }
    var seen = Set<String>()
    let assets = entries.compactMap { entry -> MarketWidgetAsset? in
      guard entry.stockId == nil, entry.perpsCoin == nil else { return nil }
      let asset: MarketWidgetAsset
      if let assetId = entry.assetId, !assetId.isEmpty {
        asset = .init(kind: .asset, assetId: assetId, chainId: nil, contractAddress: nil,
          isNative: nil, symbol: entry.symbol, name: entry.name, logoURL: entry.logoUrl)
      } else {
        asset = .init(kind: .token, assetId: nil, chainId: entry.network,
          contractAddress: entry.address, isNative: entry.isNative,
          requestTokenAddress: entry.address, symbol: entry.symbol, name: entry.name, logoURL: entry.logoUrl)
      }
      return asset.isValid && seen.insert(asset.id).inserted ? asset : nil
    }
    let catalog = MarketWidgetCatalog(assets: Array(assets.prefix(20)), fetchedAt: fetchedAt)
    guard catalog.isValid else { throw MarketWidgetError.invalidResponse }
    return catalog
  }

  static func validIconURL(_ value: String?) -> URL? {
    guard let value, value.count <= 2048, let url = URL(string: value), url.scheme == "https",
          url.user == nil, url.password == nil, url.port == nil,
          let host = url.host?.lowercased(),
          host == "onekey-asset.com" || host.hasSuffix(".onekey-asset.com")
            || host == "coin-images.coingecko.com" || host == "assets.coingecko.com" else { return nil }
    return url
  }

  private static func fetchIcon(asset: MarketWidgetAsset, store: MarketWidgetStore, session: URLSession) async {
    guard store.permitsRequests(for: asset), store.icon(for: asset) == nil,
          let url = validIconURL(asset.logoURL) else { return }
    do {
      let (data, response) = try await session.data(for: URLRequest(url: url, timeoutInterval: 6))
      guard let response = response as? HTTPURLResponse, response.statusCode == 200,
            validIconURL(response.url?.absoluteString) != nil, data.count <= 262_144,
            let source = CGImageSourceCreateWithData(data as CFData, nil),
            let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
              kCGImageSourceCreateThumbnailFromImageAlways: true,
              kCGImageSourceThumbnailMaxPixelSize: 96,
              kCGImageSourceCreateThumbnailWithTransform: true,
            ] as CFDictionary) else { return }
      let png = NSMutableData()
      guard let destination = CGImageDestinationCreateWithData(png, UTType.png.identifier as CFString, 1, nil) else { return }
      CGImageDestinationAddImage(destination, image, nil)
      guard CGImageDestinationFinalize(destination) else { return }
      try store.saveIcon(png as Data, for: asset)
    } catch { return }
  }

  static func decode(_ data: Data, asset: MarketWidgetAsset, fetchedAt: Date) throws -> MarketWidgetQuote {
    if asset.kind == .stock { return try decodeStock(data, asset: asset, fetchedAt: fetchedAt) }
    let envelope = try JSONDecoder().decode(Envelope.self, from: data)
    guard envelope.code == 0, let payload = envelope.data else { throw MarketWidgetError.invalidResponse }
    let fields: QuoteFields
    let symbol: String
    let name: String
    let logoURL: String?
    if asset.kind == .asset {
      guard let identity = payload.asset, identity.assetId == asset.assetId,
            let market = payload.market else { throw MarketWidgetError.invalidResponse }
      fields = market
      symbol = identity.symbol
      name = identity.name
      logoURL = identity.logoUrl
    } else {
      guard let token = payload.token,
            token.networkId == nil || token.networkId == asset.chainId else {
        throw MarketWidgetError.invalidResponse
      }
      let expected = asset.requestTokenAddress ?? asset.contractAddress ?? ""
      // Empty addresses need the returned network and native marker to identify the coin.
      let addressesMatch = !expected.isEmpty && (asset.chainId?.hasPrefix("evm--") == true
        ? token.address?.lowercased() == expected.lowercased() : token.address == expected)
      let verifiedNative = asset.isNative == true && token.isNative == true
        && token.networkId == asset.chainId
      guard !(asset.isNative == true && token.isNative == false),
            addressesMatch || verifiedNative else {
        throw MarketWidgetError.invalidResponse
      }
      fields = token
      symbol = token.symbol ?? asset.symbol
      name = token.name ?? asset.name
      logoURL = token.logoUrl
    }
    guard let price = fields.price?.value,
          let value = MarketWidgetQuote.decimal(price), value >= 0 else {
      throw MarketWidgetError.invalidQuote
    }
    let enriched = MarketWidgetAsset(kind: asset.kind, assetId: asset.assetId,
      chainId: asset.chainId, contractAddress: asset.contractAddress, isNative: asset.isNative,
      requestTokenAddress: asset.requestTokenAddress,
      symbol: symbol, name: name, logoURL: logoURL ?? asset.logoURL)
    let quote = MarketWidgetQuote(asset: enriched, price: price,
      change24h: fields.priceChange24hPercent?.value.flatMap {
        MarketWidgetQuote.decimal($0) == nil ? nil : $0
      }, fetchedAt: fetchedAt)
    guard quote.isValid else { throw MarketWidgetError.invalidQuote }
    return quote
  }

  static func decodeStock(_ data: Data, asset: MarketWidgetAsset, fetchedAt: Date) throws -> MarketWidgetQuote {
    let envelope = try JSONDecoder().decode(StockEnvelope.self, from: data)
    guard envelope.code == 0, let payload = envelope.data,
          payload.stockId.uppercased() == asset.stockId, payload.currency == "USD",
          let price = payload.price?.value, let value = MarketWidgetQuote.decimal(price), value >= 0 else {
      throw MarketWidgetError.invalidResponse
    }
    let enriched = MarketWidgetAsset(kind: .stock, assetId: nil, chainId: nil, contractAddress: nil,
      isNative: nil, symbol: payload.symbol ?? asset.symbol, name: payload.name ?? asset.name,
      logoURL: payload.logoUrl ?? asset.logoURL, stockId: asset.stockId)
    let prices = payload.sparkline?.compactMap { $0.value.flatMap(Double.init) } ?? []
    let validSamples = (2...10_000).contains(prices.count)
      && prices.count == payload.sparkline?.count && prices.allSatisfy { $0.isFinite && $0 > 0 }
    let count = min(prices.count, 96)
    let samples = validSamples ? (0..<count).map { prices[$0 * (prices.count - 1) / (count - 1)] } : nil
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    var updated = payload.priceUpdatedAt.flatMap { formatter.date(from: $0) }
    if updated == nil {
      formatter.formatOptions = [.withInternetDateTime]
      updated = payload.priceUpdatedAt.flatMap { formatter.date(from: $0) }
    }
    if let date = updated, date.timeIntervalSince1970 <= 0 || date > fetchedAt.addingTimeInterval(60) { updated = nil }
    let quote = MarketWidgetQuote(asset: enriched, price: price,
      change24h: payload.priceChange24hPercent?.value.flatMap { MarketWidgetQuote.decimal($0) == nil ? nil : $0 },
      fetchedAt: fetchedAt, stockSparkline: samples, priceUpdatedAt: updated,
      marketClosed: payload.marketStatus.map { !$0.isOpen })
    guard quote.isValid else { throw MarketWidgetError.invalidQuote }
    return quote
  }

  private struct StockEnvelope: Decodable { let code: Int; let data: StockPayload? }
  private struct StockSearchEnvelope: Decodable { let code: Int; let data: StockSearchPayload? }
  private struct StockSearchPayload: Decodable { let items: [StockPayload] }
  private struct StockPayload: Decodable {
    let stockId: String
    let currency: String
    let symbol: String?
    let name: String?
    let logoUrl: String?
    let price: NumericValue?
    let priceChange24hPercent: NumericValue?
    let priceUpdatedAt: String?
    let sparkline: [NumericValue]?
    let marketStatus: StockMarketStatus?
  }
  private struct StockMarketStatus: Decodable { let isOpen: Bool }

  private struct Envelope: Decodable { let code: Int; let data: Payload? }
  private struct Payload: Decodable {
    let asset: AssetIdentity?
    let market: QuoteFields?
    let token: QuoteFields?
  }
  private struct AssetIdentity: Decodable {
    let assetId: String
    let symbol: String
    let name: String
    let logoUrl: String?
  }
  private struct QuoteFields: Decodable {
    let price: NumericValue?
    let priceChange24hPercent: NumericValue?
    let address: String?
    let networkId: String?
    let isNative: Bool?
    let symbol: String?
    let name: String?
    let logoUrl: String?
  }
  private struct ChartEnvelope: Decodable { let code: Int; let data: ChartPayload? }
  private struct ChartPayload: Decodable { let points: [ChartPoint] }
  private struct ChartPoint: Decodable { let t: Double; let c: NumericValue }
  private struct TrendingEnvelope: Decodable { let code: Int; let data: [TrendingAsset]? }
  private struct TrendingAsset: Decodable {
    let assetId: String?
    let stockId: String?
    let perpsCoin: String?
    let network: String?
    let address: String?
    let isNative: Bool?
    let symbol: String
    let name: String
    let logoUrl: String?
  }
  private struct NumericValue: Decodable {
    let value: String?
    init(from decoder: Decoder) throws {
      let container = try decoder.singleValueContainer()
      if let string = try? container.decode(String.self) { value = string }
      else if let number = try? container.decode(Decimal.self) { value = NSDecimalNumber(decimal: number).stringValue }
      else { value = nil }
    }
  }
}
