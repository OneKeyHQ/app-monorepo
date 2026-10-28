import SwiftUI
import WidgetKit

@main
struct OneKeyMarketWidgets: WidgetBundle {
  var body: some Widget {
    singleWidget()
    MarketWatchlistWidget()
  }

  private func singleWidget() -> some Widget {
    // Both paths use the builder's availability wrapper because WidgetBundleBuilder has no buildEither.
    if #available(iOS 17.0, *) {
      return WidgetBundleBuilder.buildOptional(
        WidgetBundleBuilder.buildLimitedAvailability(MarketSingleWidget())
      )
    } else {
      return WidgetBundleBuilder.buildOptional(
        WidgetBundleBuilder.buildLimitedAvailability(LegacyMarketSingleWidget())
      )
    }
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

struct MarketWatchlistWidget: Widget {
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

  var body: some View {
    content
      .widgetURL(entry.rows.count == 1 ? entry.rows.first?.asset.detailURL : URL(string: "onekey-wallet://market_widget"))
      .environment(\.locale, Locale(identifier: entry.configuration?.locale ?? "en-US"))
      .modifier(MarketWidgetBackground())
  }

  private var content: some View {
    VStack(alignment: .leading, spacing: entry.isWatchlist ? 5 : 8) {
      HStack {
        Text("OneKey").font(.caption.weight(.semibold))
        Spacer(minLength: 4)
        Text("USD · 24h").font(.caption2).foregroundStyle(.secondary).lineLimit(1)
        if #available(iOS 17.0, *), !entry.rows.isEmpty {
          Button(intent: RefreshMarketWidgetIntent(assets: entry.rows.map(\.asset))) {
            Image(systemName: "arrow.clockwise").font(.caption)
          }
          .buttonStyle(.plain)
          .accessibilityLabel("Refresh prices")
        }
      }
      if entry.configuration == nil || entry.selectionUnavailable {
        Spacer(minLength: 0)
        Text(entry.selectionUnavailable ? LocalizedStringKey("Coin no longer in watchlist. Edit this widget to choose another.") : LocalizedStringKey("Open OneKey to sync your watchlist."))
          .font(.caption).foregroundStyle(.secondary)
        Spacer(minLength: 0)
      } else if entry.isWatchlist {
        ForEach(entry.rows) { row in
          if let url = row.asset.detailURL {
            Link(destination: url) { listRow(row) }
          }
        }
        Spacer(minLength: 0)
        updatedAt
      } else if let row = entry.rows.first {
        VStack(alignment: .leading, spacing: 4) {
          Text(row.quote?.asset.displaySymbol ?? row.asset.displaySymbol)
            .font(.subheadline.weight(.semibold)).lineLimit(1)
          if let chain = row.asset.chainId {
            Text(chain).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
          }
          Text(price(row.quote?.price))
            .font(.system(size: 28, weight: .semibold, design: .rounded))
            .minimumScaleFactor(0.5).lineLimit(1).monospacedDigit()
          change(row.quote?.change24h)
        }
        Spacer(minLength: 0)
        updatedAt
      }
    }
  }

  private func listRow(_ row: MarketWidgetRow) -> some View {
    HStack(spacing: 8) {
      VStack(alignment: .leading, spacing: 0) {
        Text(row.quote?.asset.displaySymbol ?? row.asset.displaySymbol)
          .font(.subheadline.weight(.medium)).lineLimit(1)
        if let chain = row.asset.chainId {
          Text(chain).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      Text(price(row.quote?.price)).font(.subheadline.weight(.medium))
        .monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
      change(row.quote?.change24h).frame(width: 76, alignment: .trailing)
    }
    .foregroundStyle(.primary)
  }

  @ViewBuilder private var updatedAt: some View {
    let date = entry.rows.compactMap { $0.quote?.fetchedAt }.min()
    HStack(spacing: 3) {
      if entry.rows.contains(where: { $0.failed }) {
        Image(systemName: "exclamationmark.arrow.triangle.2.circlepath")
      }
      if let date {
        Text("Updated")
        Text(updatedDate(date)).monospacedDigit()
      } else {
        Text("Prices unavailable")
      }
    }
    .font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1)
    .minimumScaleFactor(0.85)
    .accessibilityElement(children: .combine)
  }

  private func updatedDate(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: entry.configuration?.locale ?? "en-US")
    formatter.setLocalizedDateFormatFromTemplate("MdHm")
    return formatter.string(from: date)
  }

  private func price(_ value: String?) -> String {
    guard let value = MarketWidgetQuote.decimal(value) else { return "—" }
    let formatter = NumberFormatter()
    formatter.locale = Locale(identifier: entry.configuration?.locale ?? "en-US")
    formatter.numberStyle = value > 0 && value < Decimal(sign: .plus, exponent: -8, significand: 1) ? .scientific : .currency
    formatter.currencyCode = "USD"
    formatter.currencySymbol = "$"
    formatter.minimumFractionDigits = value >= 1 ? 2 : 0
    formatter.maximumFractionDigits = value >= 1 ? 2 : 18
    guard let formatted = formatter.string(from: NSDecimalNumber(decimal: value)) else { return "—" }
    return formatter.numberStyle == .scientific ? "$\(formatted)" : formatted
  }

  private func change(_ value: String?) -> some View {
    let number = MarketWidgetQuote.decimal(value)
    let isPositive = (number ?? 0) >= 0
    let green = isPositive == (entry.configuration?.greenUp ?? true)
    let formatter = NumberFormatter()
    formatter.locale = Locale(identifier: entry.configuration?.locale ?? "en-US")
    formatter.numberStyle = .decimal
    formatter.minimumFractionDigits = 2
    formatter.maximumFractionDigits = 2
    let label = number.flatMap { formatter.string(from: NSDecimalNumber(decimal: $0)) }
      .map { "\(isPositive ? "+" : "")\($0)%" } ?? "—"
    return Text(label).font(.caption.weight(.medium)).monospacedDigit()
      .foregroundStyle(number == nil ? Color.secondary : (green ? .green : .red))
      .accessibilityLabel(Text("24-hour change: \(label)"))
  }
}

private struct MarketWidgetBackground: ViewModifier {
  func body(content: Content) -> some View {
    if #available(iOS 17.0, *) {
      content.containerBackground(.background, for: .widget)
    } else {
      content.padding(16).background(Color(.systemBackground))
    }
  }
}
