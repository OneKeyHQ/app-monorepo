import SwiftUI
import WidgetKit

@main
struct OneKeyMarketWidgets: WidgetBundle {
  var body: some Widget {
    singleWidget()
    listWidget()
    if #available(iOS 17.0, *) {
      MarketLockScreenWatchlistWidget()
      MarketLockScreenCompactWidget()
      MarketLockScreenPriceWidget()
      MarketLockScreenChartWidget()
    }
  }

  private func singleWidget() -> some Widget {
    if #available(iOS 17.0, *) {
      return WidgetBundleBuilder.buildOptional(WidgetBundleBuilder.buildLimitedAvailability(MarketSingleWidget()))
    } else {
      return WidgetBundleBuilder.buildOptional(WidgetBundleBuilder.buildLimitedAvailability(LegacyMarketSingleWidget()))
    }
  }
  private func listWidget() -> some Widget {
    if #available(iOS 17.0, *) {
      return WidgetBundleBuilder.buildOptional(WidgetBundleBuilder.buildLimitedAvailability(MarketWatchlistWidget()))
    } else {
      return WidgetBundleBuilder.buildOptional(WidgetBundleBuilder.buildLimitedAvailability(LegacyMarketWatchlistWidget()))
    }
  }
}

@available(iOS 17.0, *)
struct MarketLockScreenWatchlistWidget: Widget {
  let kind = "OneKeyMarketLockScreenWatchlist"
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: MarketLockScreenListIntent.self, provider: MarketLockScreenListProvider()) {
      MarketLockScreenView(entry: $0, style: .watchlist)
    }
    .configurationDisplayName("Watchlist")
    .description("Three coins and their USD prices. Tap after adding to choose each coin.")
    .supportedFamilies([.accessoryRectangular])
    .contentMarginsDisabled()
  }
}

@available(iOS 17.0, *)
struct MarketLockScreenCompactWidget: Widget {
  let kind = "OneKeyMarketLockScreenCompact"
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: MarketLockScreenSpotIntent.self,
                           provider: MarketLockScreenSpotProvider(includingChart: false)) {
      MarketLockScreenView(entry: $0, style: .compact)
    }
    .configurationDisplayName("Follow spot")
    .description("A compact USD price. Tap after adding to choose a coin.")
    .supportedFamilies([.accessoryCircular])
    .contentMarginsDisabled()
  }
}

@available(iOS 17.0, *)
struct MarketLockScreenPriceWidget: Widget {
  let kind = "OneKeyMarketLockScreenPrice"
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: MarketLockScreenSpotIntent.self,
                           provider: MarketLockScreenSpotProvider(includingChart: false)) {
      MarketLockScreenView(entry: $0, style: .price)
    }
    .configurationDisplayName("Follow spot")
    .description("A large USD price and 24-hour change. Tap after adding to choose a coin.")
    .supportedFamilies([.accessoryRectangular])
    .contentMarginsDisabled()
  }
}

@available(iOS 17.0, *)
struct MarketLockScreenChartWidget: Widget {
  let kind = "OneKeyMarketLockScreenChart"
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: MarketLockScreenSpotIntent.self,
                           provider: MarketLockScreenSpotProvider(includingChart: true)) {
      MarketLockScreenView(entry: $0, style: .chart)
    }
    .configurationDisplayName("Follow spot")
    .description("A USD price and 24-hour trend. Tap after adding to choose a coin.")
    .supportedFamilies([.accessoryRectangular])
    .contentMarginsDisabled()
  }
}

@available(iOS 17.0, *)
struct MarketSingleWidget: Widget {
  let kind = "OneKeyMarketSingle"
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: MarketSingleIntent.self, provider: MarketSingleProvider()) {
      MarketWidgetView(entry: $0)
    }
    .configurationDisplayName("Market price")
    .description("A coin's USD price and 24-hour change.")
    .supportedFamilies([.systemSmall])
    .contentMarginsDisabled()
  }
}

