internal import CryptoKit
import Foundation

struct MarketWidgetAsset: Codable, Hashable, Identifiable {
  enum Kind: String, Codable { case asset, token }
  let kind: Kind
  let assetId: String?
  let chainId: String?
  let contractAddress: String?
  let isNative: Bool?
  var requestTokenAddress: String? = nil
  let symbol: String
  let name: String
  var logoURL: String? = nil

  var id: String {
    switch kind {
    case .asset: return "asset:\(assetId ?? "")"
    case .token: return "token:\(chainId ?? "")|\(isNative == true)|\(contractAddress ?? "")"
    }
  }

  var displaySymbol: String {
    if !symbol.isEmpty { return symbol }
    if let assetId { return assetId }
    if isNative == true { return chainId ?? "—" }
    let address = contractAddress ?? ""
    return address.count > 14 ? "\(address.prefix(6))…\(address.suffix(4))" : address
  }

  var detailURL: URL? {
    var components = URLComponents()
    components.scheme = "onekey-wallet"
    components.host = "market_widget"
    if kind == .asset {
      components.queryItems = [URLQueryItem(name: "assetId", value: assetId)]
    } else {
      components.queryItems = [
        URLQueryItem(name: "chainId", value: chainId),
        URLQueryItem(name: "contractAddress", value: contractAddress),
        URLQueryItem(name: "isNative", value: isNative == true ? "true" : "false"),
      ]
    }
    return components.url
  }

  var isValid: Bool {
    guard symbol.count <= 80, name.count <= 200, (logoURL?.count ?? 0) <= 2048 else { return false }
    switch kind {
    case .asset:
      return Self.validIdentifier(assetId, maximum: 128) && chainId == nil
    case .token:
      guard Self.validIdentifier(chainId, maximum: 64), assetId == nil,
            let address = contractAddress, Self.validAddress(address)
      else { return false }
      if let requestTokenAddress,
         !Self.validAddress(requestTokenAddress) {
        return false
      }
      return isNative == true || !address.isEmpty
    }
  }

  private static func validAddress(_ value: String) -> Bool {
    value.count <= 256 && value.unicodeScalars.allSatisfy {
      CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._:/~-").contains($0)
    }
  }

  private static func validIdentifier(_ value: String?, maximum: Int) -> Bool {
    guard let value, !value.isEmpty, value.count <= maximum else { return false }
    return value.unicodeScalars.allSatisfy {
      CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.:")
        .contains($0)
    }
  }

  static let defaults: [MarketWidgetAsset] = [
    .init(kind: .asset, assetId: "btc", chainId: nil, contractAddress: nil,
          isNative: nil, symbol: "BTC", name: "Bitcoin"),
    .init(kind: .asset, assetId: "eth", chainId: nil, contractAddress: nil,
          isNative: nil, symbol: "ETH", name: "Ethereum"),
    .init(kind: .asset, assetId: "sol", chainId: nil, contractAddress: nil,
          isNative: nil, symbol: "SOL", name: "Solana"),
  ]
}

struct MarketWidgetConfiguration: Codable, Equatable {
  let schemaVersion: Int
  let assets: [MarketWidgetAsset]
  let greenUp: Bool
  let locale: String
  var privacyMasked: Bool? = nil

  var isValid: Bool {
    schemaVersion == 1 && assets.count <= 20 && assets.allSatisfy(\.isValid)
      && !locale.isEmpty && locale.count <= 50
      && locale.unicodeScalars.allSatisfy {
        CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_").contains($0)
      }
      && Set(assets.map(\.id)).count == assets.count
  }

  var displayAssets: [MarketWidgetAsset] {
    privacyMasked == true ? [] : (assets.isEmpty ? MarketWidgetAsset.defaults : assets)
  }

  func asset(withID id: String) -> MarketWidgetAsset? {
    displayAssets.first { $0.id == id }
  }

  static let initial = MarketWidgetConfiguration(
    schemaVersion: 1, assets: [], greenUp: true, locale: Locale.current.identifier
  )
}

