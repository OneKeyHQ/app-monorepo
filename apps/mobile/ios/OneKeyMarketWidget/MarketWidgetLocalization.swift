import Foundation

enum MarketWidgetLocalization {
  static func profileName(_ profile: MarketWidgetProfile, locale: Locale = .current, bundle: Bundle = .main) -> String {
    let source = text(profile.source == .hot ? "market_widget_hot_coins__title" : "market_widget_watchlist__title",
      locale: locale, bundle: bundle)
    let content = profile.kind == .list
      ? text("market_widget_list__title", locale: locale, bundle: bundle)
      : profile.asset?.displaySymbol ?? text("market_widget_single__title", locale: locale, bundle: bundle)
    // Profile names are generated labels; keep the persisted identity when the display language changes.
    return "\(source) · \(content)"
  }

  static func text(_ key: String, locale: Locale, arguments: [CVarArg] = [], bundle: Bundle = .main) -> String {
    // Widget views follow the App's language, which can differ from the extension process language.
    let languages = bundle.localizations.filter { $0 != "Base" }
    let language = Bundle.preferredLocalizations(from: languages, forPreferences: [locale.identifier]).first ?? "en"
    let path = bundle.path(forResource: language, ofType: "lproj")
      ?? bundle.path(forResource: "en", ofType: "lproj")
    let localizedBundle = path.flatMap(Bundle.init(path:)) ?? bundle
    let format = localizedBundle.localizedString(forKey: key, value: nil, table: nil)
    return arguments.isEmpty ? format : String(format: format, locale: locale, arguments: arguments)
  }
}