struct LegacyMarketSingleWidget: Widget {
  let kind = "OneKeyMarketSingle"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: MarketWidgetProvider(isWatchlist: false)) {
      MarketWidgetView(entry: $0)
    }
    .configurationDisplayName("Market price")
    .description("The first coin in your watchlist. Open OneKey to change it.")
    .supportedFamilies([.systemSmall])
  }
}

@available(iOS 17.0, *)
struct MarketWatchlistWidget: Widget {
  let kind = "OneKeyMarketWatchlist"
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: MarketListIntent.self, provider: MarketListProvider()) {
      MarketWidgetView(entry: $0)
    }
    .configurationDisplayName("Market watchlist")
    .description("Three coins with USD prices and 24-hour charts.")
    .supportedFamilies([.systemMedium])
    .contentMarginsDisabled()
  }
}

struct LegacyMarketWatchlistWidget: Widget {
  let kind = "OneKeyMarketWatchlist"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: MarketWidgetProvider(isWatchlist: true)) {
      MarketWidgetView(entry: $0)
    }
    .configurationDisplayName("Market watchlist")
    .description("The first three coins in your watchlist. Open OneKey to change them.")
    .supportedFamilies([.systemMedium])
  }
}

struct MarketWidgetView: View {
  let entry: MarketWidgetEntry
  @Environment(\.colorScheme) private var colorScheme

  private var foreground: Color { colorScheme == .dark ? Color(red: 0.90, green: 0.91, blue: 0.93) : Color(red: 0.12, green: 0.14, blue: 0.16) }
  private var secondary: Color { colorScheme == .dark ? Color(red: 0.48, green: 0.50, blue: 0.54) : Color(red: 0.48, green: 0.51, blue: 0.55) }
  private var background: LinearGradient {
    LinearGradient(colors: colorScheme == .dark
      ? [Color(red: 0.09, green: 0.105, blue: 0.14), Color(red: 0.135, green: 0.145, blue: 0.175), Color(red: 0.12, green: 0.14, blue: 0.16)]
      : [Color.white, Color(red: 0.97, green: 0.98, blue: 0.98)], startPoint: .top, endPoint: .bottom)
  }

  var body: some View {
    content
      .foregroundStyle(foreground)
      .widgetURL(widgetURL)
      .environment(\.locale, Locale(identifier: entry.configuration?.locale ?? "en-US"))
      .modifier(MarketWidgetBackground(background: background))
  }

