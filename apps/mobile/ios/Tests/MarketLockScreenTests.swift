import Foundation

// Compile with SharedMarketWidget sources and both market timeline provider files.
@main
struct MarketLockScreenTests {
  private static var checks = 0

  private static func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
    checks += 1
    precondition(condition(), message)
  }

  static func main() async throws {
    try await checkSlotOrderAndQuoteSharing()
    try await checkIndependentSelections()
    try await checkChartRequests()
    try await checkPrivacyDuringRequest()
    try await checkEmptySelection()
    print("MarketLockScreenTests: \(checks) checks passed")
  }

  private static func checkSlotOrderAndQuoteSharing() async throws {
    let fixture = try LockScreenFixture()
    defer { fixture.close() }
    let bitcoin = MarketWidgetAsset.defaults[0]
    let ethereum = MarketWidgetAsset.defaults[1]
    let ethereumFinished = LockScreenRequestGate()
    LockScreenURLProtocol.configure { request in
      if assetID(request) == "btc" {
        await ethereumFinished.wait()
      } else {
        await ethereumFinished.open()
      }
      return try response(request)
    }

    let list = await MarketLockScreenTimeline.timeline(assets: [bitcoin, ethereum, bitcoin],
      isWatchlist: true, includingChart: false, store: fixture.store, service: fixture.service)
    expect(list.entries.first?.rows.map(\.asset.id) == [bitcoin.id, ethereum.id, bitcoin.id],
           "Repeated assets keep their configured slots when requests complete out of order")
    expect(list.entries.first?.rows.map { $0.quote?.price } == ["77000.12", "2200.34", "77000.12"],
           "Each completed price belongs to its original slot")
    expect(LockScreenURLProtocol.requests.count == 2,
           "A duplicate list slot shares its in-flight price request")

    for kind in ["compact", "price"] {
      let single = await MarketLockScreenTimeline.timeline(assets: [bitcoin],
        isWatchlist: false, includingChart: false, store: fixture.store, service: fixture.service)
      expect(single.entries.first?.rows.first?.quote?.price == "77000.12",
             "The \(kind) instance reuses the list's cached quote")
    }
    expect(LockScreenURLProtocol.requests.count == 2,
           "List, compact and price instances share prices without extra requests")
    expect(LockScreenURLProtocol.requests.allSatisfy { $0.url?.path.hasSuffix("/detail") == true },
           "Price-only lock-screen widgets never request a chart or ranking")
  }

  private static func checkIndependentSelections() async throws {
    let fixture = try LockScreenFixture()
    defer { fixture.close() }
    let bitcoin = MarketWidgetAsset.defaults[0]
    let ethereum = MarketWidgetAsset.defaults[1]
    let solana = MarketWidgetAsset.defaults[2]
    try fixture.configure([bitcoin])
    try fixture.store.saveTrending(MarketWidgetCatalog(assets: [bitcoin], fetchedAt: Date()))
    LockScreenURLProtocol.configure { request in try response(request) }

    _ = await MarketLockScreenTimeline.timeline(assets: [bitcoin],
      isWatchlist: false, includingChart: false, store: fixture.store, service: fixture.service)
    let secondSelection = [bitcoin]
    let edited = await MarketLockScreenTimeline.timeline(assets: [ethereum],
      isWatchlist: false, includingChart: false, store: fixture.store, service: fixture.service)
    expect(edited.entries.first?.rows.first?.asset.id == ethereum.id,
           "A searched asset can become a widget's selection without joining the watchlist or ranking")
    let unchanged = MarketLockScreenTimeline.snapshot(assets: secondSelection,
      isWatchlist: false, store: fixture.store)
    expect(unchanged.rows.first?.asset.id == bitcoin.id && unchanged.rows.first?.quote?.price == "77000.12",
           "Editing one previously identical widget leaves the other's selected asset and quote intact")

    try fixture.configure([solana])
    try fixture.store.saveTrending(MarketWidgetCatalog(assets: [solana], fetchedAt: Date()))
    let reopened = MarketWidgetStore(directory: fixture.directory)
    expect(reopened.lockScreenAsset(id: bitcoin.id)?.id == bitcoin.id && reopened.permitsRequests(for: bitcoin),
           "A selected asset remains available after leaving both watchlist and ranking")
    let old = MarketWidgetQuote(asset: bitcoin, price: "76000", change24h: "-2",
      fetchedAt: Date().addingTimeInterval(-600))
    let directoryForRefresh = fixture.directory.appendingPathComponent("fresh-selection")
    let refreshStore = MarketWidgetStore(directory: directoryForRefresh)
    try refreshStore.rememberLockScreenAssets([bitcoin])
    try refreshStore.saveQuote(old)
    let refreshReader = MarketWidgetStore(directory: directoryForRefresh)
    let refreshService = MarketWidgetService(store: refreshReader, session: fixture.session)
    let refreshed = await MarketLockScreenTimeline.timeline(assets: secondSelection,
      isWatchlist: false, includingChart: false, store: refreshReader, service: refreshService)
    expect(refreshed.entries.first?.rows.first?.quote?.price == "77000.12",
           "A persisted off-ranking selection can fetch a fresh price after cached data expires")
  }

  private static func checkChartRequests() async throws {
    let fixture = try LockScreenFixture()
    defer { fixture.close() }
    let bitcoin = MarketWidgetAsset.defaults[0]
    LockScreenURLProtocol.configure { request in try response(request) }
    async let first = MarketLockScreenTimeline.timeline(assets: [bitcoin],
      isWatchlist: false, includingChart: true, store: fixture.store, service: fixture.service)
    async let second = MarketLockScreenTimeline.timeline(assets: [bitcoin],
      isWatchlist: false, includingChart: true, store: fixture.store, service: fixture.service)
    let results = await [first, second]
    expect(results.allSatisfy { $0.entries.first?.rows.first?.quote?.chart?.count == 24 },
           "Both chart instances receive the 24-hour series")
    expect(LockScreenURLProtocol.requests.filter { $0.url?.path.hasSuffix("/detail") == true }.count == 1,
           "Concurrent chart instances share the price request")
    expect(LockScreenURLProtocol.requests.filter { $0.url?.path.hasSuffix("/kline") == true }.count == 1,
           "Concurrent chart instances share the chart request")
    let chartRequest = LockScreenURLProtocol.requests.first { $0.url?.path.hasSuffix("/kline") == true }!
    let parameters = URLComponents(url: chartRequest.url!, resolvingAgainstBaseURL: false)?.queryItems ?? []
    let from = parameters.first { $0.name == "timeFrom" }.flatMap { Int($0.value ?? "") }
    let to = parameters.first { $0.name == "timeTo" }.flatMap { Int($0.value ?? "") }
    expect(from != nil && to != nil && to! - from! == 86400,
           "The lock-screen chart requests one day of history")

    let reopened = MarketWidgetStore(directory: fixture.directory)
    let anotherService = MarketWidgetService(store: reopened, session: fixture.session)
    let cached = await MarketLockScreenTimeline.timeline(assets: [bitcoin],
      isWatchlist: false, includingChart: true, store: reopened, service: anotherService)
    expect(cached.entries.first?.rows.first?.quote?.chart?.count == 24 && LockScreenURLProtocol.requests.count == 2,
           "A new service instance reuses the shared price and chart files")
  }

  private static func checkPrivacyDuringRequest() async throws {
    let fixture = try LockScreenFixture()
    defer { fixture.close() }
    let bitcoin = MarketWidgetAsset.defaults[0]
    let started = LockScreenRequestGate()
    let resume = LockScreenRequestGate()
    LockScreenURLProtocol.configure { request in
      await started.open()
      await resume.wait()
      return try response(request)
    }
    let pending = Task {
      await MarketLockScreenTimeline.timeline(assets: [bitcoin], isWatchlist: false,
        includingChart: true, store: fixture.store, service: fixture.service)
    }
    await started.wait()
    try fixture.configure([], masked: true)
    await resume.open()
    let result = await pending.value
    expect(result.entries.first?.rows.isEmpty == true,
           "Privacy enabled during a suspended price request publishes no rows")
    expect(fixture.store.quote(for: bitcoin) == nil && fixture.store.lockScreenAsset(id: bitcoin.id) == nil,
           "A late price response cannot restore masked quotes or selections")
    expect(LockScreenURLProtocol.requests.count == 1,
           "Privacy interrupts the price-to-chart sequence before a chart request starts")
    let snapshot = MarketLockScreenTimeline.snapshot(assets: [bitcoin], isWatchlist: false, store: fixture.store)
    expect(snapshot.rows.isEmpty, "Masked snapshot never exposes the intent's selected asset")
  }

  private static func checkEmptySelection() async throws {
    let fixture = try LockScreenFixture()
    defer { fixture.close() }
    try fixture.configure(MarketWidgetAsset.defaults)
    try fixture.store.saveTrending(MarketWidgetCatalog(assets: MarketWidgetAsset.defaults, fetchedAt: Date()))
    LockScreenURLProtocol.configure { request in try response(request) }
    for isWatchlist in [false, true] {
      let result = await MarketLockScreenTimeline.timeline(assets: [], isWatchlist: isWatchlist,
        includingChart: true, store: fixture.store, service: fixture.service)
      expect(result.entries.first?.rows.isEmpty == true && result.entries.first?.selectionUnavailable == true,
             "An empty selection remains empty instead of adopting a default or ranked asset")
    }
    expect(LockScreenURLProtocol.requests.isEmpty, "An empty selection does not start market requests")
  }

  private static func assetID(_ request: URLRequest) -> String? {
    guard let url = request.url else { return nil }
    return URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?
      .first { $0.name == "assetId" }?.value
  }

  private static func response(_ request: URLRequest) throws -> Data {
    guard let url = request.url, let id = assetID(request),
          let index = MarketWidgetAsset.defaults.firstIndex(where: { $0.assetId == id }) else {
      throw URLError(.badURL)
    }
    if url.path.hasSuffix("/kline") {
      let now = Date().timeIntervalSince1970
      let points = (0..<24).map { index in
        ["t": now - Double(23 - index) * 3600, "c": 70000 + Double(index)]
      }
      return try JSONSerialization.data(withJSONObject: ["code": 0, "data": ["points": points]])
    }
    guard url.path.hasSuffix("/detail") else { throw URLError(.unsupportedURL) }
    let asset = MarketWidgetAsset.defaults[index]
    return try JSONSerialization.data(withJSONObject: ["code": 0, "data": [
      "asset": ["assetId": id, "symbol": asset.symbol, "name": asset.name],
      "market": ["price": ["77000.12", "2200.34", "95.67"][index], "priceChange24hPercent": "-2.3"],
    ]])
  }
}

