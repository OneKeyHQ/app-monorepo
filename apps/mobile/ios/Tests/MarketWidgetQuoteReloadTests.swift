import AppIntents
import Foundation

@available(iOS 17.0, *)
private struct InstalledWidget: MarketWidgetQuoteConfiguration {
  let kind: String
  let intent: (any WidgetConfigurationIntent)?

  func widgetConfigurationIntent<T: WidgetConfigurationIntent>(of type: T.Type) -> T? { intent as? T }
}

@main
struct MarketWidgetQuoteReloadTests {
  @available(iOS 17.0, *)
  static func testInstalledSelections() async throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = MarketWidgetStore(directory: directory)
    let btc = MarketWidgetAsset.defaults[0]
    let eth = MarketWidgetAsset.defaults[1]
    let sol = MarketWidgetAsset.defaults[2]
    let otherBTC = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "evm--1",
      contractAddress: "0xbtc", isNative: false, symbol: "BTC", name: "Other BTC")
    try store.saveConfiguration(json: #"{"schemaVersion":1,"assets":[],"greenUp":true,"locale":"en-US"}"#)

    func homeList(_ assets: [MarketWidgetAsset]) async throws -> InstalledWidget {
      let intent = MarketWidgetInstanceIntent()
      intent.configurationID = try await MarketWidgetInstanceOptions().results().items.first
      guard let id = intent.instanceID else { preconditionFailure("A new configuration must resolve to a UUID") }
      let binding = MarketWidgetInstanceBinding(id: id, kind: .list)
      try store.bindInstance(binding)
      let profile = MarketWidgetProfile(id: binding.id.uuidString, kind: .list, name: "List", source: .hot, assets: assets)
      _ = try store.saveSettings(json: String(decoding: JSONEncoder().encode(profile), as: UTF8.self), instance: binding)
      return InstalledWidget(kind: binding.kind.timelineKind, intent: intent)
    }
    func spot(_ kind: String, _ asset: MarketWidgetAsset) -> InstalledWidget {
      let intent = MarketLockScreenSpotIntent()
      intent.coin = MarketLockScreenAssetEntity(asset: asset)
      return InstalledWidget(kind: kind, intent: intent)
    }

    let first = try await homeList([eth, sol, eth])
    let second = try await homeList([btc, btc, btc])
    let lockList = MarketLockScreenListIntent()
    lockList.first = nil
    lockList.second = MarketLockScreenAssetEntity(asset: eth)
    lockList.third = nil
    let watchlist = "OneKeyMarketLockScreenWatchlist"
    let chart = "OneKeyMarketLockScreenChart"
    let price = "OneKeyMarketLockScreenPrice"
    let compact = "OneKeyMarketLockScreenCompact"
    let widgets = [first, second, InstalledWidget(kind: watchlist, intent: lockList),
      spot(chart, btc), spot(price, sol), spot(compact, otherBTC)]
    let selected = Set(widgets.flatMap { MarketWidgetQuoteReloader.selectedAssets(for: $0, store: store) }.map(\.id))
    precondition(selected == Set([btc, eth, sol, otherBTC].map(\.id)),
      "Foreground refresh includes every installed size, instance and Lock Screen selection")
    func kinds(_ assets: [MarketWidgetAsset], _ installed: [InstalledWidget]) -> Set<String> {
      MarketWidgetQuoteReloader.affectedKinds(for: Set(assets.map(\.id)), configurations: installed, store: store)
    }
    precondition(kinds([btc], widgets) == [second.kind, chart], "Match the second list and the exact lock-screen coin")
    precondition(kinds([btc], [first]) == [], "An uninstalled list with persisted settings must not request a refresh")
    precondition(kinds([eth], widgets) == [first.kind, watchlist], "Match a non-first lock-screen slot")
    precondition(kinds([btc, eth, sol], widgets) == [first.kind, watchlist, chart, price], "Deduplicate overlapping kinds")
    precondition(kinds([otherBTC], widgets) == [compact], "Same symbol with a different asset identity")
    let legacy = InstalledWidget(kind: MarketWidgetKind.single.timelineKind, intent: nil)
    precondition(kinds([btc], [legacy]) == [legacy.kind] && kinds([sol], [legacy]).isEmpty, "Legacy default single selection")
    // The removed widget is the sole owner of this token's cached quote.
    let removed = MarketWidgetInstanceBinding(id: UUID(), kind: .list)
    try store.bindInstance(removed)
    let profile = MarketWidgetProfile(id: removed.id.uuidString, kind: .list, name: "Removed", source: .hot,
      assets: [otherBTC, eth, sol])
    let payload = String(decoding: try JSONEncoder().encode(profile), as: UTF8.self)
    _ = try store.saveSettings(json: payload, draftAssets: [otherBTC], instance: removed)
    let now = Date()
    try store.saveQuote(MarketWidgetQuote(asset: otherBTC, price: "123", change24h: nil, fetchedAt: now))
    let snapshot = try store.storedInstanceSettings()
    let installed = Set(snapshot.map(\.id)).subtracting([removed.id.uuidString.lowercased()])
    try store.reconcileInstanceSettings(snapshot: snapshot, installed: installed, now: now)
    precondition(store.quote(for: otherBTC) != nil, "One missing observation must preserve the quote")
    let marked = try store.storedInstanceSettings()
    try store.bindInstance(removed)
    let later = now.addingTimeInterval(86_401)
    try store.reconcileInstanceSettings(snapshot: marked, installed: installed, now: later)
    precondition(store.quote(for: otherBTC) != nil, "Rebinding while the lookup was in flight must preserve settings")
    try store.reconcileInstanceSettings(snapshot: store.storedInstanceSettings(), installed: installed, now: now)
    try store.reconcileInstanceSettings(snapshot: store.storedInstanceSettings(), installed: installed, now: later)
    let remaining = try store.storedInstanceSettings()
    precondition(Set(remaining.map(\.id)) == installed && store.quote(for: otherBTC) == nil,
      "Prune only removed configurations and exclusively owned cached quotes")
    try store.saveConfiguration(json: #"{"schemaVersion":1,"assets":[],"greenUp":true,"locale":"en-US","privacyMasked":true}"#)
    precondition(kinds([btc, eth, sol, otherBTC], widgets).isEmpty, "A masked widget displays no quote")
  }

  @MainActor
  static func main() async throws {
    if #available(iOS 17.0, *) { try await testInstalledSelections() }
    let (batches, observed) = AsyncStream<Set<String>>.makeStream()
    let reloader = MarketWidgetQuoteReloader { batch in
      observed.yield(batch)
      if batch.contains("asset:btc") { throw MarketWidgetError.storageUnavailable }
    }
    var iterator = batches.makeAsyncIterator()
    reloader.enqueue("asset:btc")
    reloader.enqueue("asset:eth")
    reloader.enqueue("asset:btc")
    let first = await iterator.next()
    precondition(first == ["asset:btc", "asset:eth"], "Merge repeated and mixed quotes")
    reloader.enqueue("asset:sol")
    let second = await iterator.next()
    precondition(second == ["asset:btc", "asset:eth", "asset:sol"], "Merge fresh quotes into the retry")
    let third = await iterator.next()
    precondition(third == ["asset:sol"], "Only fresh observations retry after the second failure")
    reloader.enqueue("asset:eth")
    let fourth = await iterator.next()
    precondition(fourth == ["asset:eth"], "A successful retry leaves the next batch clean")
    let started = Date()
    reloader.enqueue("asset:sol")
    reloader.flushForBackground()
    let flushed = await iterator.next()
    precondition(flushed == ["asset:sol"] && Date().timeIntervalSince(started) < 2,
      "Backgrounding submits the pending quote without waiting for the batch window")
    print("PASS: targeted quote selection and consecutive quote batches")
  }
}
