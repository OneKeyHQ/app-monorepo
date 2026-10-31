import Foundation

// Run with swiftc alongside SharedMarketWidget sources and OneKeyMarketWidget/MarketWidgetProvider.swift.
@main
struct MarketWidgetDataTests {
  static var checks = 0
  static func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
    checks += 1
    precondition(condition(), message)
  }

  static func rejects(_ message: String, _ action: () throws -> Void) {
    do { try action(); preconditionFailure(message) } catch { checks += 1 }
  }

  static func json(_ value: String) -> Data { Data(value.utf8) }

  private static func testManualSlots() throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = MarketWidgetStore(directory: directory)
    let btc = MarketWidgetAsset.defaults[0]
    let eth = MarketWidgetAsset.defaults[1]
    let sol = MarketWidgetAsset.defaults[2]
    let pinned = [sol, btc, eth]
    _ = try store.saveSettings(json: settingsJSON(kind: .list, assets: pinned))
    _ = try store.saveSettings(json: settingsJSON(source: .watchlist, asset: eth, assets: [eth]))
    try store.saveConfiguration(json: #"{"schemaVersion":1,"assets":[],"greenUp":true,"locale":"en-US"}"#)
    try store.saveTrending(MarketWidgetCatalog(assets: [btc], fetchedAt: Date()))
    expect(store.selection(kind: .list).assets.map(\.id) == pinned.map(\.id),
           "Manual slots retain their exact order after watchlist removal and hot ranking changes")
    expect(store.selection(kind: .single).assets.map(\.id) == [eth.id],
           "Single and list settings stay independent even when they share a coin")
    expect(store.permitsRequests(for: sol) && store.permitsRequests(for: eth),
           "Pinned assets remain eligible for quotes after disappearing from candidate sources")
    let reloaded = MarketWidgetStore(directory: directory)
    expect(tryValue { try reloaded.editorState().settings.first { $0.kind == .list }?.assets?.map(\.id) } == pinned.map(\.id),
           "A new process reads all three ordered slots")
    _ = try store.saveSettings(json: settingsJSON(kind: .list, source: .watchlist, assets: Array(pinned.reversed())))
    expect(store.selection(kind: .list).assets.map(\.id) == pinned.reversed().map(\.id),
           "Reediting pinned coins does not require their original source membership")
    rejects("A list must contain exactly three slots") {
      _ = try store.saveSettings(json: settingsJSON(kind: .list, assets: [btc, eth]))
    }
    let unknown = MarketWidgetAsset(kind: .asset, assetId: "unknown-widget-test", chainId: nil,
      contractAddress: nil, isNative: nil, requestTokenAddress: nil, symbol: "UNKNOWN", name: "Unknown")
    rejects("Manual input cannot authorize an arbitrary asset") {
      _ = try store.saveSettings(json: settingsJSON(kind: .list, assets: [btc, eth, unknown]))
    }
    try store.saveConfiguration(json: #"{"schemaVersion":1,"assets":[],"privacyMasked":true,"greenUp":true,"locale":"en-US"}"#)
    expect(store.selection(kind: .list).assets.isEmpty && !store.permitsRequests(for: sol),
           "Privacy masks manual selections and prevents their quote requests")
    rejects("Privacy blocks manual saves") {
      _ = try store.saveSettings(json: settingsJSON(kind: .list, assets: pinned))
    }
  }

  private static func settingsJSON(kind: MarketWidgetKind = .single, source: MarketWidgetSource = .hot,
                                   asset: MarketWidgetAsset? = nil, id: String? = nil, assets: [MarketWidgetAsset]? = nil) throws -> String {
    var value: [String: Any] = ["kind": kind.rawValue, "name": "Market", "source": source.rawValue]
    if let asset { value["asset"] = try JSONSerialization.jsonObject(with: JSONEncoder().encode(asset)) }
    if let id { value["id"] = id }
    if let assets { value["assets"] = try JSONSerialization.jsonObject(with: JSONEncoder().encode(assets)) }
    return String(decoding: try JSONSerialization.data(withJSONObject: value), as: UTF8.self)
  }

  private static func testStocks() throws {
    let now = Date()
    let stock = MarketWidgetAsset(kind: .stock, assetId: nil, chainId: nil,
      contractAddress: nil, isNative: nil, symbol: "NVDA", name: "NVIDIA", stockId: "NVDA")
    expect(stock.isValid && stock.id == "stock:NVDA", "A stock has its own identity namespace")
    expect(stock.detailURL?.absoluteString == "onekey-wallet://market_widget?stockId=NVDA", "Stock taps retain the underlying stock identity")
    let url = try MarketWidgetService.request(for: stock, locale: "en-US").url
    expect(url?.path == "/utility/v1/stocks/NVDA", "Stock quotes use the existing public stocks service")
    var invalid = stock
    invalid.stockId = ".."
    expect(!invalid.isValid, "A stock identifier cannot address a parent path")
    let payload: [String: Any] = ["stockId": "NVDA", "currency": "USD", "symbol": "NVDA", "name": "NVIDIA",
      "price": "205.25", "priceChange24hPercent": "-1.2", "marketStatus": ["isOpen": false],
      "priceUpdatedAt": ISO8601DateFormatter().string(from: now.addingTimeInterval(-2 * 86400)),
      "sparkline": (0..<960).map { 200 + Double($0) / 100 }]
    func response(_ fields: [String: Any]) throws -> Data {
      try JSONSerialization.data(withJSONObject: ["code": 0, "data": fields])
    }
    let quote = try MarketWidgetService.decode(response(payload), asset: stock, fetchedAt: now)
    expect(quote.price == "205.25" && quote.marketClosed == true, "A closed exchange still returns its last real quote")
    expect(quote.priceUpdatedAt != nil && quote.priceUpdatedAt! < now.addingTimeInterval(-86400),
      "The last traded price timestamp is not replaced by the fetch timestamp")
    expect(quote.stockSparkline?.count == 96 && quote.stockSparkline?.first == 200 && quote.stockSparkline?.last == 209.59,
      "Stock curves are bounded while preserving their endpoints")
    expect(quote.withFreshChart(at: now).plotPoints?.count == 96,
      "A freshly fetched weekend curve does not require eighteen hours of candles")
    expect(quote.withFreshChart(at: now.addingTimeInterval(3601)).stockSparkline == nil,
      "A stock curve still expires when the client stops receiving updates")
    var wrong = payload
    wrong["stockId"] = "AAPL"
    rejects("A different ticker must never replace the selected stock") { _ = try MarketWidgetService.decode(response(wrong), asset: stock, fetchedAt: now) }
    wrong = payload
    wrong["currency"] = "HKD"
    rejects("A non-USD quote must not be labeled USD") { _ = try MarketWidgetService.decode(response(wrong), asset: stock, fetchedAt: now) }
    wrong = payload
    wrong["sparkline"] = [200, "bad", 201]
    let noChart = try MarketWidgetService.decode(response(wrong), asset: stock, fetchedAt: now)
    expect(noChart.stockSparkline == nil && noChart.price == "205.25", "Malformed history does not create a fabricated curve or hide a valid price")
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = MarketWidgetStore(directory: directory)
    let assets = [MarketWidgetAsset.defaults[0], stock, MarketWidgetAsset.defaults[1]]
    try store.saveConfiguration(json: String(decoding: JSONEncoder().encode(MarketWidgetConfiguration(
      schemaVersion: 1, assets: assets, greenUp: true, locale: "en-US")), as: UTF8.self))
    _ = try store.saveSettings(json: settingsJSON(kind: .list, source: .watchlist, assets: assets))
    try store.saveQuote(quote)
    let reopened = MarketWidgetStore(directory: directory)
    expect(reopened.selection(kind: .list).assets.map(\.id) == assets.map(\.id), "Mixed slot order survives a process restart")
    let editorState = try reopened.editorState()
    expect(editorState.watchlist[1].stockId == "NVDA", "Metadata enrichment retains stock identity in the editor")
    expect(reopened.quote(for: stock)?.stockSparkline == quote.stockSparkline, "The native quote cache preserves stock curves")
  }

  static func main() async throws {
    try testStocks()
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = MarketWidgetStore(directory: directory)
    let bitcoin = MarketWidgetAsset.defaults[0]
    let ethereum = MarketWidgetAsset.defaults[1]
    expect(store.configuration().configuration?.displayAssets.count == 3, "First run has public defaults")
    let initialEditor = try store.editorState()
    expect(!initialEditor.privacyMasked && initialEditor.profiles.isEmpty,
           "An unsynced first launch uses available defaults without reporting privacy mode")
    let empty = #"{"schemaVersion":1,"assets":[],"greenUp":true,"locale":"en-US"}"#
    try store.saveConfiguration(json: empty)
    expect(store.configuration().configuration?.assets.isEmpty == true, "Empty watchlist is a valid configuration")
    expect(tryValue { try store.saveConfiguration(json: empty) } == false, "Unchanged configuration does not request reload")
    rejects("Malformed configuration must fail") { try store.saveConfiguration(json: "{") }
    expect(store.configuration().configuration?.assets.isEmpty == true, "Malformed bridge input preserves previous configuration")
    rejects("Future schema must fail") {
      try store.saveConfiguration(json: empty.replacingOccurrences(of: "schemaVersion\":1", with: "schemaVersion\":2"))
    }
    for malformed in ["1garbage", "NaN", "Infinity", "", "1\n", "1,234", " 1", "1 ", "1e999"] {
      expect(MarketWidgetQuote.decimal(malformed) == nil, "Reject non-finite or partial numeric value: \(malformed)")
    }
    expect(MarketWidgetQuote.decimal("0.000000000000000001") != nil, "Preserve small prices")
    expect(MarketWidgetQuote.decimal("-1.25e-4") != nil, "Accept complete signed scientific notation")
    let response = json(#"{"code":0,"data":{"asset":{"assetId":"btc","symbol":"BTC","name":"Bitcoin"},"market":{"price":"67000.12","priceChange24hPercent":"-2.5"}}}"#)
    let date = Date().addingTimeInterval(-30)
    let quote = try MarketWidgetService.decode(response, asset: bitcoin, fetchedAt: date)
    expect(quote.price == "67000.12" && quote.change24h == "-2.5", "Decode price and percent without ratio conversion")
    expect(quote.fetchedAt == date, "Use supplied fetch timestamp without inventing source time")
    rejects("Wrong asset identity must fail") { _ = try MarketWidgetService.decode(response, asset: ethereum, fetchedAt: date) }
    rejects("Business error must fail") {
      _ = try MarketWidgetService.decode(json(#"{"code":1,"data":null}"#), asset: bitcoin, fetchedAt: date)
    }
    rejects("Missing price must never become zero") {
      _ = try MarketWidgetService.decode(json(#"{"code":0,"data":{"asset":{"assetId":"btc","symbol":"BTC","name":"Bitcoin"},"market":{}}}"#), asset: bitcoin, fetchedAt: date)
    }
    let native = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "sol--101",
      contractAddress: "", isNative: true, requestTokenAddress: "11111111111111111111111111111111",
      symbol: "", name: "")
    expect(native.isValid, "Identity remains valid without display metadata")
    let oldNative = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "sol--101",
      contractAddress: "", isNative: true, requestTokenAddress: "old", symbol: "", name: "")
    let nativeConfiguration = MarketWidgetConfiguration(schemaVersion: 1, assets: [native], greenUp: true, locale: "en-US")
    expect(nativeConfiguration.asset(withID: oldNative.id)?.requestTokenAddress == native.requestTokenAddress,
           "Saved instance identities resolve the current request address")
    expect(MarketWidgetConfiguration.initial.asset(withID: native.id) == nil,
           "A cleared export cannot resolve an old private watchlist selection")
    let request = try MarketWidgetService.request(for: native, locale: "en-US")
    let query = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!.queryItems!
    expect(query.first { $0.name == "tokenAddress" }?.value == native.requestTokenAddress,
           "Use resolved native address in API request")
    expect(query.first { $0.name == "currency" }?.value == "usd", "Quote currency is USD")
    let linkQuery = URLComponents(url: native.detailURL!, resolvingAgainstBaseURL: false)!.queryItems!
    expect(linkQuery.first { $0.name == "contractAddress" }?.value == "", "Deep link retains canonical native identity")
    expect(linkQuery.first { $0.name == "isNative" }?.value == "true", "Deep link preserves native flag")
    rejects("Native fallback requires a returned network identity") {
      _ = try MarketWidgetService.decode(json(#"{"code":0,"data":{"token":{"address":"wrong","isNative":true,"price":"1"}}}"#), asset: native, fetchedAt: date)
    }
    rejects("Explicit non-native response cannot satisfy a native selection") {
      _ = try MarketWidgetService.decode(json(#"{"code":0,"data":{"token":{"networkId":"sol--101","address":"11111111111111111111111111111111","isNative":false,"price":"1"}}}"#), asset: native, fetchedAt: date)
    }
    let verifiedNative = try MarketWidgetService.decode(json(#"{"code":0,"data":{"token":{"networkId":"sol--101","address":"","isNative":true,"price":"1"}}}"#), asset: native, fetchedAt: date)
    expect(verifiedNative.price == "1", "Allow normalized native address with verified chain and native marker")
    for network in ["btc--0", "evm--1", "sol--101"] {
      let emptyNative = MarketWidgetAsset(kind: .token, assetId: nil, chainId: network,
        contractAddress: "", isNative: true, requestTokenAddress: "", symbol: "", name: "")
      let nativeRequest = try MarketWidgetService.request(for: emptyNative, locale: "en-US")
      let nativeQuery = URLComponents(url: nativeRequest.url!, resolvingAgainstBaseURL: false)!.queryItems!
      expect(nativeQuery.first { $0.name == "tokenAddress" }?.value == "",
             "Preserve the API's empty native address for \(network)")
      let nativeResponse = json("""
        {"code":0,"data":{"token":{"networkId":"\(network)","address":"","isNative":true,"price":"1"}}}
        """)
      let nativeQuote = try MarketWidgetService.decode(nativeResponse, asset: emptyNative, fetchedAt: date)
      expect(nativeQuote.price == "1", "Accept a verified empty native address for \(network)")
    }
    let emptyEthereum = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "evm--1",
      contractAddress: "", isNative: true, requestTokenAddress: "", symbol: "", name: "")
    for invalidToken in [
      #"{"address":"","price":"123"}"#,
      #"{"address":"","isNative":true,"price":"123"}"#,
      #"{"networkId":"evm--1","address":"","price":"123"}"#,
      #"{"networkId":"evm--1","address":"","isNative":null,"price":"123"}"#,
      #"{"networkId":"evm--10","address":"","isNative":true,"price":"123"}"#,
      #"{"networkId":"evm--1","address":"","isNative":false,"price":"123"}"#,
    ] {
      rejects("Empty native addresses require both the requested network and a true native marker") {
        let invalidResponse = json("{\"code\":0,\"data\":{\"token\":\(invalidToken)}}")
        _ = try MarketWidgetService.decode(invalidResponse, asset: emptyEthereum, fetchedAt: date)
      }
    }
    let sui = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "sui--mainnet",
      contractAddress: "0x2::sui::SUI", isNative: true,
      requestTokenAddress: "0x2::sui::SUI", symbol: "", name: "")
    let suiResponse = json(#"{"code":0,"data":{"token":{"networkId":"sui--mainnet","address":"0x2::sui::SUI","isNative":true,"price":"0.9382729644825767"}}}"#)
    let suiQuote = try MarketWidgetService.decode(suiResponse, asset: sui, fetchedAt: date)
    expect(suiQuote.price == "0.9382729644825767", "Preserve the native SUI type-tag response")
    let addressOnlySui = try MarketWidgetService.decode(json(#"{"code":0,"data":{"token":{"address":"0x2::sui::SUI","price":"1"}}}"#), asset: sui, fetchedAt: date)
    expect(addressOnlySui.price == "1", "Preserve nonempty exact-address matching")
    let token = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "evm--1",
      contractAddress: "0xAbC", isNative: false, symbol: "", name: "")
    let tokenResponse = json(#"{"code":0,"data":{"token":{"networkId":"evm--1","address":"0xabc","symbol":"TEST","name":"Test","price":"0.0001"}}}"#)
    let tokenQuote = try MarketWidgetService.decode(tokenResponse, asset: token, fetchedAt: date)
    expect(tokenQuote.asset.symbol == "TEST" && tokenQuote.change24h == nil, "Populate metadata and keep missing percent unavailable")
    let otherNetwork = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "evm--10",
      contractAddress: "0xAbC", isNative: false, symbol: "", name: "")
    rejects("Cross-network quote must fail") { _ = try MarketWidgetService.decode(tokenResponse, asset: otherNetwork, fetchedAt: date) }
    let bitcoinWatchlist = MarketWidgetConfiguration(schemaVersion: 1, assets: [bitcoin], greenUp: true, locale: "en-US")
    try store.saveConfiguration(json: String(decoding: JSONEncoder().encode(bitcoinWatchlist), as: UTF8.self))
    _ = try store.saveSettings(json: settingsJSON(source: .watchlist, asset: bitcoin))
    _ = try store.saveSettings(json: settingsJSON(kind: .list, source: .watchlist))
    try store.saveQuote(quote)
    expect(store.quote(for: bitcoin)?.fetchedAt == date, "Cache preserves last successful fetch time")
    try store.saveQuote(MarketWidgetQuote(asset: bitcoin, price: "1", change24h: nil, fetchedAt: date.addingTimeInterval(-60)))
    expect(store.quote(for: bitcoin)?.price == quote.price, "Older parallel request cannot overwrite newer cache")
    let config = MarketWidgetConfiguration(schemaVersion: 1, assets: [ethereum], greenUp: false, locale: "zh-CN")
    try store.saveConfiguration(json: String(decoding: JSONEncoder().encode(config), as: UTF8.self))
    expect(store.quote(for: bitcoin) == nil, "Changing watchlist prunes removed public identities")
    rejects("Late request for removed identity cannot repopulate cache") { try store.saveQuote(quote) }
    let now = Date()
    let nowSeconds = Int(now.timeIntervalSince1970)
    let chartRows = (0..<24).map { index in
      let close = index.isMultiple(of: 2) ? "\"1e-5\"" : "0.00002"
      return "{\"t\":\(nowSeconds - (23 - index) * 3600),\"c\":\(close)}"
    }
    let chartResponse = json("{\"code\":0,\"data\":{\"points\":[\((chartRows + [chartRows.last!]).joined(separator: ","))]}}")
    let chart = try MarketWidgetService.decodeChart(chartResponse, now: now)
    expect(chart.count == 24 && chart[0].value == 0.00001, "Decode scientific and numeric closes and deduplicate timestamps")
    rejects("A single point cannot invent a chart") {
      _ = try MarketWidgetService.decodeChart(json("{\"code\":0,\"data\":{\"points\":[{\"t\":\(nowSeconds),\"c\":1}]}}"), now: now)
    }
    rejects("Eleven points cannot represent a daily chart despite a sufficient span") {
      let rows = stride(from: 0, to: 22, by: 2).map { chartRows[$0] }
      _ = try MarketWidgetService.decodeChart(json("{\"code\":0,\"data\":{\"points\":[\(rows.joined(separator: ","))]}}"), now: now)
    }
    rejects("A dense one-hour response cannot be stretched into a daily chart") {
      let rows = (0..<24).map { "{\"t\":\(nowSeconds - (23 - $0) * 120),\"c\":1}" }
      _ = try MarketWidgetService.decodeChart(json("{\"code\":0,\"data\":{\"points\":[\(rows.joined(separator: ","))]}}"), now: now)
    }
    rejects("Discarding a zero close must leave sufficient valid daily samples") {
      var rows = stride(from: 0, to: 24, by: 2).map { chartRows[$0] }
      rows[0] = "{\"t\":\(nowSeconds - 23 * 3600),\"c\":0}"
      _ = try MarketWidgetService.decodeChart(json("{\"code\":0,\"data\":{\"points\":[\(rows.joined(separator: ","))]}}"), now: now)
    }
    let chartRequest = try MarketWidgetService.chartRequest(for: sui, locale: "zh-CN", now: now)
    let chartQuery = URLComponents(url: chartRequest.url!, resolvingAgainstBaseURL: false)!.queryItems!
    expect(chartRequest.url!.path == "/utility/v2/market/token/kline", "Token curve uses the verified endpoint")
    expect(chartQuery.first { $0.name == "timeFrom" }?.value == String(nowSeconds - 86400), "Chart requests 24 hours in epoch seconds")
    let trending = try MarketWidgetService.decodeTrending(json(#"{"code":0,"data":[{"network":"btc--0","address":"","isNative":true,"symbol":"BTC","name":"Bitcoin","logoUrl":"https://coin-images.coingecko.com/coins/images/1/small/bitcoin.png?1"},{"network":"evm--1","address":"","isNative":true,"symbol":"ETH","name":"Ethereum"}]}"#), fetchedAt: now)
    expect(trending.assets.count == 2 && trending.assets[0].contractAddress == "", "Trending preserves public native token identities")
    expect(MarketWidgetService.validIconURL(trending.assets[0].logoURL) != nil, "Allow official CDN image query strings")
    expect(MarketWidgetService.validIconURL("http://coin-images.coingecko.com/coin.png") == nil, "Reject insecure icons")
    expect(MarketWidgetService.validIconURL("https://coin-images.coingecko.com.attacker.invalid/coin.png") == nil, "Reject deceptive icon hosts")
    try store.saveTrending(trending)
    try store.rememberHotAsset(trending.assets[0])
    let hotQuote = MarketWidgetQuote(asset: trending.assets[0], price: "80000", change24h: "1", fetchedAt: now,
      chart: chart, chartFetchedAt: now)
    try store.saveQuote(hotQuote)
    expect(store.quote(for: trending.assets[0], now: now.addingTimeInterval(3599))?.chart?.count == 24,
           "A recent cached daily chart remains available during an outage")
    let expired = store.quote(for: trending.assets[0], now: now.addingTimeInterval(3600))
    expect(expired?.chart == nil && expired?.chartFetchedAt == nil,
           "An outage cannot display a chart after its independent one-hour freshness limit")
    expect(expired?.price == hotQuote.price && expired?.fetchedAt == hotQuote.fetchedAt,
           "Chart expiry preserves the last price and its original timestamp")
    let oldChart = chart.map { MarketWidgetChartPoint(timestamp: $0.timestamp - 3 * 86400, value: $0.value) }
    let oldQuote = MarketWidgetQuote(asset: trending.assets[1], price: "2000", change24h: "-1",
      fetchedAt: now.addingTimeInterval(-3 * 86400), chart: oldChart, chartFetchedAt: now.addingTimeInterval(-3 * 86400))
    try store.saveQuote(oldQuote)
    expect(store.quote(for: trending.assets[1], now: now)?.chart == nil && store.quote(for: trending.assets[1], now: now)?.price == "2000",
           "A multi-day offline cache keeps its price without showing an old 24-hour chart")
    try store.saveTrending(MarketWidgetCatalog(assets: [trending.assets[1]], fetchedAt: now))
    expect(store.quote(for: trending.assets[0]) != nil, "A chosen Hot Coin keeps its cached data after leaving the ranking")
    try store.saveIcon(Data([1, 2, 3]), for: trending.assets[0])
    let masked = MarketWidgetConfiguration(schemaVersion: 1, assets: [], greenUp: true, locale: "en-US", privacyMasked: true)
    try store.saveConfiguration(json: String(decoding: JSONEncoder().encode(masked), as: UTF8.self))
    expect(store.assets(for: .hot).isEmpty && store.assets(for: .watchlist).isEmpty, "Privacy masks both data sources")
    expect(store.quote(for: trending.assets[0]) == nil && store.icon(for: trending.assets[0]) == nil, "Privacy removes quote/chart/icon caches")
    expect(store.trending() == nil, "Privacy clears cached catalog")
    rejects("Late quote cannot repopulate masked storage") { try store.saveQuote(hotQuote) }
    rejects("Late icon cannot repopulate masked storage") { try store.saveIcon(Data([1, 2, 3]), for: trending.assets[0]) }
    rejects("Late catalog cannot repopulate masked storage") { try store.saveTrending(trending) }
    rejects("Masked widget cannot restore a saved hot identity") { try store.rememberHotAsset(trending.assets[0]) }
    try json("broken").write(to: directory.appendingPathComponent("configuration-v1.json"))
    expect(store.configuration().configuration == nil, "Corrupt on-disk configuration is not treated as an empty watchlist")
    do {
      _ = try store.editorState()
      preconditionFailure("An unavailable configuration must surface a retryable editor error")
    } catch MarketWidgetError.invalidConfiguration { checks += 1 }
    try checkProfiles()
    try checkDesktopSettings()
    try await checkEditorMetadata()
    try await checkTrendingMetadata()
    try await checkFollowupRequests(chartResponse: chartResponse)
    try await checkQuoteRequests(chartResponse: chartResponse)
    try await checkTimelineRequests(chartResponse: chartResponse)
    try await checkLockScreenCatalog()
    try await checkNonblockingLockScreenSuggestions()
    try testManualSlots()
    print("PASS: \(checks) market widget data checks")
  }

  private static func checkNonblockingLockScreenSuggestions() async throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = MarketWidgetStore(directory: directory)
    let bitcoin = MarketWidgetAsset.defaults[0]
    let ethereum = MarketWidgetAsset.defaults[1]
    let local = MarketWidgetConfiguration(schemaVersion: 1, assets: [bitcoin], greenUp: true, locale: "en-US")
    try store.saveConfiguration(json: String(decoding: JSONEncoder().encode(local), as: UTF8.self))
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [MarketWidgetTestURLProtocol.self]
    let session = URLSession(configuration: configuration)
    defer { session.invalidateAndCancel() }
    let service = MarketWidgetService(store: store, session: session)
    let requestStarted = DispatchSemaphore(value: 0)
    let releaseRequest = DispatchSemaphore(value: 0)
    let suggestionsReturned = DispatchSemaphore(value: 0)
    MarketWidgetTestURLProtocol.configure { request in
      precondition(request.url?.path == "/utility/v2/market/trending")
      requestStarted.signal()
      guard releaseRequest.wait(timeout: .now() + 5) == .success else { throw URLError(.timedOut) }
      return json(#"{"code":0,"data":[{"assetId":"eth","symbol":"ETH","name":"Ethereum"}]}"#)
    }
    let pending = Task {
      let assets = await service.suggestedAssets(locale: "en-US")
      suggestionsReturned.signal()
      return assets
    }
    let started = await semaphoreResult(requestStarted, timeout: 3)
    let returned = await semaphoreResult(suggestionsReturned, timeout: 0.5)
    releaseRequest.signal()
    let suggestions = await pending.value
    _ = try await service.trending(locale: "en-US")
    expect(started == .success && returned == .success,
           "Cached watchlist suggestions return while a hot-list request is still suspended")
    expect(suggestions.map(\.id) == [bitcoin.id],
           "The initial menu presents immediately available local candidates")
    expect(store.trending()?.assets.map(\.id) == [ethereum.id]
      && MarketWidgetTestURLProtocol.recordedPaths.count == 1,
           "The detached refresh updates shared hot suggestions through the existing deduplicated request")
    let refreshed = await service.suggestedAssets(locale: "en-US")
    expect(refreshed.map(\.id) == [bitcoin.id, ethereum.id],
           "The next suggestion query includes the refreshed catalog without replacing watchlist order")

    let emptyDirectory = directory.appendingPathComponent("first-launch")
    let emptyStore = MarketWidgetStore(directory: emptyDirectory)
    let emptyService = MarketWidgetService(store: emptyStore, session: session)
    MarketWidgetTestURLProtocol.configure { _ in throw URLError(.notConnectedToInternet) }
    let fallback = await emptyService.suggestedAssets(locale: "en-US")
    expect(fallback.map(\.id) == MarketWidgetAsset.defaults.map(\.id),
           "A first launch with no cache falls back to public defaults after a failed catalog request")
  }

  private static func semaphoreResult(_ semaphore: DispatchSemaphore, timeout: TimeInterval) async -> DispatchTimeoutResult {
    await withCheckedContinuation { continuation in
      DispatchQueue.global().async {
        continuation.resume(returning: semaphore.wait(timeout: .now() + timeout))
      }
    }
  }

  private static func checkLockScreenCatalog() async throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = MarketWidgetStore(directory: directory)
    let bitcoin = MarketWidgetAsset.defaults[0]
    let ethereum = MarketWidgetAsset.defaults[1]
    func configure(_ assets: [MarketWidgetAsset] = [], masked: Bool = false) throws {
      let value = MarketWidgetConfiguration(schemaVersion: 1, assets: assets, greenUp: true,
        locale: "en-US", privacyMasked: masked)
      try store.saveConfiguration(json: String(decoding: JSONEncoder().encode(value), as: UTF8.self))
    }
    try configure([bitcoin])
    try store.saveTrending(MarketWidgetCatalog(assets: [bitcoin, ethereum], fetchedAt: Date()))
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [MarketWidgetTestURLProtocol.self]
    let session = URLSession(configuration: configuration)
    defer { session.invalidateAndCancel() }
    let service = MarketWidgetService(store: store, session: session)
    MarketWidgetTestURLProtocol.configure { _ in throw URLError(.notConnectedToInternet) }
    let suggestions = await service.suggestedAssets(locale: "en-US")
    expect(suggestions.map(\.id) == [bitcoin.id, ethereum.id],
           "Suggestions keep watchlist order and deduplicate exact hot identities")
    expect(MarketWidgetTestURLProtocol.recordedPaths.isEmpty,
           "Cached suggestions do not fetch per-candidate prices, charts or metadata")
    let catalog = json(#"{"code":0,"data":[{"assetId":"business-btc","symbol":"BTC","name":"Bitcoin"},{"assetId":"business-btc","symbol":"BTC","name":"Bitcoin duplicate"},{"network":"evm--1","address":"0xabc","isNative":false,"symbol":"USD","name":"Ethereum token"},{"network":"evm--10","address":"0xabc","isNative":false,"symbol":"USD","name":"Optimism token"},{"network":"sol--101","address":"","isNative":true,"symbol":"SOL","name":"Solana"},{"stockId":"stock","assetId":"stock","symbol":"STOCK","name":"Stock listing"},{"perpsCoin":"BTC","assetId":"perp","symbol":"BTC","name":"Perpetual"},{"network":"evm--1","address":"../bad address","symbol":"BAD","name":"Invalid identity"}]}"#)
    let decoded = try MarketWidgetService.decodeSearch(catalog)
    expect(decoded.count == 5 && decoded[0].assetId == "business-btc" && decoded[4].stockId == "STOCK",
           "Search retains asset and stock identities while removing duplicates, perps and invalid identities")
    expect(decoded[1].id != decoded[2].id && decoded[1].displaySymbol == decoded[2].displaySymbol,
           "Same-symbol, same-address tokens remain distinct across networks")
    expect(decoded[3].isNative == true && decoded[3].requestTokenAddress == "",
           "Search preserves the API's native address representation")
    expect(tryValue { try MarketWidgetService.decodeSearch(json(#"{"code":0,"data":[]}"#)) }?.isEmpty == true,
           "An empty search is valid rather than an invented default result")
    rejects("Business errors cannot become successful empty searches") {
      _ = try MarketWidgetService.decodeSearch(json(#"{"code":1,"data":[]}"#))
    }
    let many = Array(repeating: #"{"assetId":"btc","symbol":"BTC","name":"Bitcoin"}"#, count: 101).joined(separator: ",")
    rejects("Search decoding rejects an unbounded result set") {
      _ = try MarketWidgetService.decodeSearch(json("{\"code\":0,\"data\":[\(many)]}"))
    }
    MarketWidgetTestURLProtocol.configure { request in
      let components = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!
      precondition(["/utility/v2/market/search", "/utility/v1/stocks/search"].contains(components.path))
      precondition(components.queryItems == [URLQueryItem(name: "query", value: "BTC & ETH")])
      precondition(request.value(forHTTPHeaderField: "X-Onekey-Request-Currency") == "usd")
      precondition(request.value(forHTTPHeaderField: "X-Onekey-Request-Locale") == "en-US")
      Thread.sleep(forTimeInterval: 0.03)
      return components.path == "/utility/v1/stocks/search" ? json(#"{"code":0,"data":{"items":[]}}"#) : catalog
    }
    async let firstSearch = service.search(query: "  BTC & ETH  ", locale: "en-US")
    async let secondSearch = service.search(query: "BTC & ETH", locale: "en-US")
    let results = try await (firstSearch, secondSearch)
    expect(results.0.map(\.id) == decoded.map(\.id) && results.1.map(\.id) == decoded.map(\.id),
           "Concurrent searches return normalized entities without losing identity")
    expect(MarketWidgetTestURLProtocol.recordedPaths.count == 2,
           "Concurrent identical queries share one request per market data source")
    let catalogURL = directory.appendingPathComponent("lock-screen-catalog-v1.json")
    let previousModificationDate = Date(timeIntervalSince1970: 100)
    try FileManager.default.setAttributes([.modificationDate: previousModificationDate], ofItemAtPath: catalogURL.path)
    _ = try await service.search(query: "BTC & ETH", locale: "en-US")
    expect(MarketWidgetTestURLProtocol.recordedPaths.count == 2, "Repeated search uses the short-lived cache")
    let catalogAttributes = try FileManager.default.attributesOfItem(atPath: catalogURL.path)
    expect(catalogAttributes[.modificationDate] as? Date == previousModificationDate,
           "An identical search cache hit does not rewrite the public metadata catalog")
    expect(!store.permitsRequests(for: decoded[0]), "Merely appearing in a search does not register a selected asset")
    let identity = MarketWidgetAsset(kind: decoded[0].kind, assetId: decoded[0].assetId,
      chainId: decoded[0].chainId, contractAddress: decoded[0].contractAddress,
      isNative: decoded[0].isNative, requestTokenAddress: decoded[0].requestTokenAddress, symbol: "", name: "")
    let restoredCandidate = MarketWidgetStore(directory: directory).assetWithMetadata(identity)
    expect(restoredCandidate == decoded[0] && store.lockScreenAsset(id: identity.id) == nil
      && store.quote(for: identity) == nil,
           "An identity-only entity restores display metadata across processes before selection or a quote request")
    let canceled = Task { try await service.search(query: "canceled-prefix", locale: "en-US") }
    canceled.cancel()
    do { _ = try await canceled.value; preconditionFailure("Canceled search must stop") }
    catch { checks += 1 }
    expect(MarketWidgetTestURLProtocol.recordedPaths.count == 2, "Canceled prefixes never start an API request")

    try store.rememberLockScreenAssets([identity])
    expect(store.lockScreenAsset(id: decoded[0].id) == decoded[0] && store.permitsRequests(for: decoded[0]),
           "An identity-only selection retains searched metadata outside the watchlist and hot ranking")
    try store.saveQuote(MarketWidgetQuote(asset: decoded[0], price: "12", change24h: nil, fetchedAt: Date()))
    let extra = (0..<40).map { index in
      MarketWidgetAsset(kind: .asset, assetId: "extra\(index)", chainId: nil, contractAddress: nil,
        isNative: nil, symbol: "X\(index)", name: "Extra \(index)")
    }
    try store.rememberLockScreenAssets(extra)
    try configure([])
    try store.saveTrending(MarketWidgetCatalog(assets: [ethereum], fetchedAt: Date()))
    expect(store.lockScreenAsset(id: decoded[0].id) != nil && store.quote(for: decoded[0])?.price == "12",
           "More than twenty other selections and removal from source lists do not invalidate a lock-screen choice")
    expect(MarketWidgetStore(directory: directory).lockScreenAsset(id: decoded[0].id) != nil,
           "Independent app and extension store instances can restore the same selected identity")
    for batch in 0..<3 {
      let more = (0..<100).map { index in
        MarketWidgetAsset(kind: .asset, assetId: "batch\(batch)-\(index)", chainId: nil, contractAddress: nil,
          isNative: nil, symbol: "B", name: "Bounded selection")
      }
      try store.rememberLockScreenAssets(more)
    }
    let registry = try Data(contentsOf: directory.appendingPathComponent("lock-screen-assets-v1.json"))
    let stored = try JSONSerialization.jsonObject(with: registry) as! [String: Any]
    expect((stored["assets"] as? [Any])?.count == 256, "The shared selection cache remains bounded")
    expect(store.lockScreenAsset(id: decoded[0].id) == nil, "The bounded cache can evict an old public identity")
    try store.rememberLockScreenAssets([decoded[0]])
    expect(store.lockScreenAsset(id: decoded[0].id) == decoded[0] && store.permitsRequests(for: decoded[0]),
           "An intent carrying its full asset can restore a selection evicted from the bounded cache")

    let publicCatalog = try Data(contentsOf: catalogURL)
    MarketWidgetTestURLProtocol.configure { _ in
      try configure([], masked: true)
      return catalog
    }
    do {
      _ = try await service.search(query: "mask-during-request", locale: "en-US")
      preconditionFailure("Privacy enabled during a request must discard search results")
    } catch { checks += 1 }
    expect(store.lockScreenAsset(id: decoded[0].id) == nil && !store.permitsRequests(for: decoded[0]),
           "Privacy mode clears registered lock-screen choices and disallows their requests")
    expect(!FileManager.default.fileExists(atPath: catalogURL.path),
           "Privacy mode removes public picker metadata along with selected identities")
    try publicCatalog.write(to: catalogURL)
    expect(store.assetWithMetadata(identity).name.isEmpty && store.assetWithMetadata(identity).symbol.isEmpty,
           "A leftover public catalog cannot reveal metadata while widgets are masked")
    rejects("A late search cannot restore candidate metadata while privacy mode is enabled") {
      try store.cacheLockScreenCandidates(decoded)
    }
    rejects("A late entity resolution cannot restore selections while privacy mode is enabled") {
      try store.rememberLockScreenAssets([decoded[0]])
    }
    let requestsBeforeMaskedSuggestions = MarketWidgetTestURLProtocol.recordedPaths.count
    let maskedSuggestions = await service.suggestedAssets(locale: "en-US")
    expect(maskedSuggestions.isEmpty && MarketWidgetTestURLProtocol.recordedPaths.count == requestsBeforeMaskedSuggestions,
           "Masked suggestions cannot reveal cached identities or start requests")
    try configure([])
    MarketWidgetTestURLProtocol.configure { request in
      request.url?.path == "/utility/v1/stocks/search" ? json(#"{"code":0,"data":{"items":[]}}"#) : catalog
    }
    _ = try await service.search(query: "BTC & ETH", locale: "en-US")
    expect(MarketWidgetTestURLProtocol.recordedPaths.count == 2,
           "An observed privacy transition clears the in-memory search cache")
    for batch in 0..<3 {
      let candidates = (0..<100).map { index in
        MarketWidgetAsset(kind: .asset, assetId: "catalog\(batch)-\(index)", chainId: nil, contractAddress: nil,
          isNative: nil, symbol: "C", name: "Candidate")
      }
      try store.cacheLockScreenCandidates(candidates)
    }
    var catalogObject = try JSONSerialization.jsonObject(with: Data(contentsOf: catalogURL)) as! [String: Any]
    expect((catalogObject["assets"] as? [Any])?.count == 256,
           "Public picker metadata stays bounded independently of selected assets")
    let candidateIdentity = MarketWidgetAsset(kind: .asset, assetId: "catalog2-99", chainId: nil,
      contractAddress: nil, isNative: nil, symbol: "", name: "")
    expect(store.assetWithMetadata(candidateIdentity).name == "Candidate" && !store.permitsRequests(for: candidateIdentity),
           "Catalog-only identities remain displayable without gaining quote request permission")
    catalogObject["schemaVersion"] = 2
    try JSONSerialization.data(withJSONObject: catalogObject).write(to: catalogURL)
    expect(store.assetWithMetadata(candidateIdentity).name.isEmpty,
           "An incompatible picker catalog fails closed without returning stale metadata")
  }

  private static func checkProfiles() throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = MarketWidgetStore(directory: directory)
    let bitcoin = MarketWidgetAsset.defaults[0]
    let ethereum = MarketWidgetAsset.defaults[1]
    func configure(_ assets: [MarketWidgetAsset], masked: Bool = false) throws {
      let configuration = MarketWidgetConfiguration(schemaVersion: 1, assets: assets,
        greenUp: true, locale: "en-US", privacyMasked: masked)
      try store.saveConfiguration(json: String(decoding: JSONEncoder().encode(configuration), as: UTF8.self))
    }
    func profileJSON(id: String? = nil, kind: String = "single", name: String = "My coin",
                     source: String = "watchlist", asset: MarketWidgetAsset? = nil) throws -> String {
      var value: [String: Any] = ["kind": kind, "name": name, "source": source]
      if let id { value["id"] = id }
      if let asset { value["asset"] = try JSONSerialization.jsonObject(with: JSONEncoder().encode(asset)) }
      return String(decoding: try JSONSerialization.data(withJSONObject: value), as: UTF8.self)
    }
    try configure([bitcoin, ethereum])
    try store.saveTrending(MarketWidgetCatalog(assets: [bitcoin, ethereum], fetchedAt: Date()))
    let profileFile = directory.appendingPathComponent("profiles-v1.json")
    let legacy = store.selection(kind: .single, legacySource: .watchlist, legacyAsset: ethereum)
    expect(legacy.profileID == nil && legacy.assets.first?.id == bitcoin.id,
           "Desktop defaults ignore obsolete per-instance coin selection")
    expect(store.selection(kind: .list, legacySource: .hot).assets.count == 2,
           "Desktop lists use the shared default Hot source")
    expect(!FileManager.default.fileExists(atPath: profileFile.path),
           "Resolving an unbound widget does not generate a profile or UUID")
    let first = try store.saveProfile(json: profileJSON(name: " BTC 1 ", asset: bitcoin))
    let second = try store.saveProfile(json: profileJSON(name: "BTC 2", asset: bitcoin))
    expect(first.id != second.id && first.id == first.id.lowercased() && first.name == "BTC 1",
           "Explicit creation generates independent canonical IDs even for identical selections")
    let beforeEdit = store.selection(kind: .single, profileID: first.id)
    let changed = try store.saveProfile(json: profileJSON(id: first.id.uppercased(), name: "ETH", asset: ethereum))
    expect(changed.id == first.id && changed.asset?.id == ethereum.id,
           "Uppercase bridge IDs update the canonical profile without creating a copy")
    expect(store.profile(id: second.id, kind: .single)?.asset?.id == bitcoin.id,
           "Editing one configuration never changes another identical configuration")
    let firstInstance = store.selection(kind: .single, profileID: first.id)
    let secondInstance = store.selection(kind: .single, profileID: first.id)
    expect(firstInstance == secondInstance && firstInstance.assets.first?.id == bitcoin.id,
           "Desktop instances ignore old bindings and use the last profile as migration fallback")
    expect(beforeEdit == firstInstance, "Editing an older profile does not replace the last migration fallback")
    let reopened = MarketWidgetStore(directory: directory)
    expect(reopened.profile(id: first.id, kind: .single) == changed,
           "Profile identity and content survive a fresh native store instance")
    let list = try store.saveProfile(json: profileJSON(kind: "list", name: "Market", source: "hot"))
    expect(store.selection(kind: .list, profileID: list.id).assets.count == 2,
           "List profiles resolve the current source without a single-coin selection")
    expect(store.profiles(kind: .single).count == 2 && store.profiles(kind: .list).count == 1,
           "System profile choices are filtered by widget kind")
    for invalidID in ["invalid", UUID().uuidString] {
      rejects("A supplied ID must identify an existing profile") {
        _ = try store.saveProfile(json: profileJSON(id: invalidID, asset: bitcoin))
      }
      let missing = store.selection(kind: .single, profileID: invalidID, legacySource: .hot, legacyAsset: bitcoin)
      expect(!missing.profileUnavailable && missing.assets.first?.id == bitcoin.id,
             "Invalid or missing old bindings cannot block shared desktop settings")
    }
    expect(store.selection(kind: .single, profileID: list.id).assets.first?.id == bitcoin.id,
           "A binding to another kind cannot override shared desktop settings")
    rejects("A profile kind is immutable") {
      _ = try store.saveProfile(json: profileJSON(id: first.id, kind: "list"))
    }
    for name in ["", "   ", String(repeating: "a", count: 41), "bad\nname"] {
      rejects("Invalid profile names fail") { _ = try store.saveProfile(json: profileJSON(name: name, asset: bitcoin)) }
    }
    rejects("Unknown sources fail") { _ = try store.saveProfile(json: profileJSON(source: "unknown", asset: bitcoin)) }
    rejects("Single profiles require a real selected asset") { _ = try store.saveProfile(json: profileJSON()) }
    rejects("List profiles cannot carry a hidden single-coin selection") {
      _ = try store.saveProfile(json: profileJSON(kind: "list", asset: bitcoin))
    }
    rejects("Bridge payload limits apply before decoding") {
      _ = try store.saveProfile(json: String(repeating: " ", count: 8193))
    }
    let unknown = MarketWidgetAsset(kind: .asset, assetId: "unlisted", chainId: nil,
      contractAddress: nil, isNative: nil, symbol: "FAKE", name: "Fake")
    rejects("A caller cannot introduce an asset outside the actual source") {
      _ = try store.saveProfile(json: profileJSON(asset: unknown))
    }
    let forged = MarketWidgetAsset(kind: .asset, assetId: bitcoin.assetId, chainId: nil,
      contractAddress: nil, isNative: nil, symbol: "FORGED", name: "Forged display name")
    let canonical = try store.saveProfile(json: profileJSON(id: second.id, asset: forged))
    expect(canonical.asset?.symbol == bitcoin.symbol && canonical.asset?.name == bitcoin.name,
           "Selected display metadata comes from native source data rather than bridge input")
    let enriched = MarketWidgetAsset(kind: .asset, assetId: bitcoin.assetId, chainId: nil,
      contractAddress: nil, isNative: nil, symbol: "BTC", name: "Bitcoin enriched",
      logoURL: "https://coin-images.coingecko.com/bitcoin.png")
    try store.saveQuote(MarketWidgetQuote(asset: enriched, price: "80000", change24h: "1", fetchedAt: Date()))
    let editor = try store.editorState()
    expect(editor.watchlist.first?.name == enriched.name && editor.watchlist.first?.logoURL == enriched.logoURL,
           "Editor asset choices include verified quote display metadata")
    expect(editor.profiles.first { $0.id == second.id }?.asset?.name == enriched.name,
           "Editor profile selections also include verified quote display metadata")
    let hot = try store.saveProfile(json: profileJSON(name: "Hot BTC", source: "hot", asset: bitcoin))
    try store.saveTrending(MarketWidgetCatalog(assets: [ethereum], fetchedAt: Date()))
    let retained = try store.saveProfile(json: profileJSON(id: hot.id, name: "Retained BTC", source: "hot", asset: bitcoin))
    expect(retained.asset?.id == bitcoin.id && store.selection(kind: .single, profileID: hot.id).assets.first?.id == bitcoin.id,
           "An already-selected Hot Coin remains editable after leaving the ranking")
    rejects("Off-ranking coins cannot be introduced into a new Hot Coin profile") {
      _ = try store.saveProfile(json: profileJSON(source: "hot", asset: bitcoin))
    }
    _ = try store.saveSettings(json: settingsJSON(source: .watchlist, asset: bitcoin))
    try configure([ethereum])
    let removed = store.selection(kind: .single, profileID: second.id)
    expect(removed.selectionUnavailable && removed.assets.isEmpty,
           "Removing the shared watchlist coin makes it unavailable rather than choosing a replacement")
    rejects("Removed watchlist coins cannot be resaved") {
      _ = try store.saveProfile(json: profileJSON(id: second.id, asset: bitcoin))
    }
    expect(store.permitsRequests(for: bitcoin), "An off-ranking Hot Coin profile keeps its own quote permission")
    let retainedQuote = MarketWidgetQuote(asset: bitcoin, price: "81000", change24h: "1", fetchedAt: Date())
    try store.saveQuote(retainedQuote)
    let profileCount = store.profiles().count
    try configure([], masked: true)
    let masked = try store.editorState()
    expect(masked.privacyMasked && masked.profiles.isEmpty && masked.settings.isEmpty && masked.watchlist.isEmpty && masked.hot.isEmpty,
           "Privacy exposes no profiles or asset choices through the native editor")
    expect(store.profiles().isEmpty && store.profile(id: hot.id, kind: .single) == nil,
           "Privacy also hides configuration names from system entity queries")
    let maskedSelection = store.selection(kind: .single, profileID: hot.id)
    expect(maskedSelection.assets.isEmpty && maskedSelection.profile == nil && maskedSelection != firstInstance,
           "A profile cannot bypass global privacy, including in-flight selection validation")
    do {
      _ = try store.saveProfile(json: profileJSON(id: hot.id, source: "hot", asset: bitcoin))
      preconditionFailure("Privacy must reject profile edits")
    } catch MarketWidgetError.privacyMasked { checks += 1 }
    rejects("A late profile quote cannot reintroduce masked data") { try store.saveQuote(retainedQuote) }
    try configure([ethereum])
    expect(store.profiles().count == profileCount && store.profile(id: hot.id, kind: .single)?.id == hot.id,
           "Unmasking preserves explicit profile IDs without silently recreating or reassigning them")
    let link = MarketWidgetEditorLink.url(profileID: first.id.uppercased(), kind: .single)!
    let query = URLComponents(url: link, resolvingAgainstBaseURL: false)?.queryItems
    expect(link.scheme == "onekey-wallet" && link.host == "market_widget_config"
      && query?.first?.name == "profileId" && query?.first?.value == first.id,
           "Bound gear links identify the canonical profile")
    let unboundLink = MarketWidgetEditorLink.url(profileID: nil, kind: .list)!
    expect(URLComponents(url: unboundLink, resolvingAgainstBaseURL: false)?.queryItems?.first?.value == "list",
           "Unbound gear links open creation with widget kind rather than inventing a profile")
    while store.profiles().count < 20 {
      _ = try store.saveProfile(json: profileJSON(kind: "list", name: "More", source: "watchlist"))
    }
    rejects("Profile count is bounded") { _ = try store.saveProfile(json: profileJSON(kind: "list")) }
    _ = try store.saveProfile(json: profileJSON(id: list.id, kind: "list", name: "Updated at capacity"))
    expect(store.profiles().count == 20, "Existing profiles remain editable at the creation limit")
    try json("broken").write(to: profileFile)
    rejects("Malformed storage must not be overwritten with a fresh profile list") {
      _ = try store.saveProfile(json: profileJSON(kind: "list"))
    }
    expect(tryValue { try Data(contentsOf: profileFile) } == json("broken"),
           "A failed edit preserves malformed storage for recovery")
  }

  private static func checkDesktopSettings() throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = MarketWidgetStore(directory: directory)
    let bitcoin = MarketWidgetAsset.defaults[0]
    let ethereum = MarketWidgetAsset.defaults[1]
    let settingsFile = directory.appendingPathComponent("desktop-settings-v1.json")
    let profileFile = directory.appendingPathComponent("profiles-v1.json")
    func configure(_ assets: [MarketWidgetAsset], masked: Bool = false) throws {
      let config = MarketWidgetConfiguration(schemaVersion: 1, assets: assets,
        greenUp: true, locale: "en-US", privacyMasked: masked)
      try store.saveConfiguration(json: String(decoding: JSONEncoder().encode(config), as: UTF8.self))
    }
    let defaults = try store.editorState()
    expect(defaults.settings.count == 2 && defaults.settings.allSatisfy { $0.source == .hot },
           "First launch exposes both desktop settings without creating a profile")
    expect(store.selection(kind: .single).assets == [bitcoin]
      && store.selection(kind: .list).assets == MarketWidgetAsset.defaults
      && defaults.hot == MarketWidgetAsset.defaults,
           "Offline first launch supplies BTC and three public list defaults")
    expect(!FileManager.default.fileExists(atPath: settingsFile.path)
      && !FileManager.default.fileExists(atPath: profileFile.path),
           "Reading desktop defaults never creates persisted settings or legacy profiles")
    try configure([ethereum])
    let list = try store.saveSettings(json: settingsJSON(kind: .list, source: .watchlist))
    expect(store.selection(kind: .list).assets == [ethereum]
      && store.selection(kind: .single).assets == [bitcoin],
           "The first list save needs no profile and leaves single-coin settings independent")
    let single = try store.saveSettings(json: settingsJSON(source: .watchlist, asset: ethereum, id: "obsolete-id"))
    let secondSave = try store.saveSettings(json: settingsJSON(source: .watchlist, asset: ethereum))
    expect(single.id == secondSave.id && single.id != list.id && UUID(uuidString: single.id) != nil
      && store.profiles().isEmpty && (tryValue { try store.editorState().settings.count }) == 2,
           "Settings upsert by kind with stable internal IDs and ignore obsolete input IDs")
    let snapshot = MarketWidgetEntry.snapshot(isWatchlist: false, selected: [bitcoin], source: .hot,
      profileID: UUID().uuidString, store: store)
    expect(snapshot.rows.first?.asset.id == ethereum.id && !snapshot.profileUnavailable,
           "A desktop snapshot reads shared settings despite an obsolete binding and selection")
    let link = URLComponents(url: snapshot.editorURL!, resolvingAgainstBaseURL: false)?.queryItems
    expect(link == [URLQueryItem(name: "kind", value: "single")],
           "The desktop gear opens its kind directly without exposing profile IDs")
    _ = try store.saveSettings(json: settingsJSON(source: .hot, asset: bitcoin))
    try store.saveTrending(MarketWidgetCatalog(assets: [ethereum], fetchedAt: Date()))
    let retained = try store.saveSettings(json: settingsJSON(asset: bitcoin))
    expect(retained.asset?.id == bitcoin.id && store.permitsRequests(for: bitcoin),
           "A selected Hot coin remains editable and requestable after leaving the ranking")
    _ = try store.saveSettings(json: settingsJSON(asset: ethereum))
    rejects("A new selection cannot introduce an off-ranking Hot coin") {
      _ = try store.saveSettings(json: settingsJSON(asset: bitcoin))
    }
    expect(!store.permitsRequests(for: bitcoin),
           "Changing the only owner of an off-ranking coin removes its request permission")
    _ = try store.saveSettings(json: settingsJSON(source: .watchlist, asset: ethereum))
    try configure([])
    expect(store.selection(kind: .single).selectionUnavailable && store.selection(kind: .single).assets.isEmpty,
           "A removed shared watchlist selection stays unavailable without choosing another asset")
    rejects("A removed watchlist selection cannot be resaved") {
      _ = try store.saveSettings(json: settingsJSON(source: .watchlist, asset: ethereum))
    }
    let settingsBeforeMask = try Data(contentsOf: settingsFile)
    try configure([], masked: true)
    expect(store.desktopSettings(kind: .single) == nil && store.desktopSettings(kind: .list) == nil
      && (tryValue { try store.editorState().settings.isEmpty }) == true
      && store.selection(kind: .list).assets.isEmpty && !store.permitsRequests(for: ethereum),
           "Privacy hides desktop settings and prevents both kinds from making requests")
    rejects("Privacy rejects settings writes") { _ = try store.saveSettings(json: settingsJSON(kind: .list)) }
    expect(tryValue { try Data(contentsOf: settingsFile) } == settingsBeforeMask,
           "Privacy preserves settings without rewriting or exposing them")
    try configure([ethereum])
    expect(store.desktopSettings(kind: .single)?.asset?.id == ethereum.id,
           "Unmasking restores the user's shared settings")
    try json("broken").write(to: settingsFile)
    rejects("Malformed desktop settings cannot be overwritten silently") {
      _ = try store.saveSettings(json: settingsJSON(kind: .list))
    }
    expect(tryValue { try Data(contentsOf: settingsFile) } == json("broken"),
           "Rejected writes preserve malformed desktop settings for recovery")

    let legacyStore = MarketWidgetStore(directory: directory.appendingPathComponent("legacy"))
    let legacyConfiguration = MarketWidgetConfiguration(schemaVersion: 1, assets: [bitcoin, ethereum], greenUp: true, locale: "en-US")
    try legacyStore.saveConfiguration(json: String(decoding: JSONEncoder().encode(legacyConfiguration), as: UTF8.self))
    _ = try legacyStore.saveProfile(json: settingsJSON(source: .watchlist, asset: bitcoin))
    let last = try legacyStore.saveProfile(json: settingsJSON(source: .watchlist, asset: ethereum))
    _ = try legacyStore.saveProfile(json: settingsJSON(kind: .list, source: .watchlist))
    expect(legacyStore.desktopSettings(kind: .single) == last
      && legacyStore.selection(kind: .list).assets == [bitcoin, ethereum],
           "Upgrade uses the last legacy profile of each kind before its first settings save")
    let legacyFile = directory.appendingPathComponent("legacy/profiles-v1.json")
    let legacyData = try Data(contentsOf: legacyFile)
    _ = try legacyStore.saveSettings(json: settingsJSON(source: .watchlist, asset: bitcoin))
    expect(legacyStore.selection(kind: .single, profileID: last.id).assets == [bitcoin]
      && legacyStore.desktopSettings(kind: .list)?.source == .watchlist,
           "New shared settings override old bindings without changing the other kind's fallback")
    expect(tryValue { try Data(contentsOf: legacyFile) } == legacyData,
           "Migrating a desktop kind leaves legacy profile data intact")
  }

  private static func checkEditorMetadata() async throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = MarketWidgetStore(directory: directory)
    let assets = (0..<6).map { index in
      MarketWidgetAsset(kind: .asset, assetId: "coin\(index)", chainId: nil,
        contractAddress: nil, isNative: nil, symbol: "", name: "")
    }
    func configure(_ values: [MarketWidgetAsset], masked: Bool = false) throws {
      let configuration = MarketWidgetConfiguration(schemaVersion: 1, assets: values,
        greenUp: true, locale: "en-US", privacyMasked: masked)
      try store.saveConfiguration(json: String(decoding: JSONEncoder().encode(configuration), as: UTF8.self))
    }
    try configure(assets)
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [MarketWidgetTestURLProtocol.self]
    let session = URLSession(configuration: configuration)
    defer { session.invalidateAndCancel() }
    func response(_ assetID: String) -> Data {
      json("""
      {"code":0,"data":{"asset":{"assetId":"\(assetID)","symbol":"\(assetID.uppercased())","name":"Name \(assetID)","logoUrl":"https://coin-images.coingecko.com/\(assetID).png"},"market":{"price":"1","priceChange24hPercent":"1"}}}
      """)
    }
    MarketWidgetTestURLProtocol.configure { request in
      let id = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?.queryItems?
        .first { $0.name == "assetId" }?.value ?? ""
      return id == "coin5" ? json(#"{"code":1,"data":null}"#) : response(id)
    }
    await MarketWidgetService.prepareEditorMetadata(store: store, session: session)
    let editor = try store.editorState()
    expect(editor.watchlist.count == 6 && editor.watchlist[4].symbol == "COIN4"
      && editor.watchlist[4].name == "Name coin4" && editor.watchlist[4].logoURL?.hasSuffix("coin4.png") == true,
           "Editor resolves names, symbols and logo URLs beyond the three visible widget rows")
    expect(editor.watchlist[5].symbol == "coin5" && !editor.watchlist[5].name.isEmpty,
           "Failed metadata requests retain a recognizable, searchable identity fallback")
    expect(MarketWidgetTestURLProtocol.recordedPaths.count == 6
      && MarketWidgetTestURLProtocol.recordedPaths.allSatisfy { $0.hasSuffix("/detail") },
           "Editor metadata fetches details only, never charts or image files")
    expect(store.quote(for: assets[4]) == nil,
           "Editor metadata does not introduce a fresh quote that suppresses widget chart refresh")
    try store.saveQuote(MarketWidgetQuote(asset: assets[4], price: "1", change24h: nil, fetchedAt: Date()))
    let merged = try store.editorState().watchlist[4]
    expect(merged.symbol == "COIN4" && merged.name == "Name coin4" && merged.logoURL?.hasSuffix("coin4.png") == true,
           "An old empty quote cannot overwrite successfully resolved metadata display fields")
    let saved = MarketWidgetProfile(id: UUID().uuidString.lowercased(), kind: .single,
      name: "Fifth", source: .watchlist, asset: assets[4])
    let inputData = try JSONSerialization.jsonObject(with: JSONEncoder().encode(saved)) as! [String: Any]
    var newInput = inputData
    newInput.removeValue(forKey: "id")
    let profile = try store.saveProfile(json: String(decoding: JSONSerialization.data(withJSONObject: newInput), as: UTF8.self))
    expect(profile.asset?.name == "Name coin4", "Saving uses verified native metadata for an otherwise blank exported asset")
    MarketWidgetTestURLProtocol.configure { _ in json(#"{"code":1,"data":null}"#) }
    await MarketWidgetService.prepareEditorMetadata(store: store, session: session)
    expect(MarketWidgetTestURLProtocol.recordedPaths.count == 1,
           "Successfully resolved metadata is reused while failed assets can retry")
    try configure([assets[5]])
    expect(store.metadata(for: assets[4]) == nil, "Removing watchlist identities prunes their editor metadata cache")
    MarketWidgetTestURLProtocol.configure { _ in
      try configure([], masked: true)
      return response("coin5")
    }
    await MarketWidgetService.prepareEditorMetadata(store: store, session: session)
    let masked = try store.editorState()
    expect(masked.privacyMasked && masked.watchlist.isEmpty && masked.profiles.isEmpty,
           "Privacy enabled during metadata fetch returns a freshly masked editor state")
    expect(store.metadata(for: assets[5]) == nil,
           "Late metadata cannot repopulate storage after privacy is enabled")
    let currentNative = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "sol--101",
      contractAddress: "", isNative: true, requestTokenAddress: "current-address", symbol: "", name: "")
    let cachedNative = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "sol--101",
      contractAddress: "", isNative: true, requestTokenAddress: "old-address", symbol: "SOL", name: "Solana")
    try configure([currentNative])
    try store.saveMetadata(cachedNative)
    try store.saveQuote(MarketWidgetQuote(asset: cachedNative, price: "1", change24h: nil, fetchedAt: Date()))
    let currentAsset = try store.editorState().watchlist[0]
    expect(currentAsset.symbol == "SOL" && currentAsset.name == "Solana"
      && currentAsset.requestTokenAddress == "current-address" && currentAsset.id == currentNative.id,
           "Display metadata enrichment preserves the current source's request address and identity")
    let nativeValue: [String: Any] = ["kind": "single", "name": "Native coin", "source": "watchlist",
      "asset": try JSONSerialization.jsonObject(with: JSONEncoder().encode(cachedNative))]
    let nativeProfile = try store.saveProfile(json: String(decoding: JSONSerialization.data(withJSONObject: nativeValue), as: UTF8.self))
    expect(nativeProfile.asset?.requestTokenAddress == "current-address" && nativeProfile.asset?.symbol == "SOL",
           "Saving an enriched profile keeps the canonical source request identity")
  }

  private static func checkFollowupRequests(chartResponse: Data) async throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = MarketWidgetStore(directory: directory)
    let bitcoin = MarketWidgetAsset.defaults[0]
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [MarketWidgetTestURLProtocol.self]
    let session = URLSession(configuration: configuration)
    defer { session.invalidateAndCancel() }
    let detail = json(#"{"code":0,"data":{"asset":{"assetId":"btc","symbol":"BTC","name":"Bitcoin","logoUrl":"https://coin-images.coingecko.com/bitcoin.png"},"market":{"price":"67000.12","priceChange24hPercent":"-2.5"}}}"#)
    for transition in ["unchanged", "masked", "removed", "cleared"] {
      try store.saveConfiguration(json: #"{"schemaVersion":1,"assets":[],"greenUp":true,"locale":"en-US"}"#)
      let initial = MarketWidgetConfiguration(schemaVersion: 1, assets: [bitcoin], greenUp: true, locale: "en-US")
      try store.saveConfiguration(json: String(decoding: JSONEncoder().encode(initial), as: UTF8.self))
      _ = try store.saveSettings(json: settingsJSON(source: .watchlist, asset: bitcoin))
      _ = try store.saveSettings(json: settingsJSON(kind: .list, source: .watchlist))
      MarketWidgetTestURLProtocol.configure { request in
        if request.url?.path.hasSuffix("/detail") == true {
          if transition != "unchanged" {
            let changed = MarketWidgetConfiguration(schemaVersion: 1,
              assets: transition == "removed" ? [MarketWidgetAsset.defaults[1]] : [], greenUp: true, locale: "en-US",
              privacyMasked: transition == "masked")
            try store.saveConfiguration(json: String(decoding: JSONEncoder().encode(changed), as: UTF8.self))
          }
          return detail
        }
        return request.url?.path.hasSuffix("/kline") == true ? chartResponse : Data()
      }
      do {
        _ = try await MarketWidgetService(store: store, session: session)
          .quote(for: bitcoin, locale: "en-US", includingChart: true)
        expect(transition == "unchanged", "A disallowed asset cannot finish the quote pipeline")
      } catch {
        expect(transition != "unchanged", "The unchanged control must complete the quote pipeline")
      }
      let paths = MarketWidgetTestURLProtocol.recordedPaths
      if transition == "unchanged" {
        expect(paths.count == 3 && paths.contains(where: { $0.hasSuffix("/kline") }) && paths.contains("/bitcoin.png"),
               "The control starts real chart and icon requests after detail")
      } else {
        expect(paths.count == 1 && paths[0].hasSuffix("/detail"),
               "A \(transition) asset after detail prevents follow-up chart and icon requests")
      }
    }
    let ethereum = MarketWidgetAsset.defaults[1]
    let initial = MarketWidgetConfiguration(schemaVersion: 1, assets: [ethereum], greenUp: true, locale: "en-US")
    try store.saveConfiguration(json: String(decoding: JSONEncoder().encode(initial), as: UTF8.self))
    try store.saveTrending(MarketWidgetCatalog(assets: [bitcoin, ethereum], fetchedAt: Date()))
    let input = #"{"kind":"single","name":"Race","source":"hot","asset":{"kind":"asset","assetId":"btc","symbol":"BTC","name":"Bitcoin"}}"#
    let profile = try store.saveSettings(json: input)
    try store.saveTrending(MarketWidgetCatalog(assets: [ethereum], fetchedAt: Date()))
    let pendingSelection = store.selection(kind: .single, profileID: profile.id)
    MarketWidgetTestURLProtocol.configure { _ in
      let changed = MarketWidgetProfile(id: profile.id, kind: .single, name: profile.name, source: .hot, asset: ethereum)
      _ = try store.saveSettings(json: String(decoding: JSONEncoder().encode(changed), as: UTF8.self))
      return detail
    }
    do {
      _ = try await MarketWidgetService(store: store, session: session)
        .quote(for: bitcoin, locale: "en-US", includingChart: true)
      preconditionFailure("Editing shared settings must invalidate their exclusive in-flight asset request")
    } catch { checks += 1 }
    expect(MarketWidgetTestURLProtocol.recordedPaths.count == 1,
           "Settings changed after detail block stale follow-up chart and icon requests")
    expect(store.selection(kind: .single, profileID: profile.id) != pendingSelection,
           "Timeline publication can detect settings edited during its network request")
  }

  private static func checkQuoteRequests(chartResponse: Data) async throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = MarketWidgetStore(directory: directory)
    let bitcoin = MarketWidgetAsset.defaults[0]
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [MarketWidgetTestURLProtocol.self]
    let session = URLSession(configuration: configuration)
    defer { session.invalidateAndCancel() }
    let service = MarketWidgetService(store: store, session: session)
    let detail = json(#"{"code":0,"data":{"asset":{"assetId":"btc","symbol":"BTC","name":"Bitcoin"},"market":{"price":"67000.12","priceChange24hPercent":"-2.5"}}}"#)
    let chart = try MarketWidgetService.decodeChart(chartResponse)
    func configure(_ assets: [MarketWidgetAsset], masked: Bool = false) throws {
      let value = MarketWidgetConfiguration(schemaVersion: 1, assets: assets, greenUp: true,
        locale: "en-US", privacyMasked: masked)
      try store.saveConfiguration(json: String(decoding: JSONEncoder().encode(value), as: UTF8.self))
    }
    func reset(priceAge: TimeInterval? = nil, chartAge: TimeInterval? = nil) throws {
      try configure([])
      try configure([bitcoin])
      if let priceAge {
        try store.saveQuote(MarketWidgetQuote(asset: bitcoin, price: "66000", change24h: "1",
          fetchedAt: Date().addingTimeInterval(-priceAge), chart: chartAge == nil ? nil : chart,
          chartFetchedAt: chartAge.map { Date().addingTimeInterval(-$0) }))
      }
    }
    func respond(delayDetail: Bool = false) {
      MarketWidgetTestURLProtocol.configure { request in
        if request.url?.path.hasSuffix("/detail") == true {
          if delayDetail { Thread.sleep(forTimeInterval: 0.05) }
          return detail
        }
        return chartResponse
      }
    }
    func count(_ suffix: String) -> Int {
      MarketWidgetTestURLProtocol.recordedPaths.filter { $0.hasSuffix(suffix) }.count
    }

    try configure([bitcoin])
    _ = try store.saveSettings(json: settingsJSON(source: .watchlist, asset: bitcoin))
    _ = try store.saveSettings(json: settingsJSON(kind: .list, source: .watchlist))
    try reset()
    respond()
    let single = try await service.quote(for: bitcoin, locale: "en-US")
    expect(single.chart == nil && count("/detail") == 1 && count("/kline") == 0,
           "A single-coin refresh fetches price without an unused chart")
    let list = try await service.quote(for: bitcoin, locale: "en-US", includingChart: true)
    expect(list.chart?.count == 24 && count("/detail") == 1 && count("/kline") == 1,
           "A list fills the missing chart while reusing a single-coin price")
    _ = try await service.quote(for: bitcoin, locale: "en-US", includingChart: true)
    expect(count("/detail") == 1 && count("/kline") == 1, "Both cache hits avoid network requests")

    try reset(priceAge: 301, chartAge: 60)
    respond()
    let refreshedSingle = try await service.quote(for: bitcoin, locale: "en-US")
    expect(refreshedSingle.price == "67000.12" && refreshedSingle.chart?.count == 24,
           "A price-only update preserves a list's existing chart")
    let refreshedList = try await service.quote(for: bitcoin, locale: "en-US", includingChart: true)
    expect(refreshedList.chart?.count == 24 && count("/detail") == 1 && count("/kline") == 0,
           "Refreshing an expired price does not refetch a fresh independent chart")

    try reset(priceAge: 180, chartAge: 901)
    respond()
    let chartOnly = try await service.quote(for: bitcoin, locale: "en-US", includingChart: true)
    expect(chartOnly.price == "66000" && count("/detail") == 0 && count("/kline") == 1,
           "An expired chart refresh does not refetch a fresh price")
    expect(chartOnly.chartFetchedAt.map { Date().timeIntervalSince($0) < 10 } == true,
           "A successful chart refresh advances only its own timestamp")
    let persistedChart = try await MarketWidgetService(store: store, session: session)
      .quote(for: bitcoin, locale: "en-US", includingChart: true)
    expect(persistedChart.chart?.count == 24 && count("/detail") == 0 && count("/kline") == 1,
           "A chart newer than a 180-second-old price persists and survives a service restart without refetching")
    expect(MarketWidgetQuote(asset: bitcoin, price: "1", change24h: nil,
      fetchedAt: Date().addingTimeInterval(-600), chart: chart, chartFetchedAt: Date()).isValid,
           "Chart freshness is independent of an older price timestamp")
    rejects("A future chart timestamp cannot enter the cache") {
      try store.saveQuote(MarketWidgetQuote(asset: bitcoin, price: "1", change24h: nil,
        fetchedAt: Date(), chart: chart, chartFetchedAt: Date().addingTimeInterval(120)))
    }

    try reset()
    respond(delayDetail: true)
    async let concurrentSingle = service.quote(for: bitcoin, locale: "en-US")
    async let concurrentList = service.quote(for: bitcoin, locale: "en-US", includingChart: true)
    async let otherList = service.quote(for: bitcoin, locale: "en-US", includingChart: true)
    let concurrent = try await (concurrentSingle, concurrentList, otherList)
    expect(concurrent.1.chart?.count == 24 && concurrent.2.chart?.count == 24,
           "Concurrent lists cannot inherit a chartless single-coin response")
    expect(count("/detail") == 1 && count("/kline") == 1,
           "Concurrent single and list widgets share one detail and one chart request")

    try reset(priceAge: 0, chartAge: 901)
    MarketWidgetTestURLProtocol.configure { _ in throw URLError(.notConnectedToInternet) }
    let fallback = try await service.quote(for: bitcoin, locale: "en-US", includingChart: true)
    expect(fallback.chart?.count == 24 && count("/kline") == 1,
           "A failed chart refresh preserves the original chart within its one-hour fallback window")
    expect(fallback.chartFetchedAt.map { Date().timeIntervalSince($0) > 900 } == true,
           "A failed chart refresh never marks the old chart fresh")

    let newChartDate = Date()
    let newerPrice = MarketWidgetQuote(asset: bitcoin, price: "68000", change24h: "2", fetchedAt: newChartDate)
    try store.saveQuote(newerPrice)
    let lateChart = MarketWidgetQuote(asset: bitcoin, price: "1", change24h: nil,
      fetchedAt: newChartDate.addingTimeInterval(-60), chart: chart, chartFetchedAt: newChartDate)
    try store.saveQuote(lateChart)
    expect(store.quote(for: bitcoin)?.price == "68000" && store.quote(for: bitcoin)?.chartFetchedAt == newChartDate,
           "A late chart completion merges without overwriting a newer price")
    try store.saveQuote(MarketWidgetQuote(asset: bitcoin, price: "69000", change24h: "3",
      fetchedAt: newChartDate.addingTimeInterval(1)))
    expect(store.quote(for: bitcoin)?.price == "69000" && store.quote(for: bitcoin)?.chartFetchedAt == newChartDate,
           "A later single-coin write cannot erase a concurrently saved chart")

    try reset(priceAge: 0)
    MarketWidgetTestURLProtocol.configure { _ in
      try configure([], masked: true)
      return chartResponse
    }
    do {
      _ = try await service.quote(for: bitcoin, locale: "en-US", includingChart: true)
      preconditionFailure("Privacy enabled during a chart request must reject its result")
    } catch { checks += 1 }
    expect(store.quote(for: bitcoin) == nil && count("/kline") == 1,
           "A late chart response cannot repopulate privacy-cleared caches")
  }

  private static func tryValue<T>(_ action: () throws -> T) -> T? { try? action() }

  private static func checkTrendingMetadata() async throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = MarketWidgetStore(directory: directory)
    let native = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "sol--101",
      contractAddress: "", isNative: true, requestTokenAddress: "current-address", symbol: "", name: "")
    let catalogNative = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "sol--101",
      contractAddress: "", isNative: true, requestTokenAddress: "catalog-address", symbol: "SOL", name: "Solana",
      logoURL: "https://coin-images.coingecko.com/sol.png")
    let localBitcoin = MarketWidgetAsset(kind: .asset, assetId: "btc", chainId: nil,
      contractAddress: nil, isNative: nil, symbol: "LOCAL", name: "Local Bitcoin")
    let token = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "evm--1",
      contractAddress: "0xabc", isNative: false, symbol: "", name: "")
    let anotherNetwork = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "evm--10",
      contractAddress: "0xabc", isNative: false, symbol: "WRONG", name: "Another Network")
    let config = MarketWidgetConfiguration(schemaVersion: 1, assets: [native, localBitcoin, token], greenUp: true, locale: "en-US")
    try store.saveConfiguration(json: String(decoding: JSONEncoder().encode(config), as: UTF8.self))
    try store.saveTrending(MarketWidgetCatalog(assets: [catalogNative, MarketWidgetAsset.defaults[0], anotherNetwork], fetchedAt: Date()))
    let enriched = store.assetWithMetadata(native)
    expect(enriched.symbol == "SOL" && enriched.name == "Solana" && enriched.logoURL == catalogNative.logoURL,
           "An exact catalog identity supplies missing editor metadata without another detail request")
    expect(enriched.kind == native.kind && enriched.id == native.id && enriched.chainId == native.chainId
      && enriched.contractAddress == native.contractAddress && enriched.isNative == native.isNative
      && enriched.requestTokenAddress == "current-address",
           "Catalog display enrichment never replaces the original request identity")
    expect(store.assetWithMetadata(localBitcoin).symbol == "LOCAL"
      && store.assetWithMetadata(localBitcoin).name == "Local Bitcoin",
           "Existing source display fields take priority over the catalog fallback")
    let partial = MarketWidgetAsset(kind: native.kind, assetId: native.assetId, chainId: native.chainId,
      contractAddress: native.contractAddress, isNative: native.isNative,
      requestTokenAddress: native.requestTokenAddress, symbol: "", name: "Source Native Name")
    expect(store.assetWithMetadata(partial).symbol == "SOL"
      && store.assetWithMetadata(partial).name == "Source Native Name",
           "Catalog fallback fills only the missing display field")
    expect(store.assetWithMetadata(token).symbol.isEmpty && store.assetWithMetadata(token).name.isEmpty,
           "Matching addresses on a different network cannot reuse catalog metadata")
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [MarketWidgetTestURLProtocol.self]
    let session = URLSession(configuration: configuration)
    defer { session.invalidateAndCancel() }
    MarketWidgetTestURLProtocol.configure { _ in
      json(#"{"code":0,"data":{"token":{"networkId":"evm--1","address":"0xabc","symbol":"ACTUAL","name":"Actual Token","price":"1"}}}"#)
    }
    await MarketWidgetService.prepareEditorMetadata(store: store, session: session)
    expect(MarketWidgetTestURLProtocol.recordedPaths.count == 1
      && MarketWidgetTestURLProtocol.recordedPaths[0].hasSuffix("/detail"),
           "Editor metadata requests only the unresolved identity, without fetching charts or catalog-covered details")
    let incompleteCatalog = MarketWidgetAsset(kind: native.kind, assetId: native.assetId, chainId: native.chainId,
      contractAddress: native.contractAddress, isNative: native.isNative, symbol: "SOL", name: "")
    try store.saveTrending(MarketWidgetCatalog(assets: [incompleteCatalog], fetchedAt: Date()))
    MarketWidgetTestURLProtocol.configure { _ in
      json(#"{"code":0,"data":{"token":{"networkId":"sol--101","address":"current-address","isNative":true,"symbol":"SOL","name":"Solana","price":"1"}}}"#)
    }
    await MarketWidgetService.prepareEditorMetadata(store: store, session: session)
    expect(MarketWidgetTestURLProtocol.recordedPaths.count == 1 && store.assetWithMetadata(native).name == "Solana",
           "Incomplete catalog metadata still falls back to a detail request")
    let metadata = MarketWidgetAsset(kind: native.kind, assetId: native.assetId, chainId: native.chainId,
      contractAddress: native.contractAddress, isNative: native.isNative, symbol: "META", name: "Metadata Name")
    try store.saveMetadata(metadata)
    let quoted = MarketWidgetAsset(kind: native.kind, assetId: native.assetId, chainId: native.chainId,
      contractAddress: native.contractAddress, isNative: native.isNative, symbol: "QUOTE", name: "")
    try store.saveQuote(MarketWidgetQuote(asset: quoted, price: "1", change24h: nil, fetchedAt: Date()))
    expect(store.assetWithMetadata(native).symbol == "QUOTE" && store.assetWithMetadata(native).name == "Metadata Name",
           "Nonempty quote and metadata values retain priority over the catalog")
    let masked = MarketWidgetConfiguration(schemaVersion: 1, assets: [], greenUp: true, locale: "en-US", privacyMasked: true)
    try store.saveConfiguration(json: String(decoding: JSONEncoder().encode(masked), as: UTF8.self))
    expect(store.assetWithMetadata(native).symbol.isEmpty && store.trending() == nil,
           "Catalog metadata cannot survive privacy cache removal")
  }

  private static func checkTimelineRequests(chartResponse: Data) async throws {
    let bitcoin = MarketWidgetAsset.defaults[0]
    let ethereum = MarketWidgetAsset.defaults[1]
    let allAssets = MarketWidgetAsset.defaults
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [MarketWidgetTestURLProtocol.self]
    let session = URLSession(configuration: configuration)
    defer { session.invalidateAndCancel() }
    let trending = json(#"{"code":0,"data":[{"assetId":"btc","symbol":"BTC","name":"Bitcoin"},{"assetId":"eth","symbol":"ETH","name":"Ethereum"},{"assetId":"sol","symbol":"SOL","name":"Solana"}]}"#)
    for scenario in ["savedSingle", "legacyFallback", "defaultHot", "hotList", "watchlist", "watchlistList",
                     "obsoleteBinding", "settingsChanged", "privacyChanged", "masked"] {
      let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
      defer { try? FileManager.default.removeItem(at: directory) }
      let store = MarketWidgetStore(directory: directory)
      let config = MarketWidgetConfiguration(schemaVersion: 1, assets: [ethereum], greenUp: true, locale: "en-US")
      try store.saveConfiguration(json: String(decoding: JSONEncoder().encode(config), as: UTF8.self))
      try store.saveTrending(MarketWidgetCatalog(assets: allAssets, fetchedAt: Date().addingTimeInterval(-1800)))
      var profileID: String?
      if scenario == "savedSingle" || scenario == "legacyFallback" || scenario == "settingsChanged" {
        let input = #"{"kind":"single","name":"Pinned","source":"hot","asset":{"kind":"asset","assetId":"btc","symbol":"BTC","name":"Bitcoin"}}"#
        profileID = try scenario == "legacyFallback" ? store.saveProfile(json: input).id : store.saveSettings(json: input).id
      } else if scenario == "watchlist" || scenario == "obsoleteBinding" {
        _ = try store.saveSettings(json: settingsJSON(source: .watchlist, asset: ethereum))
        profileID = UUID().uuidString.lowercased()
      } else if scenario == "watchlistList" {
        _ = try store.saveSettings(json: settingsJSON(kind: .list, source: .watchlist))
      }
      try store.saveTrending(MarketWidgetCatalog(assets: [ethereum], fetchedAt: Date().addingTimeInterval(-1800)))
      if scenario == "masked" {
        let masked = MarketWidgetConfiguration(schemaVersion: 1, assets: [], greenUp: true, locale: "en-US", privacyMasked: true)
        try store.saveConfiguration(json: String(decoding: JSONEncoder().encode(masked), as: UTF8.self))
      }
      MarketWidgetTestURLProtocol.configure { request in
        if request.url?.path.hasSuffix("/trending") == true { return trending }
        if request.url?.path.hasSuffix("/kline") == true { return chartResponse }
        if scenario == "settingsChanged" {
          _ = try store.saveSettings(json: settingsJSON(source: .watchlist, asset: ethereum))
        } else if scenario == "privacyChanged" {
          let masked = MarketWidgetConfiguration(schemaVersion: 1, assets: [], greenUp: true, locale: "en-US", privacyMasked: true)
          try store.saveConfiguration(json: String(decoding: JSONEncoder().encode(masked), as: UTF8.self))
        }
        let id = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?.queryItems?.first { $0.name == "assetId" }?.value ?? ""
        return json("{\"code\":0,\"data\":{\"asset\":{\"assetId\":\"\(id)\",\"symbol\":\"\(id.uppercased())\",\"name\":\"\(id)\"},\"market\":{\"price\":\"1\"}}}")
      }
      let result = await MarketWidgetEntry.timeline(isWatchlist: scenario == "hotList" || scenario == "watchlistList",
        selected: [bitcoin],
        source: scenario == "watchlist" ? .watchlist : .hot, profileID: profileID,
        store: store, service: MarketWidgetService(store: store, session: session))
      let paths = MarketWidgetTestURLProtocol.recordedPaths
      let detailCount = paths.filter { $0.hasSuffix("/detail") }.count
      let chartCount = paths.filter { $0.hasSuffix("/kline") }.count
      let trendingCount = paths.filter { $0.hasSuffix("/trending") }.count
      if scenario == "savedSingle" || scenario == "legacyFallback" || scenario == "defaultHot" {
        expect(detailCount == 1 && chartCount == 0 && trendingCount == 0,
               "\(scenario) only requests its fixed coin price, even with an expired ranking")
        expect(result.entries.first?.rows.first?.asset.id == bitcoin.id,
               "\(scenario) keeps a selected coin after it leaves the ranking")
      } else if scenario == "hotList" {
        expect(detailCount == 3 && chartCount == 3 && trendingCount == 1,
               "A dynamic Hot list fetches the ranking and all three prices and charts")
        expect(result.entries.first?.rows.allSatisfy { $0.quote?.chart?.count == 24 } == true,
               "Every Hot list row receives its chart")
      } else if scenario == "watchlist" || scenario == "obsoleteBinding" {
        expect(detailCount == 1 && chartCount == 0 && trendingCount == 0,
               "A watchlist single never fetches the Hot ranking")
        expect(result.entries.first?.rows.first?.asset.id == ethereum.id
          && result.entries.first?.profileUnavailable == false,
               "An obsolete binding or per-instance coin cannot block the shared watchlist selection")
      } else if scenario == "watchlistList" {
        expect(detailCount == 1 && chartCount == 1 && trendingCount == 0
          && result.entries.first?.rows.first?.asset.id == ethereum.id,
               "The list uses its own saved watchlist source independently of single-coin defaults")
      } else if scenario == "settingsChanged" {
        expect(detailCount == 1 && result.entries.first?.rows.first?.asset.id == ethereum.id
          && result.entries.first?.rows.first?.quote == nil,
               "A settings edit during a request publishes the new selection without the stale coin's quote")
      } else if scenario == "privacyChanged" {
        expect(detailCount == 1 && result.entries.first?.rows.isEmpty == true
          && result.entries.first?.configuration?.privacyMasked == true,
               "Privacy enabled during a request removes its assets before timeline publication")
      } else {
        expect(paths.isEmpty && result.entries.first?.rows.isEmpty == true,
               "\(scenario) cannot introduce price, chart, or ranking requests")
      }
    }
  }
}

private final class MarketWidgetTestURLProtocol: URLProtocol, @unchecked Sendable {
  private static let lock = NSLock()
  private static var handler: ((URLRequest) throws -> Data)?
  private static var paths: [String] = []

  static func configure(_ handler: @escaping (URLRequest) throws -> Data) {
    lock.lock()
    self.handler = handler
    paths = []
    lock.unlock()
  }

  static var recordedPaths: [String] {
    lock.lock()
    defer { lock.unlock() }
    return paths
  }

  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
  override func startLoading() {
    Self.lock.lock()
    Self.paths.append(request.url?.path ?? "")
    let handler = Self.handler
    Self.lock.unlock()
    do {
      guard let handler, let url = request.url,
            let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: nil) else {
        throw URLError(.badServerResponse)
      }
      let data = try handler(request)
      client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
      client?.urlProtocol(self, didLoad: data)
      client?.urlProtocolDidFinishLoading(self)
    } catch {
      client?.urlProtocol(self, didFailWithError: error)
    }
  }
  override func stopLoading() {}
}