  @ViewBuilder private var content: some View {
    if entry.isWatchlist {
      VStack(spacing: 0) {
        if entry.rows.isEmpty { emptyState }
        else {
          ForEach(Array(entry.rows.enumerated()), id: \.element.id) { index, row in
            if let url = row.asset.detailURL {
              Link(destination: url) { listRow(row) }
            }
            if index < entry.rows.count - 1 {
              Rectangle().fill(secondary.opacity(colorScheme == .dark ? 0.06 : 0.14)).frame(height: 0.5)
            }
          }
        }
      }
      .padding(.horizontal, 17)
      .padding(.vertical, 8)
    } else {
      VStack(alignment: .leading, spacing: 0) {
        HStack(spacing: 10) {
          Text(entry.source == .hot ? "Hot Coins" : "Watchlist")
            .font(.system(size: 12, weight: .medium)).foregroundStyle(secondary)
            .lineLimit(1).minimumScaleFactor(0.7)
          Spacer(minLength: 0)
          if #available(iOS 17.0, *), let editorURL = entry.editorURL {
            Link(destination: editorURL) {
              ZStack {
                Image(systemName: "hexagon").font(.system(size: 15, weight: .medium))
                Image(systemName: "diamond.fill").font(.system(size: 6))
              }
              .frame(width: 18, height: 18)
              .foregroundStyle(secondary)
            }
            .accessibilityLabel("Edit widget")
          }
          Image("MarketWidgetOneKey").resizable().scaledToFit().frame(width: 18, height: 18)
        }
        if let row = entry.rows.first {
          MarketWidgetTokenIcon(asset: row.quote?.asset ?? row.asset, size: 32)
            .padding(.top, 17)
          Spacer(minLength: 10)
          HStack(alignment: .firstTextBaseline, spacing: 2) {
            Text(row.quote?.asset.displaySymbol ?? row.asset.displaySymbol)
              .font(.system(size: 14, weight: .medium)).lineLimit(1)
            change(row.quote?.change24h, size: 13)
            Spacer(minLength: 0)
            if row.failed { Image(systemName: "exclamationmark.circle").font(.system(size: 10)).foregroundStyle(secondary) }
          }
          Text(price(row.quote?.price)).font(.system(size: 28, weight: .semibold))
            .minimumScaleFactor(0.5).lineLimit(1).monospacedDigit()
            .accessibilityLabel(Text("USD price: \(price(row.quote?.price))"))
        } else { emptyState }
      }
      .padding(17)
    }
  }

  private var widgetURL: URL? {
    if entry.rows.count == 1 { return entry.rows.first?.asset.detailURL }
    if #available(iOS 17.0, *), entry.rows.isEmpty { return entry.editorURL }
    return URL(string: "onekey-wallet://market_widget")
  }

  private var emptyTitle: LocalizedStringKey {
    if entry.profileUnavailable { return "Configuration unavailable" }
    if entry.selectionUnavailable { return "Coin unavailable" }
    return entry.source == .watchlist ? "Your watchlist is empty" : "Prices unavailable"
  }

  private var emptyMessage: LocalizedStringKey {
    if entry.profileUnavailable { return "Open OneKey to check this configuration." }
    if entry.selectionUnavailable { return "Open OneKey to choose another coin." }
    if entry.source == .watchlist { return "Add coins or edit your configuration in OneKey." }
    return "Open OneKey and try again."
  }

  private var emptyState: some View {
    VStack(alignment: .leading, spacing: 8) {
      Spacer(minLength: 0)
      Text(emptyTitle).font(.system(size: 14, weight: .semibold))
      Text(emptyMessage).font(.system(size: 12)).foregroundStyle(secondary)
      Spacer(minLength: 0)
    }.frame(maxWidth: .infinity, alignment: .leading)
  }

  private func listRow(_ row: MarketWidgetRow) -> some View {
    let asset = row.quote?.asset ?? row.asset
    return GeometryReader { geometry in
      HStack(spacing: 0) {
        HStack(spacing: 17) {
          MarketWidgetTokenIcon(asset: asset, size: 32)
          VStack(alignment: .leading, spacing: 1) {
            Text(asset.displaySymbol).font(.system(size: 14, weight: .medium)).lineLimit(1)
            Text(asset.name).font(.system(size: 11)).foregroundStyle(secondary).lineLimit(1)
          }
        }
        .frame(width: geometry.size.width * 0.46, alignment: .leading)
        Group {
          if let chart = row.quote?.chart, chart.count >= 2 {
            MarketWidgetSparkline(points: chart).stroke(changeColor(row.quote?.change24h), style: StrokeStyle(lineWidth: 1, lineCap: .round, lineJoin: .round))
          } else {
            Text("—").font(.system(size: 12)).foregroundStyle(secondary)
          }
        }
        .frame(width: geometry.size.width * 0.195, height: 29)
        .accessibilityLabel("24-hour chart")
        Spacer(minLength: 6)
        VStack(alignment: .trailing, spacing: 0) {
          Text(price(row.quote?.price)).font(.system(size: 14, weight: .medium))
            .monospacedDigit().lineLimit(1).minimumScaleFactor(0.65)
          HStack(spacing: 3) {
            if row.failed { Image(systemName: "exclamationmark.circle").font(.system(size: 9)).foregroundStyle(secondary) }
            change(row.quote?.change24h, size: 12)
          }
        }
        .padding(.trailing, 1)
        .frame(maxWidth: .infinity, alignment: .trailing)
      }
      .frame(height: geometry.size.height)
    }
    .frame(maxHeight: .infinity)
    .accessibilityElement(children: .combine)
  }

  private func price(_ text: String?) -> String {
    guard let value = MarketWidgetQuote.decimal(text) else { return "—" }
    let formatter = NumberFormatter()
    formatter.locale = Locale(identifier: entry.configuration?.locale ?? "en-US")
    formatter.numberStyle = value > 0 && value < Decimal(sign: .plus, exponent: -8, significand: 1) ? .scientific : .decimal
    formatter.minimumFractionDigits = value >= 1 ? 2 : 0
    formatter.maximumFractionDigits = value >= 1 ? 2 : 8
    return formatter.string(from: NSDecimalNumber(decimal: value)).map { "$\($0)" } ?? "—"
  }

  private func changeColor(_ text: String?) -> Color {
    guard let value = MarketWidgetQuote.decimal(text) else { return secondary }
    let green = (value >= 0) == (entry.configuration?.greenUp ?? true)
    return green ? Color(red: 0.18, green: 0.74, blue: 0.54) : Color(red: 0.97, green: 0.27, blue: 0.39)
  }

  private func change(_ text: String?, size: CGFloat) -> some View {
    let number = MarketWidgetQuote.decimal(text)
    let formatter = NumberFormatter()
    formatter.locale = Locale(identifier: entry.configuration?.locale ?? "en-US")
    formatter.minimumFractionDigits = 2
    formatter.maximumFractionDigits = 2
    let label = number.flatMap { formatter.string(from: NSDecimalNumber(decimal: $0)) }
      .map { "\((number ?? 0) >= 0 ? "+" : "")\($0)%" } ?? "—"
    return Text(label).font(.system(size: size, weight: .medium)).monospacedDigit()
      .foregroundStyle(changeColor(text)).lineLimit(1).minimumScaleFactor(0.75)
      .accessibilityLabel(Text("24-hour change: \(label)"))
  }
}