enum MarketWidgetConfigurationState {
  case available(MarketWidgetConfiguration)
  case invalid

  var configuration: MarketWidgetConfiguration? {
    if case .available(let configuration) = self { return configuration }
    return nil
  }
}

struct MarketWidgetQuote: Codable {
  let asset: MarketWidgetAsset
  let price: String
  let change24h: String?
  // The API does not expose a reliable quote timestamp. This is fetch completion time.
  let fetchedAt: Date
  var chart: [MarketWidgetChartPoint]? = nil
  var chartFetchedAt: Date? = nil

  func merging(_ other: MarketWidgetQuote?, at now: Date = Date()) -> MarketWidgetQuote {
    guard let other, other.asset.id == asset.id else { return withFreshChart(at: now) }
    let latestPrice = other.fetchedAt > fetchedAt ? other : self
    let latestChart = (other.chartFetchedAt ?? .distantPast) > (chartFetchedAt ?? .distantPast) ? other : self
    return MarketWidgetQuote(asset: latestPrice.asset, price: latestPrice.price,
      change24h: latestPrice.change24h, fetchedAt: latestPrice.fetchedAt,
      chart: latestChart.chart, chartFetchedAt: latestChart.chartFetchedAt).withFreshChart(at: now)
  }

  static func decimal(_ value: String?) -> Decimal? {
    guard let value, !value.isEmpty, value.count <= 100,
          value.range(of: #"\A[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?\z"#,
                      options: .regularExpression) != nil,
          let number = Decimal(string: value, locale: Locale(identifier: "en_US_POSIX")),
          !number.isNaN else { return nil }
    return number
  }

  func withFreshChart(at now: Date = Date()) -> MarketWidgetQuote {
    var quote = self
    guard let chart, chart.count >= 12,
          let first = chart.first, let last = chart.last, last.timestamp - first.timestamp >= 18 * 3600,
          let chartFetchedAt, chartFetchedAt <= now.addingTimeInterval(60),
          now.timeIntervalSince(chartFetchedAt) < 3600 else {
      quote.chart = nil
      quote.chartFetchedAt = nil
      return quote
    }
    return quote
  }

  var isValid: Bool {
    guard asset.isValid, let value = Self.decimal(price), value >= 0 else { return false }
    if let chart {
      guard chart.count >= 2, chart.count <= 96, let chartFetchedAt,
            chartFetchedAt.timeIntervalSince1970 > 0, chartFetchedAt <= Date().addingTimeInterval(60),
            chart.allSatisfy({ $0.timestamp.isFinite && $0.value.isFinite && $0.value > 0 }) else { return false }
    }
    return fetchedAt.timeIntervalSince1970 > 0 && fetchedAt <= Date().addingTimeInterval(60)
  }
}

enum MarketWidgetKind: String, Codable, Sendable {
  case single, list
  var timelineKind: String { self == .single ? "OneKeyMarketSingle" : "OneKeyMarketWatchlist" }
}

struct MarketWidgetProfile: Codable, Equatable, Identifiable {
  let id: String
  let kind: MarketWidgetKind
  let name: String
  let source: MarketWidgetSource
  var asset: MarketWidgetAsset?

  var isValid: Bool {
    UUID(uuidString: id)?.uuidString.lowercased() == id
      && !name.isEmpty && name.count <= 40
      && name == name.trimmingCharacters(in: .whitespacesAndNewlines)
      && !name.unicodeScalars.contains(where: CharacterSet.controlCharacters.contains)
      && (kind == .single ? asset?.isValid == true : asset == nil)
  }
}

struct MarketWidgetProfileInput: Decodable {
  let id: String?
  let kind: MarketWidgetKind
  let name: String
  let source: MarketWidgetSource
  let asset: MarketWidgetAsset?
}

