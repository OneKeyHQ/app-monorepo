import Foundation

struct AppClipMarketAsset: Identifiable, Equatable {
  let id: String
  let symbol: String
  let name: String
  let address: String
  let networkId: String
  let networkName: String?
  let isNative: Bool
  let logoURLs: [URL]
  let networkLogoURL: URL?
  let price: Double?
  let priceChangePercent: Double?
  let turnover: Double?

  var detailSubtitle: String {
    networkName ?? networkId
  }
}

struct AppClipMarketCategory: Identifiable, Equatable {
  let id: String
  let name: String
}

struct AppClipMarketNetwork: Identifiable, Equatable {
  let id: String
  let name: String
  let logoURL: URL?
}

struct AppClipMarketConfiguration: Equatable {
  let networks: [AppClipMarketNetwork]
  let stockCategories: [AppClipMarketCategory]
  let perpsCategories: [AppClipMarketCategory]
  let minLiquidity: Double
}

struct AppClipMarketStock: Identifiable, Equatable {
  let id: String
  let symbol: String
  let name: String
  let logoURL: URL?
  let price: Double?
  let priceChangePercent: Double?
  let volume: Double?
}

struct AppClipMarketStockPage: Equatable {
  let items: [AppClipMarketStock]
  let nextCursor: String?
}

struct AppClipMarketPerp: Identifiable, Equatable {
  let id: String
  let displayName: String
  let logoURL: URL?
  let maxLeverage: Double?
  let markPrice: Double?
  let priceChangePercent: Double?
  let volume: Double?
}

enum AppClipMarketTimeRange: String, CaseIterable, Identifiable {
  case fiveMinutes = "5m"
  case oneHour = "1h"
  case fourHours = "4h"
  case oneDay = "24h"

  var id: String { rawValue }

  var apiValue: String {
    switch self {
    case .fiveMinutes:
      return "1"
    case .oneHour:
      return "2"
    case .fourHours:
      return "3"
    case .oneDay:
      return "4"
    }
  }
}

struct AppClipCandle: Identifiable, Equatable {
  let o: Double
  let h: Double
  let l: Double
  let c: Double
  let v: Double
  let t: Double

  var id: Double { t }
}

struct AppClipKlineResult {
  let candles: [AppClipCandle]
  let isCloseOnly: Bool
}

enum AppClipMarketServiceError: Error {
  case business(code: Int, message: String?)
  case missingData
}

private struct MarketAPIEnvelope<Payload: Decodable>: Decodable {
  let code: Int
  let message: String?
  let data: Payload?
}

private struct MarketBasicConfigPayload: Decodable {
  let networkList: [MarketNetworkItem]?
  let minLiquidity: MarketScalar?
  let stockCategories: [MarketStockCategoryItem]?
  let perpsCategories: [MarketPerpsCategoryItem]?
}

private struct MarketNetworkItem: Decodable {
  let networkId: String
  let name: String
  let logoUrl: String?
}

private struct MarketStockCategoryItem: Decodable {
  let category: String
  let name: String
}

private struct MarketPerpsCategoryItem: Decodable {
  let categoryId: String
  let name: String
}

private struct MarketTokenListPayload: Decodable {
  let list: [MarketTokenListItem]
}

private struct MarketTokenListItem: Decodable {
  let address: String
  let isNative: Bool?
  let logoUrl: String?
  let logoUrls: [String]?
  let name: String
  let networkId: String?
  let price: MarketScalar?
  let priceChange5mPercent: MarketScalar?
  let priceChange1hPercent: MarketScalar?
  let priceChange4hPercent: MarketScalar?
  let priceChange24hPercent: MarketScalar?
  let symbol: String
  let volume5m: MarketScalar?
  let volume1h: MarketScalar?
  let volume4h: MarketScalar?
  let volume24h: MarketScalar?

