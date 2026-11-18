import AppIntents
import Foundation
import WidgetKit

@available(iOS 17.0, *)
struct MarketLockScreenAssetEntity: AppEntity {
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "market_widget_asset__title"
  static var defaultQuery = MarketLockScreenAssetQuery()
  let id: String
  let asset: MarketWidgetAsset

  let title: String

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(title)")
  }

  init(asset: MarketWidgetAsset, title: String? = nil) {
    self.title = title ?? MarketLockScreenPicker.title(asset)
    self.asset = asset
    let encoder = JSONEncoder()
    encoder.outputFormatting = .sortedKeys
    // Display metadata changes must not change the system's selected entity identifier.
    let identity = MarketWidgetAsset(kind: asset.kind, assetId: asset.assetId, chainId: asset.chainId,
      contractAddress: asset.contractAddress, isNative: asset.isNative,
      requestTokenAddress: asset.requestTokenAddress, symbol: "", name: "", stockId: asset.stockId)
    id = (try? encoder.encode(identity).base64EncodedString()) ?? asset.id
  }

  init?(id: String, store: MarketWidgetStore = MarketWidgetStore()) {
    guard id.count <= 4096, let data = Data(base64Encoded: id),
          let asset = try? JSONDecoder().decode(MarketWidgetAsset.self, from: data),
          asset.isValid else { return nil }
    self.id = id
    self.asset = store.assetWithMetadata(asset)
    title = MarketLockScreenPicker.title(self.asset)
  }
}

// Picker aliases affect suggestions only; saved entity IDs always resolve their original identity.
@available(iOS 17.0, *)
enum MarketLockScreenPicker {
  static func entities(_ assets: [MarketWidgetAsset]) -> [MarketLockScreenAssetEntity] {
    var seen = Set<String>()
    let unique = assets.filter { seen.insert(identity($0)).inserted }
    let groups = Dictionary(grouping: unique, by: { title($0).uppercased() })
    return unique.map { asset in
      let peers = groups[title(asset).uppercased()] ?? []
      guard peers.count > 1 else { return MarketLockScreenAssetEntity(asset: asset) }
      let name = asset.name.trimmingCharacters(in: .whitespacesAndNewlines)
      var details = name.isEmpty ? [] : [name]
      let sameName = peers.filter {
        $0.name.trimmingCharacters(in: .whitespacesAndNewlines).caseInsensitiveCompare(name) == .orderedSame
      }
      if sameName.count > 1 {
        if let network = networkName(asset.chainId) { details.append(network) }
        if sameName.filter({ $0.chainId == asset.chainId }).count > 1 {
          let identifier = asset.kind == .token ? asset.contractAddress ?? "" : asset.stockId ?? asset.assetId ?? ""
          if !identifier.isEmpty {
            let shortened = shortIdentifier(identifier)
            let collision = sameName.filter { peer in
              guard peer.chainId == asset.chainId else { return false }
              let value = peer.kind == .token ? peer.contractAddress ?? "" : peer.stockId ?? peer.assetId ?? ""
              return shortIdentifier(value) == shortened
            }.count > 1
            details.append(collision ? identifier : shortened)
          }
        }
      }
      return MarketLockScreenAssetEntity(asset: asset,
        title: ([title(asset)] + details).joined(separator: " · "))
    }
  }

  static func title(_ asset: MarketWidgetAsset) -> String {
    let symbol = asset.symbol.trimmingCharacters(in: .whitespacesAndNewlines)
    let name = asset.name.trimmingCharacters(in: .whitespacesAndNewlines)
    let address = asset.contractAddress ?? ""
    let shortAddress = shortIdentifier(address)
    let fallback = asset.kind == .token
      ? (asset.isNative == true ? networkName(asset.chainId) ?? "—" : shortAddress)
      : (asset.stockId ?? asset.assetId ?? "—")
    return "\(symbol.isEmpty ? (name.isEmpty ? fallback : name) : symbol)/USD"
  }

  private static func shortIdentifier(_ identifier: String) -> String {
    identifier.count > 16 ? "\(identifier.prefix(6))…\(identifier.suffix(4))" : identifier
  }

  private static func identity(_ asset: MarketWidgetAsset) -> String {
    if asset.kind == .token, asset.isNative == true, (asset.contractAddress ?? "").isEmpty,
       let canonical = ["btc--0": "btc", "evm--1": "eth", "sol--101": "sol", "evm--56": "bnb"][asset.chainId ?? ""] {
      return "asset:\(canonical)"
    }
    if asset.kind == .token, asset.chainId?.hasPrefix("evm--") == true {
      return "token:\(asset.chainId ?? "")|\(asset.isNative == true)|\((asset.contractAddress ?? "").lowercased())"
    }
    return asset.id
  }

  private static func networkName(_ id: String?) -> String? {
    guard let id, !id.isEmpty else { return nil }
    let names = ["btc--0": "Bitcoin", "evm--1": "Ethereum", "evm--56": "BNB Chain",
      "sol--101": "Solana", "evm--137": "Polygon", "evm--42161": "Arbitrum",
      "evm--10": "Optimism", "evm--8453": "Base", "evm--43114": "Avalanche",
      "evm--250": "Fantom", "evm--324": "ZKsync Era", "evm--59144": "Linea",
      "evm--534352": "Scroll", "evm--5000": "Mantle", "evm--81457": "Blast",
      "tron--0x2b6653dc": "Tron", "sui--mainnet": "Sui", "aptos--1": "Aptos"]
    if let name = names[id] { return name }
    return id.components(separatedBy: "--").map { $0.uppercased() }.joined(separator: " ")
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
    return MarketLockScreenPicker.entities(assets)
  }

  func entities(matching string: String) async throws -> [MarketLockScreenAssetEntity] {
    let query = string.trimmingCharacters(in: .whitespacesAndNewlines)
    if query.isEmpty { return try await suggestedEntities() }
    let store = MarketWidgetStore()
    let assets = try await MarketWidgetService.shared.search(query: query,
      locale: store.configuration().configuration?.locale ?? "en-US")
    return MarketLockScreenPicker.entities(assets)
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
  @Parameter(title: "market_widget_asset__title", query: MarketLockScreenAssetQuery()) var coin: MarketLockScreenAssetEntity?
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
