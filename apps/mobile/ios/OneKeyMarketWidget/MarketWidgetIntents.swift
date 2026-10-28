import AppIntents
import Foundation
import WidgetKit

@available(iOS 17.0, *)
struct MarketWidgetAssetEntity: AppEntity {
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Coin"
  static var defaultQuery = MarketWidgetAssetQuery()
  let id: String
  let asset: MarketWidgetAsset
  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(asset.displaySymbol)", subtitle: "\(asset.name)")
  }

  init(asset: MarketWidgetAsset) {
    self.asset = asset
    let encoder = JSONEncoder()
    encoder.outputFormatting = .sortedKeys
    // Preserve the selected identity, then validate it against the current export before display.
    id = (try? encoder.encode(asset).base64EncodedString()) ?? asset.id
  }

  init?(id: String) {
    guard id.count <= 4096, let data = Data(base64Encoded: id),
          let asset = try? JSONDecoder().decode(MarketWidgetAsset.self, from: data),
          asset.isValid else { return nil }
    self.id = id
    self.asset = asset
  }
}

@available(iOS 17.0, *)
struct MarketWidgetAssetQuery: EntityQuery {
  func entities(for identifiers: [String]) async throws -> [MarketWidgetAssetEntity] {
    identifiers.compactMap(MarketWidgetAssetEntity.init(id:))
  }
  func suggestedEntities() async throws -> [MarketWidgetAssetEntity] {
    let store = MarketWidgetStore()
    return (store.configuration().configuration?.displayAssets ?? []).map {
      MarketWidgetAssetEntity(asset: store.quote(for: $0)?.asset ?? $0)
    }
  }
}

@available(iOS 17.0, *)
struct MarketSingleIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "Market price"
  static var description = IntentDescription("Choose a coin. Leave empty to follow the first coin in your watchlist.")
  @Parameter(title: "Coin") var asset: MarketWidgetAssetEntity?
}

@available(iOS 17.0, *)
struct MarketSingleProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> MarketWidgetEntry { .placeholder(isWatchlist: false) }
  func snapshot(for configuration: MarketSingleIntent, in context: Context) async -> MarketWidgetEntry {
    .snapshot(isWatchlist: false, selected: configuration.asset.map { [$0.asset] })
  }
  func timeline(for configuration: MarketSingleIntent, in context: Context) async -> Timeline<MarketWidgetEntry> {
    await MarketWidgetEntry.timeline(isWatchlist: false, selected: configuration.asset.map { [$0.asset] })
  }
}

@available(iOS 17.0, *)
struct RefreshMarketWidgetIntent: AppIntent {
  static var title: LocalizedStringResource = "Refresh prices"
  static var isDiscoverable = false
  @Parameter(title: "Coins") var assetIdentifiers: [String]
  init() { assetIdentifiers = [] }
  init(assets: [MarketWidgetAsset]) {
    assetIdentifiers = assets.map { MarketWidgetAssetEntity(asset: $0).id }
  }
  func perform() async throws -> some IntentResult {
    let configuration = MarketWidgetStore().configuration().configuration
    let locale = configuration?.locale ?? "en-US"
    await withTaskGroup(of: Void.self) { group in
      for asset in assetIdentifiers.prefix(3).compactMap({ identifier in
        guard let selected = MarketWidgetAssetEntity(id: identifier)?.asset else { return nil as MarketWidgetAsset? }
        return configuration?.asset(withID: selected.id)
      }) {
        group.addTask { _ = try? await MarketWidgetService.shared.quote(for: asset, locale: locale, force: true) }
      }
    }
    return .result()
  }
}