  func priceChange(for timeRange: AppClipMarketTimeRange) -> Double? {
    let selected: MarketScalar?
    switch timeRange {
    case .fiveMinutes:
      selected = priceChange5mPercent
    case .oneHour:
      selected = priceChange1hPercent
    case .fourHours:
      selected = priceChange4hPercent
    case .oneDay:
      selected = priceChange24hPercent
    }
    return (selected ?? priceChange24hPercent)?.doubleValue
  }

  func volume(for timeRange: AppClipMarketTimeRange) -> Double? {
    let selected: MarketScalar?
    switch timeRange {
    case .fiveMinutes:
      selected = volume5m
    case .oneHour:
      selected = volume1h
    case .fourHours:
      selected = volume4h
    case .oneDay:
      selected = volume24h
    }
    return (selected ?? volume24h)?.doubleValue
  }
}

private struct MarketStockListPayload: Decodable {
  let items: [MarketStockListItem]
  let nextCursor: String?
}

private struct MarketStockListItem: Decodable {
  let stockId: String
  let symbol: String
  let name: String
  let logoUrl: String?
  let price: MarketScalar?
  let priceChange24hPercent: MarketScalar?
  let volume24h: MarketScalar?
}

private struct MarketPerpsListPayload: Decodable {
  let tokens: [MarketPerpsListItem]
}

private struct MarketPerpsListItem: Decodable {
  let name: String
  let displayName: String
  let maxLeverage: MarketScalar?
  let tokenImageUrl: String?
  let markPrice: MarketScalar?
  let change24hPercent: MarketScalar?
  let volume24h: MarketScalar?
}

private struct KlinePayload: Decodable {
  let points: [RuntimeCandle]
}

private struct RuntimeCandle: Decodable {
  let o: MarketScalar?
  let h: MarketScalar?
  let l: MarketScalar?
  let c: MarketScalar?
  let v: MarketScalar?
  let t: MarketScalar?
}

private enum CandleSamplingStrategy {
  case latest(maximumPointCount: Int)
  case evenlySpaced(maximumPointCount: Int)
}

private struct MarketScalar: Decodable {
  let rawValue: String

  var doubleValue: Double? {
    guard let value = Double(rawValue), value.isFinite else {
      return nil
    }
    return value
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    if let value = try? container.decode(String.self) {
      rawValue = value
    } else if let value = try? container.decode(Double.self) {
      rawValue = String(value)
    } else if let value = try? container.decode(Int.self) {
      rawValue = String(value)
    } else {
      throw DecodingError.typeMismatch(
        String.self,
        .init(codingPath: decoder.codingPath, debugDescription: "Expected a numeric value")
      )
    }
  }
}

