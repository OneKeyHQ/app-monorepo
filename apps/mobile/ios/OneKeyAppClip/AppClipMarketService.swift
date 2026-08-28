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

  var isPositive: Bool? {
    priceChangePercent.map { $0 >= 0 }
  }

  var detailSubtitle: String {
    networkName ?? networkId
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

private struct MarketTokenListEnvelope: Decodable {
  let data: MarketTokenListPayload
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
  let priceChange24hPercent: MarketScalar?
  let symbol: String
  let volume24h: MarketScalar?
}

private struct MarketChainsEnvelope: Decodable {
  let data: MarketChainsPayload
}

private struct MarketChainsPayload: Decodable {
  let list: [MarketChain]
}

private struct MarketChain: Decodable {
  let logoUrl: String
  let name: String
  let networkId: String
}

private struct KlineEnvelope: Decodable {
  let data: KlinePayload
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
  func fetchMarketAssets(baseURL: URL) async throws -> [AppClipMarketAsset] {
    async let chainsRequest = fetchMarketChains(baseURL: baseURL)
    let tokens = try await fetchMarketTokenList(baseURL: baseURL)
    let chains = (try? await chainsRequest) ?? []
    let chainByNetwork = Dictionary(
      chains.map { ($0.networkId, $0) },
      uniquingKeysWith: { first, _ in first }
    )

    return tokens.compactMap { token in
      guard let networkId = token.networkId, !networkId.isEmpty else {
        return nil
      }
      let chain = Self.presetChainFallback[networkId] ?? chainByNetwork[networkId]
      let logoURLs = ([token.logoUrl].compactMap { $0 } + (token.logoUrls ?? []))
        .reduce(into: [URL]()) { result, value in
          guard
            !value.lowercased().contains(".svg"),
            let url = URL(string: value),
            !result.contains(url)
          else {
            return
          }
          result.append(url)
        }
      let isNative = token.isNative ?? token.address.isEmpty
      let normalizedAddress = isNative ? "" : token.address
      return AppClipMarketAsset(
        id: "\(networkId):\(isNative ? "native" : normalizedAddress.lowercased())",
        symbol: token.symbol,
        name: token.name,
        address: normalizedAddress,
        networkId: networkId,
        networkName: chain?.name,
        isNative: isNative,
        logoURLs: logoURLs,
        networkLogoURL: chain.flatMap { URL(string: $0.logoUrl) },
        price: token.price?.doubleValue,
        priceChangePercent: token.priceChange24hPercent?.doubleValue,
        turnover: token.volume24h?.doubleValue
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
    let data = try await requestData(endpoint)
    let runtimePoints = try JSONDecoder().decode(KlineEnvelope.self, from: data).data.points
    return Self.normalizeCandles(
      runtimePoints,
      timeFrom: Double(timeFrom),
      timeTo: Double(timeTo)
    )
  }

  private func fetchMarketTokenList(baseURL: URL) async throws -> [MarketTokenListItem] {
    var components = URLComponents(
      url: baseURL.appendingPathComponent("utility/v2/market/token/list"),
      resolvingAgainstBaseURL: false
    )
    components?.queryItems = [
      URLQueryItem(name: "networkId", value: ""),
      URLQueryItem(name: "sortBy", value: "v24hUSD"),
      URLQueryItem(name: "sortType", value: "desc"),
      URLQueryItem(name: "page", value: "1"),
      URLQueryItem(name: "limit", value: "20"),
      URLQueryItem(name: "minLiquidity", value: "5000"),
      URLQueryItem(name: "type", value: "trending"),
      URLQueryItem(name: "timeFrame", value: "4"),
      URLQueryItem(name: "currency", value: "usd"),
    ]
    guard let endpoint = components?.url else {
      throw URLError(.badURL)
    }
    let data = try await requestData(endpoint)
    return try JSONDecoder().decode(MarketTokenListEnvelope.self, from: data).data.list
  }

  private func fetchMarketChains(baseURL: URL) async throws -> [MarketChain] {
    let endpoint = baseURL.appendingPathComponent("utility/v2/market/chains")
    let data = try await requestData(endpoint)
    return try JSONDecoder().decode(MarketChainsEnvelope.self, from: data).data.list
  }

  private func requestData(_ endpoint: URL) async throws -> Data {
    var request = URLRequest(url: endpoint)
    request.timeoutInterval = 10
    request.setValue(Self.userAgent, forHTTPHeaderField: "User-Agent")
    request.setValue("ios", forHTTPHeaderField: "x-onekey-request-platform")
    request.setValue("usd", forHTTPHeaderField: "x-onekey-request-currency")
    request.setValue(
      Locale.current.identifier.lowercased(),
      forHTTPHeaderField: "x-onekey-request-locale"
    )
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
    let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
    return "OneKeyWallet/\(version ?? "1")"
  }

  private static let presetChainFallback: [String: MarketChain] = [
    "btc--0": MarketChain(
      logoUrl: "https://uni.onekey-asset.com/static/chain/btc.png",
      name: "Bitcoin",
      networkId: "btc--0"
    ),
    "evm--1": MarketChain(
      logoUrl: "https://uni.onekey-asset.com/static/chain/eth.png",
      name: "Ethereum",
      networkId: "evm--1"
    ),
    "evm--56": MarketChain(
      logoUrl: "https://uni.onekey-asset.com/static/chain/bsc.png",
      name: "BNB Chain",
      networkId: "evm--56"
    ),
    "sol--101": MarketChain(
      logoUrl: "https://uni.onekey-asset.com/static/chain/sol.png",
      name: "Solana",
      networkId: "sol--101"
    ),
  ]

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
    timeTo: Double
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
        let timestamp = point.t?.doubleValue,
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
    return AppClipKlineResult(candles: Array(normalized.suffix(80)), isCloseOnly: isCloseOnly)
  }
}
