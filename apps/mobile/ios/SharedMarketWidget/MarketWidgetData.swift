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
    guard symbol.count <= 80, name.count <= 200 else { return false }
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

  var isValid: Bool {
    schemaVersion == 1 && assets.count <= 20 && assets.allSatisfy(\.isValid)
      && !locale.isEmpty && locale.count <= 50
      && locale.unicodeScalars.allSatisfy {
        CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_").contains($0)
      }
      && Set(assets.map(\.id)).count == assets.count
  }

  var displayAssets: [MarketWidgetAsset] { assets.isEmpty ? MarketWidgetAsset.defaults : assets }

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

  static func decimal(_ value: String?) -> Decimal? {
    guard let value, !value.isEmpty, value.count <= 100,
          value.range(of: #"\A[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?\z"#,
                      options: .regularExpression) != nil,
          let number = Decimal(string: value, locale: Locale(identifier: "en_US_POSIX")),
          !number.isNaN else { return nil }
    return number
  }

  var isValid: Bool {
    guard asset.isValid, let value = Self.decimal(price), value >= 0 else { return false }
    return fetchedAt.timeIntervalSince1970 > 0 && fetchedAt <= Date().addingTimeInterval(60)
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
      pruneQuotes(keeping: configuration.displayAssets)
    }
    return true
  }

  func quote(for asset: MarketWidgetAsset) -> MarketWidgetQuote? {
    guard let url = quoteURL(for: asset), let data = try? Data(contentsOf: url),
          data.count <= 16_384,
          let quote = try? JSONDecoder().decode(MarketWidgetQuote.self, from: data),
          quote.asset.id == asset.id, quote.isValid else { return nil }
    return quote
  }

  func saveQuote(_ quote: MarketWidgetQuote) throws {
    guard quote.isValid else { throw MarketWidgetError.invalidQuote }
    let directory = try preparedDirectory()
    guard let url = quoteURL(for: quote.asset) else { throw MarketWidgetError.storageUnavailable }
    try coordinateWrite(at: directory) {
      guard configuration().configuration?.displayAssets.contains(where: { $0.id == quote.asset.id }) == true else {
        throw MarketWidgetError.invalidConfiguration
      }
      if let current = self.quote(for: quote.asset), current.fetchedAt > quote.fetchedAt { return }
      try JSONEncoder().encode(quote).write(to: url, options: .atomic)
    }
  }

  private func coordinateWrite(at directory: URL, action: () throws -> Void) throws {
    var coordinationError: NSError?
    var writeError: Error?
    NSFileCoordinator().coordinate(writingItemAt: directory, options: .forMerging,
                                   error: &coordinationError) { _ in
      do { try action() } catch { writeError = error }
    }
    if let error = coordinationError ?? writeError as NSError? { throw error }
  }

  private func pruneQuotes(keeping assets: [MarketWidgetAsset]) {
    guard let directory,
          let files = try? FileManager.default.contentsOfDirectory(at: directory,
            includingPropertiesForKeys: nil) else { return }
    let filenames = Set(assets.compactMap { quoteURL(for: $0)?.lastPathComponent })
    for file in files where file.lastPathComponent.hasPrefix("quote-")
      && file.pathExtension == "json" && !filenames.contains(file.lastPathComponent) {
      try? FileManager.default.removeItem(at: file)
    }
  }

  private func preparedDirectory() throws -> URL {
    guard let directory else { throw MarketWidgetError.storageUnavailable }
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory
  }

  private func quoteURL(for asset: MarketWidgetAsset) -> URL? {
    let digest = SHA256.hash(data: Data(asset.id.utf8)).map { String(format: "%02x", $0) }.joined()
    return directory?.appendingPathComponent("quote-\(digest).json")
  }
}

enum MarketWidgetError: Error {
  case invalidConfiguration, storageUnavailable, invalidQuote, invalidResponse
}