actor AppClipMarketService {
  func fetchConfiguration(baseURL: URL) async throws -> AppClipMarketConfiguration {
    var components = URLComponents(
      url: baseURL.appendingPathComponent("utility/v2/market/basic-config"),
      resolvingAgainstBaseURL: false
    )
    components?.queryItems = [URLQueryItem(name: "configVersion", value: "2")]
    guard let endpoint = components?.url else {
      throw URLError(.badURL)
    }
    let payload = try await requestPayload(MarketBasicConfigPayload.self, endpoint: endpoint)
    return AppClipMarketConfiguration(
      networks: (payload.networkList ?? []).map { network in
        AppClipMarketNetwork(
          id: network.networkId,
          name: network.name,
          logoURL: network.logoUrl.flatMap(Self.allowedLogoURL)
        )
      },
      stockCategories: (payload.stockCategories ?? []).map { category in
        AppClipMarketCategory(id: category.category, name: category.name)
      },
      perpsCategories: (payload.perpsCategories ?? []).map { category in
        AppClipMarketCategory(id: category.categoryId, name: category.name)
      },
      minLiquidity: payload.minLiquidity?.doubleValue ?? 5_000
    )
  }

  func fetchStocks(
    baseURL: URL,
    category: String?,
    cursor: String? = nil,
    limit: Int = 20
  ) async throws -> AppClipMarketStockPage {
    var components = URLComponents(
      url: baseURL.appendingPathComponent("utility/v1/stocks"),
      resolvingAgainstBaseURL: false
    )
    components?.queryItems = [
      URLQueryItem(name: "cursor", value: cursor),
      URLQueryItem(name: "limit", value: String(limit)),
      URLQueryItem(name: "category", value: category),
      URLQueryItem(name: "sortBy", value: "volume24h"),
      URLQueryItem(name: "sortType", value: "desc"),
    ].filter { $0.value != nil }
    guard let endpoint = components?.url else {
      throw URLError(.badURL)
    }
    let payload = try await requestPayload(MarketStockListPayload.self, endpoint: endpoint)
    return AppClipMarketStockPage(
      items: payload.items.map { item in
        AppClipMarketStock(
          id: item.stockId,
          symbol: item.symbol,
          name: item.name,
          logoURL: item.logoUrl.flatMap(Self.allowedLogoURL),
          price: item.price?.doubleValue,
          priceChangePercent: item.priceChange24hPercent?.doubleValue,
          volume: item.volume24h?.doubleValue
        )
      },
      nextCursor: payload.nextCursor.flatMap { $0.isEmpty ? nil : $0 }
    )
  }

  func fetchPerps(
    baseURL: URL,
    category: String
  ) async throws -> [AppClipMarketPerp] {
    var components = URLComponents(
      url: baseURL.appendingPathComponent("utility/v2/market/perps/token-list"),
      resolvingAgainstBaseURL: false
    )
    components?.queryItems = [
      URLQueryItem(name: "category", value: category),
      // Keep aligned with PERPS_ASSET_TYPE_VERSION in the shared Hyperliquid contract.
      URLQueryItem(name: "assetTypeVersion", value: "3"),
    ]
    guard let endpoint = components?.url else {
      throw URLError(.badURL)
    }
    let payload = try await requestPayload(MarketPerpsListPayload.self, endpoint: endpoint)
    return payload.tokens.map { item in
      AppClipMarketPerp(
        id: item.name,
        displayName: item.displayName,
        logoURL: item.tokenImageUrl.flatMap(Self.allowedLogoURL),
        maxLeverage: item.maxLeverage?.doubleValue,
        markPrice: item.markPrice?.doubleValue,
        priceChangePercent: item.change24hPercent?.doubleValue,
        volume: item.volume24h?.doubleValue
      )
    }
  }

  func fetchMarketAssets(
    baseURL: URL,
    networkId: String,
    timeRange: AppClipMarketTimeRange,
    minLiquidity: Double,
    networks: [AppClipMarketNetwork]
  ) async throws -> [AppClipMarketAsset] {
    var components = URLComponents(
      url: baseURL.appendingPathComponent("utility/v2/market/token/list"),
      resolvingAgainstBaseURL: false
    )
    components?.queryItems = [
      URLQueryItem(name: "networkId", value: networkId),
      URLQueryItem(name: "sortBy", value: "v24hUSD"),
      URLQueryItem(name: "sortType", value: "desc"),
      URLQueryItem(name: "page", value: "1"),
      URLQueryItem(name: "limit", value: "20"),
      URLQueryItem(name: "minLiquidity", value: String(minLiquidity)),
      URLQueryItem(name: "type", value: "trending"),
      URLQueryItem(name: "timeFrame", value: timeRange.apiValue),
      URLQueryItem(name: "currency", value: "usd"),
    ]
    guard let endpoint = components?.url else {
      throw URLError(.badURL)
    }
    let payload = try await requestPayload(MarketTokenListPayload.self, endpoint: endpoint)
    let networkById = Dictionary(
      networks.map { ($0.id, $0) },
      uniquingKeysWith: { first, _ in first }
    )
    return payload.list.compactMap { token in
      guard let tokenNetworkId = token.networkId, !tokenNetworkId.isEmpty else {
        return nil
      }
      let network = networkById[tokenNetworkId]
      let logoURLs = ([token.logoUrl].compactMap { $0 } + (token.logoUrls ?? []))
        .reduce(into: [URL]()) { result, value in
          guard
            let url = Self.allowedLogoURL(value),
            !result.contains(url)
          else {
            return
          }
          result.append(url)
        }
      let isNative = token.isNative ?? token.address.isEmpty
      let normalizedAddress = isNative ? "" : token.address
      return AppClipMarketAsset(
        id: "\(tokenNetworkId):\(isNative ? "native" : normalizedAddress.lowercased())",
        symbol: token.symbol,
        name: token.name,
        address: normalizedAddress,
        networkId: tokenNetworkId,
        networkName: network?.name,
        isNative: isNative,
        logoURLs: logoURLs,
        networkLogoURL: network?.logoURL,
        price: token.price?.doubleValue,
        priceChangePercent: token.priceChange(for: timeRange),
        turnover: token.volume(for: timeRange)
      )
    }
  }

  func fetchCandles(
    asset: AppClipMarketAsset,
    interval: String,
    baseURL: URL
  ) async throws -> AppClipKlineResult {
    let normalizedInterval = Self.normalizedInterval(interval)
    let timeTo = Int(Date().timeIntervalSince1970)
    let timeFrom = timeTo - Self.timeSpan(for: normalizedInterval)
    var components = URLComponents(
      url: baseURL.appendingPathComponent("utility/v2/market/token/kline"),
      resolvingAgainstBaseURL: false
    )
    components?.queryItems = [
      URLQueryItem(name: "tokenAddress", value: asset.address),
      URLQueryItem(name: "networkId", value: asset.networkId),
      URLQueryItem(name: "interval", value: normalizedInterval),
      URLQueryItem(name: "timeFrom", value: String(timeFrom)),
      URLQueryItem(name: "timeTo", value: String(timeTo)),
      URLQueryItem(name: "currency", value: "usd"),
    ]
    guard let endpoint = components?.url else {
      throw URLError(.badURL)
    }
    let payload = try await requestPayload(KlinePayload.self, endpoint: endpoint)
    return Self.normalizeCandles(
      payload.points,
      timeFrom: Double(timeFrom),
      timeTo: Double(timeTo)
    )
  }

  func fetchStockCandles(
    stockID: String,
    period: String,
    baseURL: URL
  ) async throws -> AppClipKlineResult {
    let normalizedPeriod = period.lowercased()
    guard ["1h", "1d", "1w", "1m", "1y", "all"].contains(normalizedPeriod) else {
      throw URLError(.badURL)
    }
    guard
      !stockID.isEmpty,
      let encodedStockID = stockID.addingPercentEncoding(
        withAllowedCharacters: Self.pathSegmentAllowed
      ),
      var components = URLComponents(
        url: baseURL.appendingPathComponent("utility/v1/stocks"),
        resolvingAgainstBaseURL: false
      )
    else {
      throw URLError(.badURL)
    }
    components.percentEncodedPath += "/\(encodedStockID)/chart"
    components.queryItems = [URLQueryItem(name: "period", value: normalizedPeriod)]
    guard let endpoint = components.url else {
      throw URLError(.badURL)
    }
    let payload = try await requestPayload(KlinePayload.self, endpoint: endpoint)
    return Self.normalizeCandles(
      payload.points,
      timeFrom: 0,
      timeTo: Double.greatestFiniteMagnitude,
      samplingStrategy: .evenlySpaced(maximumPointCount: 300)
    )
  }

  func fetchPerpCandles(
    coin: String,
    interval: String,
    timeFrom: Int,
    timeTo: Int
  ) async throws -> AppClipKlineResult {
    let normalizedInterval = interval.lowercased()
    guard
      !coin.isEmpty,
      timeFrom < timeTo,
      ["1m", "15m", "1h", "4h"].contains(normalizedInterval),
      let endpoint = URL(string: "https://api.hyperliquid.xyz/info"),
      endpoint.scheme == "https",
      endpoint.host == "api.hyperliquid.xyz",
      endpoint.user == nil,
      endpoint.password == nil,
      endpoint.port == nil
    else {
      throw URLError(.badURL)
    }
    var request = URLRequest(url: endpoint)
    request.httpMethod = "POST"
    request.timeoutInterval = 10
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONSerialization.data(withJSONObject: [
      "type": "candleSnapshot",
      "req": [
        "coin": coin,
        "interval": normalizedInterval,
        "startTime": Int64(timeFrom) * 1_000,
        "endTime": Int64(timeTo) * 1_000,
      ],
    ])
    let (data, response) = try await URLSession.shared.data(for: request)
    guard
      let response = response as? HTTPURLResponse,
      (200..<300).contains(response.statusCode)
    else {
      throw URLError(.badServerResponse)
    }
    let points = try JSONDecoder().decode([RuntimeCandle].self, from: data)
    return Self.normalizeCandles(
      points,
      timeFrom: Double(timeFrom),
      timeTo: Double(timeTo),
      timestampDivisor: 1_000
    )
  }

  private func requestPayload<Payload: Decodable>(
    _ type: Payload.Type,
    endpoint: URL
  ) async throws -> Payload {
    let data = try await requestData(endpoint)
    let envelope = try JSONDecoder().decode(MarketAPIEnvelope<Payload>.self, from: data)
    guard envelope.code == 0 else {
      throw AppClipMarketServiceError.business(code: envelope.code, message: envelope.message)
    }
    guard let payload = envelope.data else {
      throw AppClipMarketServiceError.missingData
    }
    return payload
  }

  private func requestData(_ endpoint: URL) async throws -> Data {
    var request = URLRequest(url: endpoint)
    request.timeoutInterval = 10
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.setValue(Self.userAgent, forHTTPHeaderField: "User-Agent")
    request.setValue("ios", forHTTPHeaderField: "X-Onekey-Request-Platform")
    request.setValue("OneKey App Clip", forHTTPHeaderField: "X-Onekey-Request-Platform-Name")
    request.setValue("OneKey Wallet App Clip", forHTTPHeaderField: "X-Onekey-Request-Device-Name")
    request.setValue("usd", forHTTPHeaderField: "X-Onekey-Request-Currency")
    request.setValue(Self.requestLocale, forHTTPHeaderField: "X-Onekey-Request-Locale")
    request.setValue(Self.version, forHTTPHeaderField: "X-Onekey-Request-Version")
    request.setValue(Self.buildNumber, forHTTPHeaderField: "X-Onekey-Request-Build-Number")
    let requestId = UUID().uuidString
    request.setValue(requestId, forHTTPHeaderField: "X-Onekey-Request-ID")
    request.setValue(requestId, forHTTPHeaderField: "X-Amzn-Trace-Id")
    let (data, response) = try await URLSession.shared.data(for: request)
    guard
      let response = response as? HTTPURLResponse,
      (200..<300).contains(response.statusCode)
    else {
      throw URLError(.badServerResponse)
    }
    return data
  }

  private static var userAgent: String {
    "OneKeyWallet/\(version)"
  }

  private static var version: String {
    Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1"
  }

  private static var buildNumber: String {
    Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
  }

  private static var requestLocale: String {
    let localization = Bundle.main.preferredLocalizations.first?.lowercased() ?? "en"
    return localization.hasPrefix("zh-hans") ? "zh-cn" : "en-us"
  }

  private static let pathSegmentAllowed = CharacterSet(
    charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
  )

  private static func allowedLogoURL(_ value: String) -> URL? {
    URL(string: value).flatMap(allowedLogoURL)
  }

  static func allowedLogoURL(_ url: URL) -> URL? {
    guard
      url.scheme?.lowercased() == "https",
      let host = url.host?.lowercased(),
      host == "onekey-asset.com" || host.hasSuffix(".onekey-asset.com"),
      url.user == nil,
      url.password == nil,
      url.port == nil || url.port == 443,
      url.pathExtension.lowercased() != "svg"
    else {
      return nil
    }
    return url
  }

  private static func normalizedInterval(_ interval: String) -> String {
    let suffix = interval.suffix(1).lowercased()
    if suffix == "m" || suffix == "s" {
      return interval.lowercased()
    }
    return interval.uppercased()
  }

  private static func timeSpan(for interval: String) -> Int {
    switch interval {
    case "1m":
      return 2 * 24 * 60 * 60
    case "15m":
      return 7 * 24 * 60 * 60
    case "1H":
      return 30 * 24 * 60 * 60
    case "4H":
      return 90 * 24 * 60 * 60
    default:
      return 7 * 24 * 60 * 60
    }
  }

  private static func normalizeCandles(
    _ points: [RuntimeCandle],
    timeFrom: Double,
    timeTo: Double,
    timestampDivisor: Double = 1,
    samplingStrategy: CandleSamplingStrategy = .latest(maximumPointCount: 80)
  ) -> AppClipKlineResult {
    struct NormalizedValue {
      let close: Double
      let high: Double?
      let low: Double?
      let open: Double?
      let timestamp: Double
      let volume: Double
      let isCloseOnly: Bool
    }

    var valuesByTimestamp = [Double: NormalizedValue]()
    for point in points {
      guard
        let close = point.c?.doubleValue,
        let rawTimestamp = point.t?.doubleValue
      else {
        continue
      }
      let timestamp = rawTimestamp / timestampDivisor
      guard
        timestamp >= timeFrom,
        timestamp <= timeTo
      else {
        continue
      }
      let open = point.o?.doubleValue
      let high = point.h?.doubleValue
      let low = point.l?.doubleValue
      let hasOHLC = point.o != nil || point.h != nil || point.l != nil
      if hasOHLC {
        guard open != nil, let high, let low, high >= low else {
          continue
        }
      }
      valuesByTimestamp[timestamp] = NormalizedValue(
        close: close,
        high: high,
        low: low,
        open: open,
        timestamp: timestamp,
        volume: point.v?.doubleValue ?? 0,
        isCloseOnly: !hasOHLC
      )
    }

    let sortedValues = valuesByTimestamp.values.sorted { $0.timestamp < $1.timestamp }
    let isCloseOnly = !sortedValues.isEmpty && sortedValues.allSatisfy(\.isCloseOnly)
    var previousClose: Double?
    let normalized = sortedValues.map { value -> AppClipCandle in
      let open = value.open ?? previousClose ?? value.close
      let candle = AppClipCandle(
        o: open,
        h: value.high ?? max(open, value.close),
        l: value.low ?? min(open, value.close),
        c: value.close,
        v: value.volume,
        t: value.timestamp
      )
      previousClose = value.close
      return candle
    }
    return AppClipKlineResult(
      candles: sampleCandles(normalized, strategy: samplingStrategy),
      isCloseOnly: isCloseOnly
    )
  }

  private static func sampleCandles(
    _ candles: [AppClipCandle],
    strategy: CandleSamplingStrategy
  ) -> [AppClipCandle] {
    switch strategy {
    case .latest(let maximumPointCount):
      return Array(candles.suffix(maximumPointCount))
    case .evenlySpaced(let maximumPointCount):
      guard candles.count > maximumPointCount, maximumPointCount >= 2 else {
        return candles
      }
      // Preserve the full selected range while bounding chart rendering cost.
      let lastIndex = candles.count - 1
      return (0..<maximumPointCount).map { offset in
        candles[offset * lastIndex / (maximumPointCount - 1)]
      }
    }
  }
}
