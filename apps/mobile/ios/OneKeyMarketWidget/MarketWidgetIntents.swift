import AppIntents
import Foundation
import WidgetKit

@available(iOS 17.0, *)
extension MarketWidgetSource: AppEnum {
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "market_widget_source__title"
  static var caseDisplayRepresentations: [MarketWidgetSource: DisplayRepresentation] = [
    .watchlist: "market_widget_watchlist__title", .hot: "market_widget_hot_coins__title",
  ]
}

@available(iOS 17.0, *)
struct MarketWidgetAssetEntity: AppEntity {
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "market_widget_coin__title"
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
struct MarketWidgetAssetQuery: EntityStringQuery {
  @IntentParameterDependency<MarketSingleIntent>(\.$source) private var intent

  func entities(for identifiers: [String]) async throws -> [MarketWidgetAssetEntity] {
    guard let configuration = MarketWidgetStore().configuration().configuration,
          configuration.privacyMasked != true else { return [] }
    return identifiers.compactMap(MarketWidgetAssetEntity.init(id:))
  }
  func suggestedEntities() async throws -> [MarketWidgetAssetEntity] {
    let store = MarketWidgetStore()
    let source = intent?.source ?? .hot
    if source == .hot {
      _ = try? await MarketWidgetService.shared.trending(locale: store.configuration().configuration?.locale ?? "en-US")
    }
    return store.assets(for: source).map {
      MarketWidgetAssetEntity(asset: store.quote(for: $0)?.asset ?? $0)
    }
  }
  func entities(matching string: String) async throws -> [MarketWidgetAssetEntity] {
    try await suggestedEntities().filter {
      string.isEmpty || $0.asset.name.localizedCaseInsensitiveContains(string)
        || $0.asset.displaySymbol.localizedCaseInsensitiveContains(string)
    }
  }
}

@available(iOS 17.0, *)
struct MarketSingleProfileEntity: AppEntity {
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "market_widget_configuration__title"
  static var defaultQuery = MarketSingleProfileQuery()
  let id: String
  let name: String
  var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
}

@available(iOS 17.0, *)
struct MarketSingleProfileQuery: EntityStringQuery {
  func entities(for identifiers: [String]) async throws -> [MarketSingleProfileEntity] {
    let store = MarketWidgetStore()
    return identifiers.compactMap { value in
      guard let id = UUID(uuidString: value)?.uuidString.lowercased() else { return nil }
      let profile = store.profile(id: id, kind: .single)
      return MarketSingleProfileEntity(id: id,
        name: profile.map { MarketWidgetLocalization.profileName($0) }
          ?? String(localized: "market_widget_configuration_unavailable__msg"))
    }
  }
  func suggestedEntities() async throws -> [MarketSingleProfileEntity] {
    MarketWidgetStore().profiles(kind: .single).map {
      MarketSingleProfileEntity(id: $0.id, name: MarketWidgetLocalization.profileName($0))
    }
  }
  func entities(matching string: String) async throws -> [MarketSingleProfileEntity] {
    try await suggestedEntities().filter { string.isEmpty || $0.name.localizedCaseInsensitiveContains(string) }
  }
  func defaultResult() async throws -> MarketSingleProfileEntity? { nil }
}

@available(iOS 17.0, *)
struct MarketListProfileEntity: AppEntity {
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "market_widget_configuration__title"
  static var defaultQuery = MarketListProfileQuery()
  let id: String
  let name: String
  var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
}

@available(iOS 17.0, *)
struct MarketListProfileQuery: EntityStringQuery {
  func entities(for identifiers: [String]) async throws -> [MarketListProfileEntity] {
    let store = MarketWidgetStore()
    return identifiers.compactMap { value in
      guard let id = UUID(uuidString: value)?.uuidString.lowercased() else { return nil }
      let profile = store.profile(id: id, kind: .list)
      return MarketListProfileEntity(id: id,
        name: profile.map { MarketWidgetLocalization.profileName($0) }
          ?? String(localized: "market_widget_configuration_unavailable__msg"))
    }
  }
  func suggestedEntities() async throws -> [MarketListProfileEntity] {
    MarketWidgetStore().profiles(kind: .list).map {
      MarketListProfileEntity(id: $0.id, name: MarketWidgetLocalization.profileName($0))
    }
  }
  func entities(matching string: String) async throws -> [MarketListProfileEntity] {
    try await suggestedEntities().filter { string.isEmpty || $0.name.localizedCaseInsensitiveContains(string) }
  }
  func defaultResult() async throws -> MarketListProfileEntity? { nil }
}

@available(iOS 17.0, *)
struct MarketSingleIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "market_widget_single__title"
  static var description = IntentDescription("market_widget_choose_configuration__desc")
  @Parameter(title: "market_widget_configuration__title") var profile: MarketSingleProfileEntity?
  @Parameter(title: "market_widget_source__title", default: .hot) var source: MarketWidgetSource?
  @Parameter(title: "market_widget_coin__title") var asset: MarketWidgetAssetEntity?
  static var parameterSummary: some ParameterSummary {
    Summary { \.$profile }
  }
}

@available(iOS 17.0, *)
struct MarketListIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "market_widget_list__title"
  static var description = IntentDescription("market_widget_choose_configuration__desc")
  @Parameter(title: "market_widget_configuration__title") var profile: MarketListProfileEntity?
  @Parameter(title: "market_widget_source__title", default: .hot) var source: MarketWidgetSource?
  static var parameterSummary: some ParameterSummary { Summary { \.$profile } }
}

@available(iOS 17.0, *)
struct MarketSingleProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> MarketWidgetEntry { .placeholder(isWatchlist: false) }
  func snapshot(for configuration: MarketSingleIntent, in context: Context) async -> MarketWidgetEntry {
    if context.isPreview {
      return await MarketWidgetEntry.timeline(isWatchlist: false).entries.first ?? .placeholder(isWatchlist: false)
    }
    return .snapshot(isWatchlist: false)
  }
  func timeline(for configuration: MarketSingleIntent, in context: Context) async -> Timeline<MarketWidgetEntry> {
    await MarketWidgetEntry.timeline(isWatchlist: false)
  }
}

@available(iOS 17.0, *)
struct MarketListProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> MarketWidgetEntry { .placeholder(isWatchlist: true) }
  func snapshot(for configuration: MarketListIntent, in context: Context) async -> MarketWidgetEntry {
    if context.isPreview {
      return await MarketWidgetEntry.timeline(isWatchlist: true)
        .entries.first ?? .placeholder(isWatchlist: true)
    }
    return .snapshot(isWatchlist: true)
  }
  func timeline(for configuration: MarketListIntent, in context: Context) async -> Timeline<MarketWidgetEntry> {
    await MarketWidgetEntry.timeline(isWatchlist: true)
  }
}
