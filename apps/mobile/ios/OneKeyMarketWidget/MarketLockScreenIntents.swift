import AppIntents
import Foundation
import WidgetKit

@available(iOS 17.0, *)
struct MarketLockScreenAssetEntity: AppEntity {
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "market_widget_coin__title"
  static var defaultQuery = MarketLockScreenAssetQuery()
  let id: String
  let asset: MarketWidgetAsset

  var displayRepresentation: DisplayRepresentation {
    let subtitle: String
    if asset.kind == .token {
      let network = asset.chainId ?? ""
      let address = asset.contractAddress ?? ""
      let shortAddress = address.count > 16 ? "\(address.prefix(6))…\(address.suffix(4))" : address
      subtitle = [asset.name, network, shortAddress].filter { !$0.isEmpty }.joined(separator: " · ")
    } else {
      subtitle = asset.name
    }
    return DisplayRepresentation(title: "\(asset.displaySymbol)", subtitle: "\(subtitle)")
  }

  init(asset: MarketWidgetAsset) {
    self.asset = asset
    let encoder = JSONEncoder()
    encoder.outputFormatting = .sortedKeys
    // Display metadata changes must not change the system's selected entity identifier.
    let identity = MarketWidgetAsset(kind: asset.kind, assetId: asset.assetId, chainId: asset.chainId,
      contractAddress: asset.contractAddress, isNative: asset.isNative,
      requestTokenAddress: asset.requestTokenAddress, symbol: "", name: "")
    id = (try? encoder.encode(identity).base64EncodedString()) ?? asset.id
  }

  init?(id: String, store: MarketWidgetStore = MarketWidgetStore()) {
    guard id.count <= 4096, let data = Data(base64Encoded: id),
          let asset = try? JSONDecoder().decode(MarketWidgetAsset.self, from: data),
          asset.isValid else { return nil }
    self.id = id
    self.asset = store.assetWithMetadata(asset)
  }
}

@available(iOS 17.0, *)
struct MarketLockScreenAssetQuery: EntityStringQuery {
  func defaultResult() async -> MarketLockScreenAssetEntity? {
    MarketLockScreenAssetEntity(asset: MarketWidgetAsset.defaults[0])
  }

  func entities(for identifiers: [String]) async throws -> [MarketLockScreenAssetEntity] {
    let store = MarketWidgetStore()
    guard let configuration = store.configuration().configuration, configuration.privacyMasked != true else { return [] }
    let entities = identifiers.compactMap { MarketLockScreenAssetEntity(id: $0, store: store) }
    try store.rememberLockScreenAssets(entities.map(\.asset))
    return entities
  }

  func suggestedEntities() async throws -> [MarketLockScreenAssetEntity] {
    let store = MarketWidgetStore()
    let assets = await MarketWidgetService.shared.suggestedAssets(
      locale: store.configuration().configuration?.locale ?? "en-US")
    return assets.map(MarketLockScreenAssetEntity.init(asset:))
  }

  func entities(matching string: String) async throws -> [MarketLockScreenAssetEntity] {
    let query = string.trimmingCharacters(in: .whitespacesAndNewlines)
    if query.isEmpty { return try await suggestedEntities() }
    let store = MarketWidgetStore()
    let assets = try await MarketWidgetService.shared.search(query: query,
      locale: store.configuration().configuration?.locale ?? "en-US")
    return assets.map(MarketLockScreenAssetEntity.init(asset:))
  }
}

@available(iOS 17.0, *)
struct MarketLockScreenEthereumQuery: EntityStringQuery {
  func defaultResult() async -> MarketLockScreenAssetEntity? {
    MarketLockScreenAssetEntity(asset: MarketWidgetAsset.defaults[1])
  }
  func entities(for identifiers: [String]) async throws -> [MarketLockScreenAssetEntity] {
    try await MarketLockScreenAssetQuery().entities(for: identifiers)
  }
  func suggestedEntities() async throws -> [MarketLockScreenAssetEntity] {
    try await MarketLockScreenAssetQuery().suggestedEntities()
  }
  func entities(matching string: String) async throws -> [MarketLockScreenAssetEntity] {
    try await MarketLockScreenAssetQuery().entities(matching: string)
  }
}