private struct MarketWidgetProfiles: Codable {
  let schemaVersion: Int
  let profiles: [MarketWidgetProfile]
  var isValid: Bool {
    schemaVersion == 1 && profiles.count <= 20 && profiles.allSatisfy(\.isValid)
      && Set(profiles.map(\.id)).count == profiles.count
  }
}

struct MarketWidgetEditorState: Codable {
  let profiles: [MarketWidgetProfile]
  let watchlist: [MarketWidgetAsset]
  let hot: [MarketWidgetAsset]
  let privacyMasked: Bool
  static let masked = MarketWidgetEditorState(profiles: [], watchlist: [], hot: [], privacyMasked: true)
}

struct MarketWidgetSelection: Equatable {
  let configuration: MarketWidgetConfiguration?
  let profile: MarketWidgetProfile?
  let profileID: String?
  let source: MarketWidgetSource
  let assets: [MarketWidgetAsset]
  let selectionUnavailable: Bool
  let profileUnavailable: Bool
}

enum MarketWidgetEditorLink {
  static func url(profileID: String?, kind: MarketWidgetKind) -> URL? {
    var components = URLComponents()
    components.scheme = "onekey-wallet"
    components.host = "market_widget_config"
    if let profileID, let id = UUID(uuidString: profileID)?.uuidString.lowercased() {
      components.queryItems = [URLQueryItem(name: "profileId", value: id)]
    } else {
      components.queryItems = [URLQueryItem(name: "kind", value: kind.rawValue)]
    }
    return components.url
  }
}

struct MarketWidgetStore {
  static let appGroup = "group.so.onekey.wallet"
  let directory: URL?

  init(directory: URL? = FileManager.default.containerURL(
    forSecurityApplicationGroupIdentifier: appGroup
  )?.appendingPathComponent("MarketWidget", isDirectory: true)) {
    self.directory = directory
  }

  func configuration() -> MarketWidgetConfigurationState {
    guard let directory else { return .invalid }
    let url = directory.appendingPathComponent("configuration-v1.json")
    guard FileManager.default.fileExists(atPath: url.path) else { return .available(.initial) }
    guard let data = try? Data(contentsOf: url), data.count <= 65_536,
          let configuration = try? JSONDecoder().decode(MarketWidgetConfiguration.self, from: data),
          configuration.isValid else { return .invalid }
    return .available(configuration)
  }

  @discardableResult
  func saveConfiguration(json: String) throws -> Bool {
    guard let data = json.data(using: .utf8), data.count <= 65_536 else {
      throw MarketWidgetError.invalidConfiguration
    }
    let configuration = try JSONDecoder().decode(MarketWidgetConfiguration.self, from: data)
    guard configuration.isValid else { throw MarketWidgetError.invalidConfiguration }
    if self.configuration().configuration == configuration { return false }
    let directory = try preparedDirectory()
    try coordinateWrite(at: directory) {
      try JSONEncoder().encode(configuration).write(
        to: directory.appendingPathComponent("configuration-v1.json"), options: .atomic
      )
      if configuration.privacyMasked == true {
        try? FileManager.default.removeItem(at: directory.appendingPathComponent("trending-v1.json"))
        try? FileManager.default.removeItem(at: directory.appendingPathComponent("selected-hot-v1.json"))
        try? FileManager.default.removeItem(at: directory.appendingPathComponent("lock-screen-assets-v1.json"))
        try? FileManager.default.removeItem(at: directory.appendingPathComponent("lock-screen-catalog-v1.json"))
      }
      pruneQuotes(keeping: permittedAssets())
    }
    return true
  }

  func profiles(kind: MarketWidgetKind? = nil) -> [MarketWidgetProfile] {
    guard let configuration = configuration().configuration, configuration.privacyMasked != true else { return [] }
    return ((try? storedProfiles()) ?? []).filter { kind == nil || $0.kind == kind }
  }

  func profile(id: String, kind: MarketWidgetKind) -> MarketWidgetProfile? {
    guard let id = UUID(uuidString: id)?.uuidString.lowercased() else { return nil }
    return profiles(kind: kind).first { $0.id == id }
  }

