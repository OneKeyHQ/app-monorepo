import Foundation

// Compile with MarketWidgetData.swift and MarketWidgetLocalization.swift; pass the repository root and an optional built extension path.
@main
struct MarketWidgetLocalizationTests {
  static var checks = 0

  static func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
    checks += 1
    precondition(condition(), message)
  }

  static func strings(_ file: URL) throws -> [String: String] {
    let data = try Data(contentsOf: file)
    return try PropertyListSerialization.propertyList(from: data, format: nil) as! [String: String]
  }

  static func main() throws {
    let root = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? FileManager.default.currentDirectoryPath)
    let resources = CommandLine.arguments.dropFirst(2).first.map { URL(fileURLWithPath: $0) }
      ?? root.appendingPathComponent("apps/mobile/ios/OneKeyMarketWidget")
    let bundle = Bundle(path: resources.path)!
    let registry = try String(contentsOf: root.appendingPathComponent("packages/shared/src/locale/localeJsonMap.ts"), encoding: .utf8)
    let pattern = try NSRegularExpression(pattern: "(?m)^  '([^']+)':")
    let locales = pattern.matches(in: registry, range: NSRange(registry.startIndex..., in: registry)).compactMap {
      Range($0.range(at: 1), in: registry).map { String(registry[$0]) }
    }.filter { $0 != "en" }
    let english = try strings(resources.appendingPathComponent("en.lproj/Localizable.strings"))
    expect(locales.count == 19, "Cover every supported App locale, excluding the English alias")
    expect(bundle.localizations.count == locales.count, "Bundle all App languages in the Widget extension")

    for identifier in locales {
      let locale = Locale(identifier: identifier)
      let selected = Bundle.preferredLocalizations(from: bundle.localizations, forPreferences: [identifier]).first!
      let values = try strings(resources.appendingPathComponent("\(selected).lproj/Localizable.strings"))
      expect(Set(values.keys) == Set(english.keys), "\(identifier): native keys match the English catalog")
      if identifier != "en-US" { expect(selected != "en", "\(identifier): do not silently fall back to English") }
      for (key, value) in values {
        expect(!value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, "\(identifier): \(key) is translated")
        expect(!value.contains("{") && !value.contains("}"), "\(identifier): \(key) has no unresolved named placeholders")
        expect(MarketWidgetLocalization.text(key, locale: locale, bundle: bundle) == value,
          "\(identifier): text uses the App language instead of the process language")
      }
      for key in ["market_widget_quote__desc", "market_widget_quote_cached__desc"] {
        let rendered = MarketWidgetLocalization.text(key, locale: locale,
          arguments: ["BTC", "12,345.67", "+2.50%"], bundle: bundle)
        expect(rendered.contains("BTC") && rendered.contains("12,345.67") && rendered.contains("+2.50%"),
          "\(identifier): full VoiceOver templates preserve all formatted quote arguments")
        expect(!rendered.contains("$@"), "\(identifier): positional placeholders are consumed")
      }
      let normal = MarketWidgetLocalization.text("market_widget_quote__desc", locale: locale,
        arguments: ["BTC", "100", "+1%"], bundle: bundle)
      let cached = MarketWidgetLocalization.text("market_widget_quote_cached__desc", locale: locale,
        arguments: ["BTC", "100", "+1%"], bundle: bundle)
      expect(normal != cached, "\(identifier): cached quote state remains audible")
    }

    for identifier in ["zh-CN", "zh_CN"] {
      let locale = Locale(identifier: identifier)
      expect(MarketWidgetLocalization.text("market_widget_watchlist__title", locale: locale, bundle: bundle) == "自选",
        "Desktop source uses 自选")
      expect(MarketWidgetLocalization.text("market_widget_lock_watchlist__title", locale: locale, bundle: bundle) == "关注列表",
        "Lock Screen scene has its own 关注列表 translation")
    }
    for (identifier, expected) in [("zh-TW", "關注清單"), ("zh-HK", "關注列表"),
                                   ("zh_Hant_TW", "關注清單"), ("zh_Hant_HK", "關注列表")] {
      expect(MarketWidgetLocalization.text("market_widget_lock_watchlist__title", locale: Locale(identifier: identifier), bundle: bundle) == expected,
        "\(identifier): Traditional Chinese never resolves to Simplified Chinese")
    }
    expect(MarketWidgetLocalization.text("market_widget_coin__title", locale: Locale(identifier: "xx-XX"), bundle: bundle) == "Coin",
      "Unsupported locales use the English fallback")

    let identifier = UUID().uuidString.lowercased()
    let profile = MarketWidgetProfile(id: identifier, kind: .single, name: "Hot Coins · BTC", source: .hot,
      asset: MarketWidgetAsset.defaults[0])
    let persistedProfile = profile
    expect(MarketWidgetLocalization.profileName(profile, locale: Locale(identifier: "en-US"), bundle: bundle) == "Hot Coins · BTC",
      "English profile display derives from source and the actual coin identity")
    expect(MarketWidgetLocalization.profileName(profile, locale: Locale(identifier: "zh-CN"), bundle: bundle) == "热门币种 · BTC",
      "Changing language does not display an old persisted English name")
    expect(MarketWidgetLocalization.profileName(profile, locale: Locale(identifier: "zh-TW"), bundle: bundle) == "熱門幣種 · BTC",
      "Profile display follows Traditional Chinese independently")
    expect(profile.id == identifier && profile == persistedProfile,
      "Translating a profile display name does not mutate its ID, configuration, or stored name")
    let list = MarketWidgetProfile(id: identifier, kind: .list, name: "Watchlist · Market list", source: .watchlist)
    expect(MarketWidgetLocalization.profileName(list, locale: Locale(identifier: "zh-CN"), bundle: bundle) == "自选 · 行情列表",
      "List profile display localizes both source and kind")
    let fallback = MarketWidgetProfile(id: identifier, kind: .single, name: "Saved name", source: .watchlist)
    expect(MarketWidgetLocalization.profileName(fallback, locale: Locale(identifier: "zh-CN"), bundle: bundle) == "自选 · 单币行情",
      "A missing coin keeps the localized single-coin label")
    let token = MarketWidgetAsset(kind: .token, assetId: nil, chainId: "evm--1", contractAddress: "0x1234567890abcdef",
      isNative: false, symbol: "", name: "")
    let unnamed = MarketWidgetProfile(id: identifier, kind: .single, name: "Saved name", source: .hot, asset: token)
    expect(MarketWidgetLocalization.profileName(unnamed, locale: Locale(identifier: "en-US"), bundle: bundle) == "Hot Coins · \(token.displaySymbol)",
      "Tokens without metadata preserve the existing address identity fallback")
    print("Market Widget localization: \(checks) checks passed across \(locales.count) locales")
  }
}
