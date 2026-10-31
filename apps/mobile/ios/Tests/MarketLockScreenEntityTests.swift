import AppIntents
import Foundation

// Compile with the shared widget sources and both home-screen and lock-screen providers.
@main
struct MarketLockScreenEntityTests {
  private static var checks = 0

  private static func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
    checks += 1
    precondition(condition(), message)
  }

  static func main() async throws {
    let directory = FileManager.default.temporaryDirectory
      .appendingPathComponent("market-lockscreen-entities-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = MarketWidgetStore(directory: directory)
    try store.saveConfiguration(json: #"{"schemaVersion":1,"assets":[],"greenUp":true,"locale":"en-US"}"#)

    let bitcoin = MarketWidgetAsset.defaults[0]
    let stock = MarketWidgetAsset(kind: .stock, assetId: nil, chainId: nil, contractAddress: nil,
      isNative: nil, symbol: "NVDA", name: "NVIDIA", stockId: "NVDA")
    let stockEntity = MarketLockScreenAssetEntity(asset: stock)
    try store.rememberLockScreenAssets([stock])
    let restoredStock = MarketLockScreenAssetEntity(id: stockEntity.id, store: store)
    expect(restoredStock?.asset.stockId == "NVDA" && restoredStock?.asset.kind == .stock,
      "Native configuration restores a stock identity without converting it to a token")
    expect(restoredStock?.title == "NVDA/USD", "Stock entities keep readable quote labels")
    let stockSearch = try MarketWidgetService.decodeStockSearch(Data(#"{"code":0,"data":{"items":[{"stockId":"NVDA","currency":"USD","symbol":"NVDA","name":"NVIDIA"}]}}"#.utf8))
    expect(stockSearch.map(\.id) == [stock.id], "The lock-screen search offers actual stock listings")
    expect(MarketLockScreenPicker.entities([bitcoin, stock, bitcoin]).map(\.asset.id) == [bitcoin.id, stock.id],
      "Mixed suggestions preserve order and remove repeated identities")
    let bitcoinEntity = MarketLockScreenAssetEntity(asset: bitcoin)
    let renamedBitcoin = MarketWidgetAsset(kind: .asset, assetId: bitcoin.assetId, chainId: nil,
      contractAddress: nil, isNative: nil, symbol: "XBT", name: "Bitcoin updated",
      logoURL: "https://onekey.so/new-bitcoin.png")
    let renamedEntity = MarketLockScreenAssetEntity(asset: renamedBitcoin)
    expect(bitcoinEntity.id == renamedEntity.id,
           "Changing an asset's symbol, name, or logo must not change the saved entity identifier")
    expect(bitcoinEntity.id != MarketLockScreenAssetEntity(asset: MarketWidgetAsset.defaults[1]).id,
           "Distinct market assets retain distinct entity identifiers")
    let encodedBitcoin = try JSONDecoder().decode(MarketWidgetAsset.self,
      from: Data(base64Encoded: bitcoinEntity.id)!)
    expect(encodedBitcoin.id == bitcoin.id && encodedBitcoin.symbol.isEmpty && encodedBitcoin.name.isEmpty
      && encodedBitcoin.logoURL == nil, "Entity identifiers contain identity rather than display metadata")
    expect(MarketLockScreenAssetEntity(id: bitcoinEntity.id, store: store)?.asset.symbol == "BTC",
           "Built-in identity metadata is available before the App has populated a cache")

    let token = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "evm--1",
      contractAddress: "0x1234", isNative: false, requestTokenAddress: "0x1234",
      symbol: "TEST", name: "Test Token", logoURL: "https://onekey.so/token.png")
    let otherNetworkToken = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "evm--56",
      contractAddress: token.contractAddress, isNative: false, requestTokenAddress: token.requestTokenAddress,
      symbol: token.symbol, name: token.name)
    let tokenEntity = MarketLockScreenAssetEntity(asset: token)
    expect(tokenEntity.id != MarketLockScreenAssetEntity(asset: otherNetworkToken).id,
           "The same symbol and address on different networks must not share a selected entity")
    let otherAddressToken = MarketWidgetAsset(kind: .token, assetId: nil, chainId: token.chainId,
      contractAddress: "0x5678", isNative: false, symbol: token.symbol, name: token.name)
    expect(tokenEntity.id != MarketLockScreenAssetEntity(asset: otherAddressToken).id,
           "The same symbol on one network must still retain its contract identity")
    let renamedToken = MarketWidgetAsset(kind: token.kind, assetId: nil, chainId: token.chainId,
      contractAddress: token.contractAddress, isNative: token.isNative,
      requestTokenAddress: token.requestTokenAddress, symbol: "NEW", name: "Renamed Token")
    expect(tokenEntity.id == MarketLockScreenAssetEntity(asset: renamedToken).id,
           "A token metadata update must preserve its entity identifier")

    try store.rememberLockScreenAssets([token])
    let cachedToken = MarketWidgetAsset(kind: token.kind, assetId: nil, chainId: token.chainId,
      contractAddress: token.contractAddress, isNative: token.isNative,
      requestTokenAddress: token.requestTokenAddress, symbol: "CACHED", name: "Cached Token Name",
      logoURL: "https://onekey.so/cached-token.png")
    try store.saveMetadata(cachedToken)
    let restoredToken = MarketLockScreenAssetEntity(id: tokenEntity.id, store: store)
    expect(restoredToken?.id == tokenEntity.id && restoredToken?.asset.id == token.id,
           "Restoration preserves both system and market identity")
    expect(restoredToken?.asset.symbol == "CACHED" && restoredToken?.asset.name == "Cached Token Name",
           "Restoration uses current metadata from the supplied store")
    expect(restoredToken?.asset.logoURL == cachedToken.logoURL,
           "A refreshed logo is metadata, not a new selection")
    expect(restoredToken?.asset.requestTokenAddress == token.requestTokenAddress,
           "Restoration retains the selected request address")

    let native = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "sol--101",
      contractAddress: "", isNative: true, requestTokenAddress: "11111111111111111111111111111111",
      symbol: "SOL", name: "Solana")
    let nativeEntity = MarketLockScreenAssetEntity(asset: native)
    let restoredNative = MarketLockScreenAssetEntity(id: nativeEntity.id, store: store)
    expect(restoredNative?.asset.contractAddress == "" && restoredNative?.asset.isNative == true,
           "Native assets keep their canonical empty-address identity")
    expect(restoredNative?.asset.requestTokenAddress == native.requestTokenAddress,
           "Native assets retain the request address independently from their canonical address")

    expect(bitcoinEntity.title == "BTC/USD", "Picker labels use the real USD quote currency")
    let nativeBitcoin = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "btc--0",
      contractAddress: "", isNative: true, symbol: "BTC", name: "Bitcoin")
    let nativeEthereum = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "evm--1",
      contractAddress: "", isNative: true, symbol: "ETH", name: "Ethereum")
    let bnb = MarketWidgetAsset(kind: .asset, assetId: "bnb", chainId: nil,
      contractAddress: nil, isNative: nil, symbol: "BNB", name: "BNB")
    let nativeBNB = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "evm--56",
      contractAddress: "", isNative: true, symbol: "BNB", name: "BNB")
    let nativeAliases = [nativeBitcoin, nativeEthereum, native, nativeBNB]
    let aggregate = MarketWidgetAsset.defaults + [bnb]
    let deduplicated = MarketLockScreenPicker.entities(aggregate + nativeAliases + aggregate)
    expect(deduplicated.map(\.asset.id) == aggregate.map(\.id),
           "Suggestions collapse only known native/aggregate equivalents and repeated identities")
    expect(MarketLockScreenPicker.entities(nativeAliases + aggregate).map(\.asset.id) == nativeAliases.map(\.id),
           "Deduplication keeps source ordering and does not rewrite the first candidate's request identity")
    for legacy in nativeAliases {
      let entity = MarketLockScreenAssetEntity(asset: legacy)
      expect(MarketLockScreenAssetEntity(id: entity.id, store: store)?.asset.id == legacy.id,
             "Previously selected native entity IDs still resolve after suggestion deduplication")
    }
    let wrappedBitcoin = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "evm--1",
      contractAddress: "0x9999", isNative: false, symbol: "BTC", name: "Wrapped Bitcoin")
    let differentBitcoin = MarketWidgetAsset(kind: .asset, assetId: "another-bitcoin", chainId: nil,
      contractAddress: nil, isNative: nil, symbol: "BTC", name: "Another Bitcoin")
    let sameSymbol = MarketLockScreenPicker.entities([bitcoin, wrappedBitcoin, differentBitcoin])
    expect(sameSymbol.count == 3 && Set(sameSymbol.map(\.title)).count == 3,
           "Distinct same-symbol assets remain separately selectable and have distinct labels")
    expect(sameSymbol.map(\.title) == ["BTC/USD · Bitcoin", "BTC/USD · Wrapped Bitcoin", "BTC/USD · Another Bitcoin"],
           "Colliding symbols use public asset names rather than inventing a trading pair")
    let sameNameTokens = MarketLockScreenPicker.entities([token, otherNetworkToken, otherAddressToken])
    expect(sameNameTokens.map(\.title) == ["TEST/USD · Test Token · Ethereum · 0x1234",
      "TEST/USD · Test Token · BNB Chain", "TEST/USD · Test Token · Ethereum · 0x5678"],
           "Same-name tokens are distinguished by friendly network and contract when necessary")
    expect(sameNameTokens.allSatisfy { !$0.title.contains("--") },
           "Picker labels never expose OneKey internal network IDs")
    let whitespaceName = MarketWidgetAsset(kind: .token, assetId: nil, chainId: token.chainId,
      contractAddress: "0x9876", isNative: false, symbol: token.symbol, name: " Test Token ")
    let normalizedNames = MarketLockScreenPicker.entities([token, whitespaceName])
    expect(normalizedNames.map(\.title) == ["TEST/USD · Test Token · Ethereum · 0x1234",
      "TEST/USD · Test Token · Ethereum · 0x9876"],
           "Display-equivalent names with whitespace still require identity disambiguation")
    let upperAddress = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "evm--1",
      contractAddress: "0xABCD", isNative: false, symbol: "TEST", name: "Test Token")
    let lowerAddress = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "evm--1",
      contractAddress: "0xabcd", isNative: false, symbol: "TEST", name: "Test Token")
    expect(MarketLockScreenPicker.entities([upperAddress, lowerAddress]).count == 1,
           "Equivalent EVM address casing does not create duplicate candidates")
    let sameSolanaAddressCase = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "sol--101",
      contractAddress: "AbCd", isNative: false, symbol: "TEST", name: "Test Token")
    let differentSolanaAddressCase = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "sol--101",
      contractAddress: "abcd", isNative: false, symbol: "TEST", name: "Test Token")
    expect(MarketLockScreenPicker.entities([sameSolanaAddressCase, differentSolanaAddressCase]).count == 2,
           "Case-sensitive non-EVM addresses retain distinct identities")
    let similarAddresses = ["0x123456000000000000000000000000000000abcd",
      "0x123456111111111111111111111111111111abcd"].map { address in
      MarketWidgetAsset(kind: .token, assetId: nil, chainId: "evm--1", contractAddress: address,
        isNative: false, symbol: "TEST", name: "Test Token")
    }
    let similarCandidates = MarketLockScreenPicker.entities(similarAddresses)
    expect(Set(similarCandidates.map(\.title)).count == 2
      && similarCandidates[0].title.contains(similarAddresses[0].contractAddress!),
           "Colliding shortened addresses fall back to their full public address")
    let titleChangedEntity = MarketLockScreenAssetEntity(asset: bitcoin, title: "BTC/USD · Bitcoin")
    expect(titleChangedEntity.id == bitcoinEntity.id,
           "Adding disambiguation text never changes a selected entity identifier")

    let custom = MarketWidgetAsset(kind: .asset, assetId: "custom-selected-asset", chainId: nil,
      contractAddress: nil, isNative: nil, symbol: "CUSTOM", name: "Custom Selected Asset")
    let customEntity = MarketLockScreenAssetEntity(asset: custom)
    try store.rememberLockScreenAssets([custom])
    expect(store.lockScreenAsset(id: custom.id) != nil, "The selected asset starts in the metadata cache")
    for batch in 0..<3 {
      let replacements = (0..<100).map { offset in
        MarketWidgetAsset(kind: .asset, assetId: "replacement-\(batch)-\(offset)", chainId: nil,
          contractAddress: nil, isNative: nil, symbol: "R\(offset)", name: "Replacement \(offset)")
      }
      try store.rememberLockScreenAssets(replacements)
    }
    expect(store.lockScreenAsset(id: custom.id) == nil, "The bounded cache evicts an older selected asset")
    let restoredAfterEviction = MarketLockScreenAssetEntity(id: customEntity.id, store: store)
    expect(restoredAfterEviction?.asset.id == custom.id && restoredAfterEviction?.asset.isValid == true,
           "A saved entity restores its public identity after metadata cache eviction")
    expect(restoredAfterEviction?.id == customEntity.id, "Cache eviction must not change the saved identifier")
    try store.rememberLockScreenAssets([restoredAfterEviction!.asset])
    expect(store.permitsRequests(for: custom), "A restored selection can be registered for its next quote request")

    for invalid in ["", "not base64!", String(repeating: "A", count: 4097),
                    Data("not json".utf8).base64EncodedString(),
                    Data(#"{"kind":"asset","assetId":"","symbol":"BTC","name":"Bitcoin"}"#.utf8).base64EncodedString(),
                    Data(#"{"kind":"token","chainId":"evm--1","contractAddress":"bad address","isNative":false,"symbol":"BTC","name":"Bitcoin"}"#.utf8).base64EncodedString()] {
      expect(MarketLockScreenAssetEntity(id: invalid, store: store) == nil,
             "Malformed, oversized, or invalid identity input must fail closed")
    }

    let defaultBitcoin = await MarketLockScreenAssetQuery().defaultResult()
    let defaultEthereum = await MarketLockScreenEthereumQuery().defaultResult()
    let defaultSolana = await MarketLockScreenSolanaQuery().defaultResult()
    expect(defaultBitcoin?.asset.assetId == "btc" && defaultBitcoin?.asset.symbol == "BTC",
           "The system query supplies an explicit BTC default for the first and spot parameters")
    expect(defaultEthereum?.asset.assetId == "eth" && defaultEthereum?.asset.symbol == "ETH",
           "The second parameter's system query supplies ETH independently of intent initialization")
    expect(defaultSolana?.asset.assetId == "sol" && defaultSolana?.asset.symbol == "SOL",
           "The third parameter's system query supplies SOL independently of intent initialization")
    expect(Set([defaultBitcoin?.id, defaultEthereum?.id, defaultSolana?.id].compactMap { $0 }).count == 3,
           "The system receives three distinct default selections rather than one shared default")

    let spot = MarketLockScreenSpotIntent()
    expect(spot.coin?.asset.assetId == "btc" && spot.coin?.asset.symbol == "BTC",
           "A new spot intent explicitly selects and labels BTC")
    let list = MarketLockScreenListIntent()
    expect(list.first?.asset.assetId == "btc" && list.first?.asset.symbol == "BTC",
           "The first list field explicitly selects BTC")
    expect(list.second?.asset.assetId == "eth" && list.second?.asset.symbol == "ETH",
           "The second list field explicitly selects ETH")
    expect(list.third?.asset.assetId == "sol" && list.third?.asset.symbol == "SOL",
           "The third list field explicitly selects SOL")
    let changedSpot = MarketLockScreenSpotIntent()
    changedSpot.coin = MarketLockScreenAssetEntity(asset: MarketWidgetAsset.defaults[1])
    expect(changedSpot.coin?.asset.assetId == "eth" && spot.coin?.asset.assetId == "btc",
           "Separate spot configurations retain their own selected coin")
    let changedList = MarketLockScreenListIntent()
    changedList.first = MarketLockScreenAssetEntity(asset: MarketWidgetAsset.defaults[1])
    expect(changedList.first?.id == changedList.second?.id,
           "The native configuration can retain the same asset in two list positions")
    expect(list.first?.asset.assetId == "btc", "Changing another list configuration does not mutate this one")

    print("MarketLockScreenEntityTests: \(checks) checks passed")
  }
}
