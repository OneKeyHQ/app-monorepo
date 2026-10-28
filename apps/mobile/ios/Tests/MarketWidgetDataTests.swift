import Foundation

// Run with swiftc alongside SharedMarketWidget/MarketWidgetData.swift and MarketWidgetService.swift.
@main
struct MarketWidgetDataTests {
  static var checks = 0
  static func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
    checks += 1
    precondition(condition(), message)
  }

  static func rejects(_ message: String, _ action: () throws -> Void) {
    do { try action(); preconditionFailure(message) } catch { checks += 1 }
  }

  static func json(_ value: String) -> Data { Data(value.utf8) }

  static func main() throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = MarketWidgetStore(directory: directory)
    let bitcoin = MarketWidgetAsset.defaults[0]
    let ethereum = MarketWidgetAsset.defaults[1]
    expect(store.configuration().configuration?.displayAssets.count == 3, "First run has public defaults")
    let empty = #"{"schemaVersion":1,"assets":[],"greenUp":true,"locale":"en-US"}"#
    try store.saveConfiguration(json: empty)
    expect(store.configuration().configuration?.assets.isEmpty == true, "Empty watchlist is a valid configuration")
    expect(tryValue { try store.saveConfiguration(json: empty) } == false, "Unchanged configuration does not request reload")
    rejects("Malformed configuration must fail") { try store.saveConfiguration(json: "{") }
    expect(store.configuration().configuration?.assets.isEmpty == true, "Malformed bridge input preserves previous configuration")
    rejects("Future schema must fail") {
      try store.saveConfiguration(json: empty.replacingOccurrences(of: "schemaVersion\":1", with: "schemaVersion\":2"))
    }
    for malformed in ["1garbage", "NaN", "Infinity", "", "1\n", "1,234", " 1", "1 ", "1e999"] {
      expect(MarketWidgetQuote.decimal(malformed) == nil, "Reject non-finite or partial numeric value: \(malformed)")
    }
    expect(MarketWidgetQuote.decimal("0.000000000000000001") != nil, "Preserve small prices")
    expect(MarketWidgetQuote.decimal("-1.25e-4") != nil, "Accept complete signed scientific notation")
    let response = json(#"{"code":0,"data":{"asset":{"assetId":"btc","symbol":"BTC","name":"Bitcoin"},"market":{"price":"67000.12","priceChange24hPercent":"-2.5"}}}"#)
    let date = Date().addingTimeInterval(-30)
    let quote = try MarketWidgetService.decode(response, asset: bitcoin, fetchedAt: date)
    expect(quote.price == "67000.12" && quote.change24h == "-2.5", "Decode price and percent without ratio conversion")
    expect(quote.fetchedAt == date, "Use supplied fetch timestamp without inventing source time")
    rejects("Wrong asset identity must fail") { _ = try MarketWidgetService.decode(response, asset: ethereum, fetchedAt: date) }
    rejects("Business error must fail") {
      _ = try MarketWidgetService.decode(json(#"{"code":1,"data":null}"#), asset: bitcoin, fetchedAt: date)
    }
    rejects("Missing price must never become zero") {
      _ = try MarketWidgetService.decode(json(#"{"code":0,"data":{"asset":{"assetId":"btc","symbol":"BTC","name":"Bitcoin"},"market":{}}}"#), asset: bitcoin, fetchedAt: date)
    }
    let native = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "sol--101",
      contractAddress: "", isNative: true, requestTokenAddress: "11111111111111111111111111111111",
      symbol: "", name: "")
    expect(native.isValid, "Identity remains valid without display metadata")
    let oldNative = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "sol--101",
      contractAddress: "", isNative: true, requestTokenAddress: "old", symbol: "", name: "")
    let nativeConfiguration = MarketWidgetConfiguration(schemaVersion: 1, assets: [native], greenUp: true, locale: "en-US")
    expect(nativeConfiguration.asset(withID: oldNative.id)?.requestTokenAddress == native.requestTokenAddress,
           "Saved instance identities resolve the current request address")
    expect(MarketWidgetConfiguration.initial.asset(withID: native.id) == nil,
           "A cleared export cannot resolve an old private watchlist selection")
    let request = try MarketWidgetService.request(for: native, locale: "en-US")
    let query = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!.queryItems!
    expect(query.first { $0.name == "tokenAddress" }?.value == native.requestTokenAddress,
           "Use resolved native address in API request")
    expect(query.first { $0.name == "currency" }?.value == "usd", "Quote currency is USD")
    let linkQuery = URLComponents(url: native.detailURL!, resolvingAgainstBaseURL: false)!.queryItems!
    expect(linkQuery.first { $0.name == "contractAddress" }?.value == "", "Deep link retains canonical native identity")
    expect(linkQuery.first { $0.name == "isNative" }?.value == "true", "Deep link preserves native flag")
    rejects("Native fallback requires a returned network identity") {
      _ = try MarketWidgetService.decode(json(#"{"code":0,"data":{"token":{"address":"wrong","isNative":true,"price":"1"}}}"#), asset: native, fetchedAt: date)
    }
    rejects("Explicit non-native response cannot satisfy a native selection") {
      _ = try MarketWidgetService.decode(json(#"{"code":0,"data":{"token":{"networkId":"sol--101","address":"11111111111111111111111111111111","isNative":false,"price":"1"}}}"#), asset: native, fetchedAt: date)
    }
    let verifiedNative = try MarketWidgetService.decode(json(#"{"code":0,"data":{"token":{"networkId":"sol--101","address":"","isNative":true,"price":"1"}}}"#), asset: native, fetchedAt: date)
    expect(verifiedNative.price == "1", "Allow normalized native address with verified chain and native marker")
    for network in ["btc--0", "evm--1", "sol--101"] {
      let emptyNative = MarketWidgetAsset(kind: .token, assetId: nil, chainId: network,
        contractAddress: "", isNative: true, requestTokenAddress: "", symbol: "", name: "")
      let nativeRequest = try MarketWidgetService.request(for: emptyNative, locale: "en-US")
      let nativeQuery = URLComponents(url: nativeRequest.url!, resolvingAgainstBaseURL: false)!.queryItems!
      expect(nativeQuery.first { $0.name == "tokenAddress" }?.value == "",
             "Preserve the API's empty native address for \(network)")
      let nativeResponse = json("""
        {"code":0,"data":{"token":{"networkId":"\(network)","address":"","isNative":true,"price":"1"}}}
        """)
      let nativeQuote = try MarketWidgetService.decode(nativeResponse, asset: emptyNative, fetchedAt: date)
      expect(nativeQuote.price == "1", "Accept a verified empty native address for \(network)")
    }
    let emptyEthereum = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "evm--1",
      contractAddress: "", isNative: true, requestTokenAddress: "", symbol: "", name: "")
    for invalidToken in [
      #"{"address":"","price":"123"}"#,
      #"{"address":"","isNative":true,"price":"123"}"#,
      #"{"networkId":"evm--1","address":"","price":"123"}"#,
      #"{"networkId":"evm--1","address":"","isNative":null,"price":"123"}"#,
      #"{"networkId":"evm--10","address":"","isNative":true,"price":"123"}"#,
      #"{"networkId":"evm--1","address":"","isNative":false,"price":"123"}"#,
    ] {
      rejects("Empty native addresses require both the requested network and a true native marker") {
        let invalidResponse = json("{\"code\":0,\"data\":{\"token\":\(invalidToken)}}")
        _ = try MarketWidgetService.decode(invalidResponse, asset: emptyEthereum, fetchedAt: date)
      }
    }
    let sui = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "sui--mainnet",
      contractAddress: "0x2::sui::SUI", isNative: true,
      requestTokenAddress: "0x2::sui::SUI", symbol: "", name: "")
    let suiResponse = json(#"{"code":0,"data":{"token":{"networkId":"sui--mainnet","address":"0x2::sui::SUI","isNative":true,"price":"0.9382729644825767"}}}"#)
    let suiQuote = try MarketWidgetService.decode(suiResponse, asset: sui, fetchedAt: date)
    expect(suiQuote.price == "0.9382729644825767", "Preserve the native SUI type-tag response")
    let addressOnlySui = try MarketWidgetService.decode(json(#"{"code":0,"data":{"token":{"address":"0x2::sui::SUI","price":"1"}}}"#), asset: sui, fetchedAt: date)
    expect(addressOnlySui.price == "1", "Preserve nonempty exact-address matching")
    let token = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "evm--1",
      contractAddress: "0xAbC", isNative: false, symbol: "", name: "")
    let tokenResponse = json(#"{"code":0,"data":{"token":{"networkId":"evm--1","address":"0xabc","symbol":"TEST","name":"Test","price":"0.0001"}}}"#)
    let tokenQuote = try MarketWidgetService.decode(tokenResponse, asset: token, fetchedAt: date)
    expect(tokenQuote.asset.symbol == "TEST" && tokenQuote.change24h == nil, "Populate metadata and keep missing percent unavailable")
    let otherNetwork = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "evm--10",
      contractAddress: "0xAbC", isNative: false, symbol: "", name: "")
    rejects("Cross-network quote must fail") { _ = try MarketWidgetService.decode(tokenResponse, asset: otherNetwork, fetchedAt: date) }
    try store.saveQuote(quote)
    expect(store.quote(for: bitcoin)?.fetchedAt == date, "Cache preserves last successful fetch time")
    try store.saveQuote(MarketWidgetQuote(asset: bitcoin, price: "1", change24h: nil, fetchedAt: date.addingTimeInterval(-60)))
    expect(store.quote(for: bitcoin)?.price == quote.price, "Older parallel request cannot overwrite newer cache")
    let config = MarketWidgetConfiguration(schemaVersion: 1, assets: [ethereum], greenUp: false, locale: "zh-CN")
    try store.saveConfiguration(json: String(decoding: JSONEncoder().encode(config), as: UTF8.self))
    expect(store.quote(for: bitcoin) == nil, "Changing watchlist prunes removed public identities")
    rejects("Late request for removed identity cannot repopulate cache") { try store.saveQuote(quote) }
    try json("broken").write(to: directory.appendingPathComponent("configuration-v1.json"))
    expect(store.configuration().configuration == nil, "Corrupt on-disk configuration is not treated as an empty watchlist")
    print("PASS: \(checks) market widget data checks")
  }

  private static func tryValue<T>(_ action: () throws -> T) -> T? { try? action() }
}