@available(iOS 17.0, *)
struct MarketLockScreenSolanaQuery: EntityStringQuery {
  func defaultResult() async -> MarketLockScreenAssetEntity? {
    MarketLockScreenAssetEntity(asset: MarketWidgetAsset.defaults[2])
  }
  func entities(for identifiers: [String]) async throws -> [MarketLockScreenAssetEntity] {
    try await MarketLockScreenAssetQuery().entities(for: identifiers)
  }
  func suggestedEntities() async throws -> [MarketLockScreenAssetEntity] {
    try await MarketLockScreenAssetQuery().suggestedEntities()
  }
  func entities(matching string: String) async throws -> [MarketLockScreenAssetEntity] {
    try await MarketLockScreenAssetQuery().entities(matching: string)
  }
}

@available(iOS 17.0, *)
struct MarketLockScreenSpotIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "market_widget_lock_spot__title"
  static var description = IntentDescription("market_widget_lock_coin__desc")
  @Parameter(title: "market_widget_coin__title", query: MarketLockScreenAssetQuery()) var coin: MarketLockScreenAssetEntity?
  static var parameterSummary: some ParameterSummary { Summary { \.$coin } }

  init() { coin = MarketLockScreenAssetEntity(asset: MarketWidgetAsset.defaults[0]) }
}

@available(iOS 17.0, *)
struct MarketLockScreenListIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "market_widget_lock_watchlist__title"
  static var description = IntentDescription("market_widget_lock_list__desc")
  // WidgetKit resolves defaults through each parameter's query, independently of init().
  @Parameter(title: "market_widget_lock_coin_1__title", query: MarketLockScreenAssetQuery()) var first: MarketLockScreenAssetEntity?
  @Parameter(title: "market_widget_lock_coin_2__title", query: MarketLockScreenEthereumQuery()) var second: MarketLockScreenAssetEntity?
  @Parameter(title: "market_widget_lock_coin_3__title", query: MarketLockScreenSolanaQuery()) var third: MarketLockScreenAssetEntity?
  static var parameterSummary: some ParameterSummary {
    Summary { \.$first; \.$second; \.$third }
  }

  init() {
    first = MarketLockScreenAssetEntity(asset: MarketWidgetAsset.defaults[0])
    second = MarketLockScreenAssetEntity(asset: MarketWidgetAsset.defaults[1])
    third = MarketLockScreenAssetEntity(asset: MarketWidgetAsset.defaults[2])
  }
}

@available(iOS 17.0, *)
struct MarketLockScreenSpotProvider: AppIntentTimelineProvider {
  let includingChart: Bool
  func placeholder(in context: Context) -> MarketWidgetEntry { MarketLockScreenTimeline.preview(isWatchlist: false) }
  func snapshot(for configuration: MarketLockScreenSpotIntent, in context: Context) async -> MarketWidgetEntry {
    if context.isPreview { return MarketLockScreenTimeline.preview(isWatchlist: false) }
    return MarketLockScreenTimeline.snapshot(assets: configuration.coin.map { [$0.asset] } ?? [], isWatchlist: false)
  }
  func timeline(for configuration: MarketLockScreenSpotIntent, in context: Context) async -> Timeline<MarketWidgetEntry> {
    await MarketLockScreenTimeline.timeline(assets: configuration.coin.map { [$0.asset] } ?? [],
      isWatchlist: false, includingChart: includingChart)
  }
}

@available(iOS 17.0, *)
struct MarketLockScreenListProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> MarketWidgetEntry { MarketLockScreenTimeline.preview(isWatchlist: true) }
  func snapshot(for configuration: MarketLockScreenListIntent, in context: Context) async -> MarketWidgetEntry {
    if context.isPreview { return MarketLockScreenTimeline.preview(isWatchlist: true) }
    return MarketLockScreenTimeline.snapshot(assets: assets(configuration), isWatchlist: true)
  }
  func timeline(for configuration: MarketLockScreenListIntent, in context: Context) async -> Timeline<MarketWidgetEntry> {
    await MarketLockScreenTimeline.timeline(assets: assets(configuration), isWatchlist: true, includingChart: false)
  }
  private func assets(_ configuration: MarketLockScreenListIntent) -> [MarketWidgetAsset] {
    [configuration.first, configuration.second, configuration.third].compactMap { $0?.asset }
  }
}