private struct LockScreenFixture {
  let directory: URL
  let store: MarketWidgetStore
  let session: URLSession
  let service: MarketWidgetService

  init() throws {
    directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    let store = MarketWidgetStore(directory: directory)
    self.store = store
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [LockScreenURLProtocol.self]
    session = URLSession(configuration: configuration)
    service = MarketWidgetService(store: store, session: session)
    try configure([])
  }

  func configure(_ assets: [MarketWidgetAsset], masked: Bool = false) throws {
    let configuration = MarketWidgetConfiguration(schemaVersion: 1, assets: assets,
      greenUp: true, locale: "en-US", privacyMasked: masked)
    try store.saveConfiguration(json: String(decoding: JSONEncoder().encode(configuration), as: UTF8.self))
  }

  func close() {
    session.invalidateAndCancel()
    try? FileManager.default.removeItem(at: directory)
  }
}

private actor LockScreenRequestGate {
  private var opened = false
  private var waiters: [CheckedContinuation<Void, Never>] = []

  func wait() async {
    if opened { return }
    await withCheckedContinuation { waiters.append($0) }
  }

  func open() {
    opened = true
    let waiting = waiters
    waiters = []
    for waiter in waiting { waiter.resume() }
  }
}

private final class LockScreenURLProtocol: URLProtocol, @unchecked Sendable {
  private static let lock = NSLock()
  private static var handler: ((URLRequest) async throws -> Data)?
  private static var recorded: [URLRequest] = []

  static func configure(_ handler: @escaping (URLRequest) async throws -> Data) {
    lock.lock()
    self.handler = handler
    recorded = []
    lock.unlock()
  }

  static var requests: [URLRequest] {
    lock.lock()
    defer { lock.unlock() }
    return recorded
  }

  private static func begin(_ request: URLRequest) -> ((URLRequest) async throws -> Data)? {
    lock.lock()
    defer { lock.unlock() }
    recorded.append(request)
    return handler
  }

  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

  override func startLoading() {
    let handler = Self.begin(request)
    Task {
      do {
        guard let handler, let url = request.url,
              let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: nil) else {
          throw URLError(.badServerResponse)
        }
        let data = try await handler(request)
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
      } catch {
        client?.urlProtocol(self, didFailWithError: error)
      }
    }
  }

  override func stopLoading() {}
}