  func editorState() throws -> MarketWidgetEditorState {
    let directory = try preparedDirectory()
    var state: MarketWidgetEditorState?
    var error: NSError?
    NSFileCoordinator().coordinate(readingItemAt: directory, options: [], error: &error) { _ in
      guard let configuration = configuration().configuration else { return }
      if configuration.privacyMasked == true {
        state = .masked
        return
      }
      let profiles = profiles().map { profile -> MarketWidgetProfile in
        var enriched = profile
        if let asset = profile.asset { enriched.asset = editorAsset(asset) }
        return enriched
      }
      state = MarketWidgetEditorState(profiles: profiles,
        watchlist: assets(for: .watchlist).map(editorAsset),
        hot: assets(for: .hot).map(editorAsset), privacyMasked: false)
    }
    if let error { throw error }
    guard let state else { throw MarketWidgetError.invalidConfiguration }
    return state
  }

  private func editorAsset(_ asset: MarketWidgetAsset) -> MarketWidgetAsset {
    let enriched = assetWithMetadata(asset)
    return MarketWidgetAsset(kind: enriched.kind, assetId: enriched.assetId, chainId: enriched.chainId,
      contractAddress: enriched.contractAddress, isNative: enriched.isNative,
      requestTokenAddress: enriched.requestTokenAddress,
      symbol: enriched.displaySymbol,
      name: enriched.name.isEmpty ? (enriched.assetId ?? enriched.chainId ?? enriched.contractAddress ?? enriched.displaySymbol) : enriched.name,
      logoURL: enriched.logoURL)
  }