struct MarketWidgetTokenIcon: View {
  let asset: MarketWidgetAsset
  let size: CGFloat
  var body: some View {
    Group {
      if let data = MarketWidgetStore().icon(for: asset), let image = UIImage(data: data) {
        Image(uiImage: image).resizable().scaledToFit()
      } else {
        Image(systemName: "circle.hexagongrid.fill").resizable().scaledToFit()
          .padding(5).foregroundStyle(.secondary).background(Color.secondary.opacity(0.10))
      }
    }.frame(width: size, height: size).clipShape(Circle()).accessibilityHidden(true)
  }
}

struct MarketWidgetSparkline: Shape {
  let points: [MarketWidgetChartPoint]
  func path(in rect: CGRect) -> Path {
    guard points.count >= 2, let minimum = points.map(\.value).min(),
          let maximum = points.map(\.value).max(), let first = points.first, let last = points.last,
          last.timestamp > first.timestamp else { return Path() }
    let range = maximum - minimum
    return Path { path in
      for (index, point) in points.enumerated() {
        let x = (point.timestamp - first.timestamp) / (last.timestamp - first.timestamp) * rect.width
        let y = range > 0 ? (1 - (point.value - minimum) / range) * (rect.height - 2) + 1 : rect.midY
        if index == 0 { path.move(to: CGPoint(x: x, y: y)) }
        else { path.addLine(to: CGPoint(x: x, y: y)) }
      }
    }
  }
}

private struct MarketWidgetBackground: ViewModifier {
  let background: LinearGradient
  func body(content: Content) -> some View {
    if #available(iOS 17.0, *) {
      content.containerBackground(for: .widget) { background }
    } else { content.background(background) }
  }
}
