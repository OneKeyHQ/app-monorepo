import Foundation

actor MarketWidgetService {
  static let shared = MarketWidgetService()
  private var requests: [String: Task<MarketWidgetQuote, Error>] = [:]

  func quote(for asset: MarketWidgetAsset, locale: String, force: Bool = false) async throws -> MarketWidgetQuote {
    let store = MarketWidgetStore()
    if let cached = store.quote(for: asset),
       Date().timeIntervalSince(cached.fetchedAt) < (force ? 15 : 300) { return cached }
    if let request = requests[asset.id] { return try await request.value }
    let request = Task { try await Self.fetch(asset: asset, locale: locale) }
    requests[asset.id] = request
    defer { requests[asset.id] = nil }
    let quote = try await request.value
    try? store.saveQuote(quote)
    return quote
  }

  static func request(for asset: MarketWidgetAsset, locale: String) throws -> URLRequest {
    guard asset.isValid else { throw MarketWidgetError.invalidConfiguration }
    var components = URLComponents()
    components.scheme = "https"
    components.host = "utility.onekeycn.com"
    if asset.kind == .asset {
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

  private static func fetch(asset: MarketWidgetAsset, locale: String) async throws -> MarketWidgetQuote {
    let (data, response) = try await URLSession.shared.data(for: request(for: asset, locale: locale))
    guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode),
          data.count <= 1_048_576 else { throw MarketWidgetError.invalidResponse }
    return try decode(data, asset: asset, fetchedAt: Date())
  }

  static func decode(_ data: Data, asset: MarketWidgetAsset, fetchedAt: Date) throws -> MarketWidgetQuote {
    let envelope = try JSONDecoder().decode(Envelope.self, from: data)
    guard envelope.code == 0, let payload = envelope.data else { throw MarketWidgetError.invalidResponse }
    let fields: QuoteFields
    let symbol: String
    let name: String
    if asset.kind == .asset {
      guard let identity = payload.asset, identity.assetId == asset.assetId,
            let market = payload.market else { throw MarketWidgetError.invalidResponse }
      fields = market
      symbol = identity.symbol
      name = identity.name
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
    }
    guard let price = fields.price?.value,
          let value = MarketWidgetQuote.decimal(price), value >= 0 else {
      throw MarketWidgetError.invalidQuote
    }
    let enriched = MarketWidgetAsset(kind: asset.kind, assetId: asset.assetId,
      chainId: asset.chainId, contractAddress: asset.contractAddress, isNative: asset.isNative,
      requestTokenAddress: asset.requestTokenAddress,
      symbol: symbol, name: name)
    let quote = MarketWidgetQuote(asset: enriched, price: price,
      change24h: fields.priceChange24hPercent?.value.flatMap {
        MarketWidgetQuote.decimal($0) == nil ? nil : $0
      }, fetchedAt: fetchedAt)
    guard quote.isValid else { throw MarketWidgetError.invalidQuote }
    return quote
  }

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
  }
  private struct QuoteFields: Decodable {
    let price: NumericValue?
    let priceChange24hPercent: NumericValue?
    let address: String?
    let networkId: String?
    let isNative: Bool?
    let symbol: String?
    let name: String?
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