  func assetWithMetadata(_ asset: MarketWidgetAsset) -> MarketWidgetAsset {
    let catalogAsset = permitsRequests(for: asset) ? trending()?.assets.first { $0.id == asset.id } : nil
    let candidates = [quote(for: asset)?.asset, metadata(for: asset), asset, catalogAsset,
      lockScreenAsset(id: asset.id), storedLockScreenAssets(filename: "lock-screen-catalog-v1.json").first { $0.id == asset.id },
      MarketWidgetAsset.defaults.first { $0.id == asset.id }].compactMap { $0 }
    func value(_ keyPath: KeyPath<MarketWidgetAsset, String>) -> String {
      candidates.map { $0[keyPath: keyPath] }.first {
        !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      } ?? ""
    }
    let logoURL = candidates.compactMap(\.logoURL).first {
      !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
    // Cached display fields must not replace the source's current request identity.
    return MarketWidgetAsset(kind: asset.kind, assetId: asset.assetId, chainId: asset.chainId,
      contractAddress: asset.contractAddress, isNative: asset.isNative,
      requestTokenAddress: asset.requestTokenAddress, symbol: value(\.symbol), name: value(\.name), logoURL: logoURL)
  }

  func metadata(for asset: MarketWidgetAsset) -> MarketWidgetAsset? {
    guard let directory, permitsRequests(for: asset),
          let data = try? Data(contentsOf: directory.appendingPathComponent("metadata-\(digest(asset.id)).json")),
          data.count <= 8192,
          let decoded = try? JSONDecoder().decode(MarketWidgetAsset.self, from: data),
          decoded.id == asset.id, decoded.isValid else { return nil }
    return decoded
  }

  func saveMetadata(_ asset: MarketWidgetAsset) throws {
    guard asset.isValid else { throw MarketWidgetError.invalidResponse }
    let directory = try preparedDirectory()
    try coordinateWrite(at: directory) {
      guard permitsRequests(for: asset) else { throw MarketWidgetError.invalidConfiguration }
      let data = try JSONEncoder().encode(asset)
      guard data.count <= 8192 else { throw MarketWidgetError.invalidResponse }
      try data.write(to: directory.appendingPathComponent("metadata-\(digest(asset.id)).json"), options: .atomic)
    }
  }

  func saveProfile(json: String) throws -> MarketWidgetProfile {
    guard let data = json.data(using: .utf8), data.count <= 8192 else { throw MarketWidgetError.invalidProfile }
    let input = try JSONDecoder().decode(MarketWidgetProfileInput.self, from: data)
    let name = input.name.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !name.isEmpty, name.count <= 40,
          !name.unicodeScalars.contains(where: CharacterSet.controlCharacters.contains),
          input.kind == .single ? input.asset?.isValid == true : input.asset == nil else {
      throw MarketWidgetError.invalidProfile
    }
    let directory = try preparedDirectory()
    var result: MarketWidgetProfile?
    try coordinateWrite(at: directory) {
      guard let configuration = configuration().configuration else { throw MarketWidgetError.invalidConfiguration }
      guard configuration.privacyMasked != true else { throw MarketWidgetError.privacyMasked }
      var profiles = try storedProfiles()
      let existing: MarketWidgetProfile?
      let id: String
      if let inputID = input.id {
        guard let canonicalID = UUID(uuidString: inputID)?.uuidString.lowercased() else { throw MarketWidgetError.invalidProfile }
        guard let profile = profiles.first(where: { $0.id == canonicalID }) else { throw MarketWidgetError.profileNotFound }
        guard profile.kind == input.kind else { throw MarketWidgetError.invalidProfile }
        existing = profile
        id = canonicalID
      } else {
        guard profiles.count < 20 else { throw MarketWidgetError.profileLimitReached }
        existing = nil
        id = UUID().uuidString.lowercased()
      }
      var canonicalAsset: MarketWidgetAsset?
      if input.kind == .single, let requested = input.asset {
        canonicalAsset = assets(for: input.source).first { $0.id == requested.id }
        if canonicalAsset == nil, input.source == .hot, existing?.source == .hot,
           existing?.asset?.id == requested.id { canonicalAsset = existing?.asset }
        guard let asset = canonicalAsset else { throw MarketWidgetError.invalidProfile }
        canonicalAsset = assetWithMetadata(asset)
      }
      let profile = MarketWidgetProfile(id: id, kind: input.kind, name: name, source: input.source, asset: canonicalAsset)
      guard profile.isValid else { throw MarketWidgetError.invalidProfile }
      if let index = profiles.firstIndex(where: { $0.id == id }) { profiles[index] = profile }
      else { profiles.append(profile) }
      let encoded = try JSONEncoder().encode(MarketWidgetProfiles(schemaVersion: 1, profiles: profiles))
      guard encoded.count <= 65_536 else { throw MarketWidgetError.profileLimitReached }
      try encoded.write(to: directory.appendingPathComponent("profiles-v1.json"), options: .atomic)
      pruneQuotes(keeping: permittedAssets())
      result = profile
    }
    guard let result else { throw MarketWidgetError.storageUnavailable }
    return result
  }

  func selection(kind: MarketWidgetKind, profileID: String? = nil,
                 legacySource: MarketWidgetSource = .watchlist,
                 legacyAsset: MarketWidgetAsset? = nil) -> MarketWidgetSelection {
    let configuration = configuration().configuration
    let canonicalID = profileID.flatMap { UUID(uuidString: $0)?.uuidString.lowercased() }
    guard configuration.map({ $0.privacyMasked != true }) == true else {
      return MarketWidgetSelection(configuration: configuration, profile: nil, profileID: canonicalID,
        source: .watchlist, assets: [], selectionUnavailable: false, profileUnavailable: false)
    }
    let profile = canonicalID.flatMap { self.profile(id: $0, kind: kind) }
    if profileID != nil && profile == nil {
      return MarketWidgetSelection(configuration: configuration, profile: nil, profileID: canonicalID,
        source: .watchlist, assets: [], selectionUnavailable: false, profileUnavailable: true)
    }
    let source = profile?.source ?? legacySource
    let selected = profile?.asset ?? legacyAsset
    let available = assets(for: source)
    let resolved: [MarketWidgetAsset]
    var unavailable = false
    if kind == .single, let selected {
      let canonical = available.first { $0.id == selected.id } ?? (source == .hot && selected.isValid ? selected : nil)
      resolved = canonical.map { [$0] } ?? []
      unavailable = canonical == nil
    } else {
      resolved = Array(available.prefix(kind == .single ? 1 : 3))
    }
    return MarketWidgetSelection(configuration: configuration, profile: profile, profileID: canonicalID,
      source: source, assets: resolved, selectionUnavailable: unavailable, profileUnavailable: false)
  }

  private func storedProfiles() throws -> [MarketWidgetProfile] {
    guard let directory else { throw MarketWidgetError.storageUnavailable }
    let url = directory.appendingPathComponent("profiles-v1.json")
    guard FileManager.default.fileExists(atPath: url.path) else { return [] }
    let data = try Data(contentsOf: url)
    guard data.count <= 65_536 else { throw MarketWidgetError.invalidProfile }
    let stored = try JSONDecoder().decode(MarketWidgetProfiles.self, from: data)
    guard stored.isValid else { throw MarketWidgetError.invalidProfile }
    return stored.profiles
  }

  func quote(for asset: MarketWidgetAsset, now: Date = Date()) -> MarketWidgetQuote? {
    guard let url = quoteURL(for: asset), let data = try? Data(contentsOf: url),
          data.count <= 65_536,
          let decoded = try? JSONDecoder().decode(MarketWidgetQuote.self, from: data),
          decoded.asset.id == asset.id else { return nil }
    let quote = decoded.withFreshChart(at: now)
    return quote.isValid ? quote : nil
  }

  func saveQuote(_ quote: MarketWidgetQuote) throws {
    guard quote.isValid else { throw MarketWidgetError.invalidQuote }
    let directory = try preparedDirectory()
    guard let url = quoteURL(for: quote.asset) else { throw MarketWidgetError.storageUnavailable }
    try coordinateWrite(at: directory) {
      guard permittedAssets().contains(where: { $0.id == quote.asset.id }) else {
        throw MarketWidgetError.invalidConfiguration
      }
      // Price-only updates and chart completions can arrive in either order, including across processes.
      let merged = quote.merging(self.quote(for: quote.asset))
      try JSONEncoder().encode(merged).write(to: url, options: .atomic)
    }
  }

  func assets(for source: MarketWidgetSource) -> [MarketWidgetAsset] {
    guard let configuration = configuration().configuration, configuration.privacyMasked != true else { return [] }
    return source == .hot ? trending()?.assets ?? []
      : (configuration.privacyMasked == true ? [] : configuration.assets)
  }

  func permitsRequests(for asset: MarketWidgetAsset) -> Bool {
    permittedAssets().contains { $0.id == asset.id }
  }

  private func permittedAssets() -> [MarketWidgetAsset] {
    guard let configuration = configuration().configuration, configuration.privacyMasked != true else { return [] }
    return configuration.assets + (trending()?.assets ?? []) + savedHotSelections()
      + ((try? storedProfiles()) ?? []).filter { $0.source == .hot }.compactMap(\.asset)
      + lockScreenAssets()
  }

  func lockScreenAsset(id: String) -> MarketWidgetAsset? {
    lockScreenAssets().first { $0.id == id }
  }

  private func lockScreenAssets() -> [MarketWidgetAsset] {
    storedLockScreenAssets(filename: "lock-screen-assets-v1.json")
  }

  private func storedLockScreenAssets(filename: String) -> [MarketWidgetAsset] {
    guard let configuration = configuration().configuration, configuration.privacyMasked != true,
          let directory,
          let data = try? Data(contentsOf: directory.appendingPathComponent(filename)),
          data.count <= 1_048_576,
          let stored = try? JSONDecoder().decode(MarketWidgetLockScreenAssets.self, from: data),
          stored.schemaVersion == 1, stored.assets.count <= 256,
          stored.assets.allSatisfy(\.isValid), Set(stored.assets.map(\.id)).count == stored.assets.count else { return [] }
    return stored.assets
  }

  // Public picker metadata is separate from selections and never permits quote requests on its own.
  func cacheLockScreenCandidates(_ assets: [MarketWidgetAsset]) throws {
    guard assets.count <= 100, assets.allSatisfy(\.isValid) else { throw MarketWidgetError.invalidConfiguration }
    let directory = try preparedDirectory()
    try coordinateWrite(at: directory) {
      guard let configuration = configuration().configuration, configuration.privacyMasked != true else {
        throw MarketWidgetError.privacyMasked
      }
      let previous = storedLockScreenAssets(filename: "lock-screen-catalog-v1.json")
      if assets.allSatisfy({ asset in previous.contains(asset) }) { return }
      var seen = Set<String>()
      let merged = (assets + previous).filter { seen.insert($0.id).inserted }
      let stored = MarketWidgetLockScreenAssets(schemaVersion: 1, assets: Array(merged.prefix(256)))
      let data = try JSONEncoder().encode(stored)
      guard data.count <= 1_048_576 else { throw MarketWidgetError.invalidConfiguration }
      try data.write(to: directory.appendingPathComponent("lock-screen-catalog-v1.json"), options: .atomic)
    }
  }

  // Intent entities retain their public identity, so an evicted cache entry can be restored on resolution.
  func rememberLockScreenAssets(_ assets: [MarketWidgetAsset]) throws {
    guard assets.count <= 100, assets.allSatisfy(\.isValid) else { throw MarketWidgetError.invalidConfiguration }
    let directory = try preparedDirectory()
    try coordinateWrite(at: directory) {
      guard let configuration = configuration().configuration, configuration.privacyMasked != true else {
        throw MarketWidgetError.privacyMasked
      }
      var seen = Set<String>()
      let enriched = assets.map { assetWithMetadata($0) }
      let merged = (enriched + lockScreenAssets()).filter { seen.insert($0.id).inserted }
      let stored = MarketWidgetLockScreenAssets(schemaVersion: 1, assets: Array(merged.prefix(256)))
      let data = try JSONEncoder().encode(stored)
      guard data.count <= 1_048_576 else { throw MarketWidgetError.invalidConfiguration }
      try data.write(to: directory.appendingPathComponent("lock-screen-assets-v1.json"), options: .atomic)
      pruneQuotes(keeping: permittedAssets())
    }
  }

  private func savedHotSelections() -> [MarketWidgetAsset] {
    guard let directory,
          let data = try? Data(contentsOf: directory.appendingPathComponent("selected-hot-v1.json")), data.count <= 65_536,
          let catalog = try? JSONDecoder().decode(MarketWidgetCatalog.self, from: data), catalog.isValid else { return [] }
    return catalog.assets
  }

  // Keep selected public identities after they leave the ranking. WidgetKit owns the selection itself.
  func rememberHotAsset(_ asset: MarketWidgetAsset) throws {
    guard asset.isValid else { throw MarketWidgetError.invalidConfiguration }
    let directory = try preparedDirectory()
    try coordinateWrite(at: directory) {
      guard let configuration = configuration().configuration, configuration.privacyMasked != true else {
        throw MarketWidgetError.invalidConfiguration
      }
      let assets = [asset] + savedHotSelections().filter { $0.id != asset.id }
      let catalog = MarketWidgetCatalog(assets: Array(assets.prefix(20)), fetchedAt: Date())
      try JSONEncoder().encode(catalog).write(to: directory.appendingPathComponent("selected-hot-v1.json"), options: .atomic)
      pruneQuotes(keeping: permittedAssets())
    }
  }

  func trending() -> MarketWidgetCatalog? {
    guard let directory,
          let data = try? Data(contentsOf: directory.appendingPathComponent("trending-v1.json")),
          data.count <= 65_536,
          let catalog = try? JSONDecoder().decode(MarketWidgetCatalog.self, from: data),
          catalog.isValid else { return nil }
    return catalog
  }

  func saveTrending(_ catalog: MarketWidgetCatalog) throws {
    guard catalog.isValid else { throw MarketWidgetError.invalidResponse }
    let directory = try preparedDirectory()
    try coordinateWrite(at: directory) {
      guard let configuration = configuration().configuration, configuration.privacyMasked != true else { throw MarketWidgetError.invalidConfiguration }
      try JSONEncoder().encode(catalog).write(
        to: directory.appendingPathComponent("trending-v1.json"), options: .atomic)
      pruneQuotes(keeping: permittedAssets())
    }
  }

  func icon(for asset: MarketWidgetAsset) -> Data? {
    guard let directory,
          let data = try? Data(contentsOf: directory.appendingPathComponent("icon-\(digest(asset.id)).png")),
          data.count <= 131_072 else { return nil }
    return data
  }

  func saveIcon(_ data: Data, for asset: MarketWidgetAsset) throws {
    guard data.count <= 131_072 else { return }
    let directory = try preparedDirectory()
    try coordinateWrite(at: directory) {
      guard permittedAssets().contains(where: { $0.id == asset.id }) else { throw MarketWidgetError.invalidConfiguration }
      try data.write(to: directory.appendingPathComponent("icon-\(digest(asset.id)).png"), options: .atomic)
    }
  }

  private func digest(_ value: String) -> String {
    SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
  }

  private func coordinateWrite(at directory: URL, action: () throws -> Void) throws {
    var coordinationError: NSError?
    var writeError: Error?
    NSFileCoordinator().coordinate(writingItemAt: directory, options: .forMerging,
                                   error: &coordinationError) { _ in
      do { try action() } catch { writeError = error }
    }
    if let coordinationError { throw coordinationError }
    if let writeError { throw writeError }
  }

  private func pruneQuotes(keeping assets: [MarketWidgetAsset]) {
    guard let directory,
          let files = try? FileManager.default.contentsOfDirectory(at: directory,
            includingPropertiesForKeys: nil) else { return }
    let filenames = Set(assets.flatMap { asset in
      ["quote-\(digest(asset.id)).json", "icon-\(digest(asset.id)).png", "metadata-\(digest(asset.id)).json"]
    })
    for file in files where (file.lastPathComponent.hasPrefix("quote-") || file.lastPathComponent.hasPrefix("icon-") || file.lastPathComponent.hasPrefix("metadata-"))
      && !filenames.contains(file.lastPathComponent) {
      try? FileManager.default.removeItem(at: file)
    }
  }

  private func preparedDirectory() throws -> URL {
    guard let directory else { throw MarketWidgetError.storageUnavailable }
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory
  }

  private func quoteURL(for asset: MarketWidgetAsset) -> URL? {
    let digest = digest(asset.id)
    return directory?.appendingPathComponent("quote-\(digest).json")
  }
}

enum MarketWidgetSource: String, Codable, CaseIterable, Sendable { case watchlist, hot }

struct MarketWidgetChartPoint: Codable {
  let timestamp: Double
  let value: Double
}

struct MarketWidgetCatalog: Codable {
  let assets: [MarketWidgetAsset]
  let fetchedAt: Date
  var isValid: Bool {
    !assets.isEmpty && assets.count <= 20 && assets.allSatisfy(\.isValid)
      && Set(assets.map(\.id)).count == assets.count
      && fetchedAt.timeIntervalSince1970 > 0 && fetchedAt <= Date().addingTimeInterval(60)
  }
}

private struct MarketWidgetLockScreenAssets: Codable {
  let schemaVersion: Int
  let assets: [MarketWidgetAsset]
}

enum MarketWidgetError: Error {
  case invalidConfiguration, storageUnavailable, invalidQuote, invalidResponse
  case invalidProfile, profileNotFound, profileLimitReached, privacyMasked
}
