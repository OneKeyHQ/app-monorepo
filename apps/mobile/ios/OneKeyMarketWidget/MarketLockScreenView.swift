import SwiftUI
import WidgetKit

enum MarketLockScreenStyle: String {
  case watchlist, compact, price, chart
}

@available(iOS 17.0, *)
struct MarketLockScreenView: View {
  let entry: MarketWidgetEntry
  let style: MarketLockScreenStyle

  private var locale: Locale { Locale(identifier: entry.configuration?.locale ?? "en-US") }
  private var isMasked: Bool { entry.configuration == nil || entry.configuration?.privacyMasked == true }
  private var row: MarketWidgetRow? { isMasked ? nil : entry.rows.first }

  var body: some View {
    content
      .foregroundStyle(.primary)
      .environment(\.locale, locale)
      .widgetURL(widgetURL)
      .containerBackground(for: .widget) { Color.clear }
  }

  @ViewBuilder private var content: some View {
    switch style {
    case .watchlist: watchlist
    case .compact: compact
    case .price: largePrice
    case .chart: chart
    }
  }

  private var widgetURL: URL? {
    guard !isMasked else { return nil }
    if style != .watchlist { return row?.asset.detailURL }
    return URL(string: "onekey-wallet://market_widget")
  }

  private var watchlist: some View {
    VStack(spacing: 0) {
      if isMasked || entry.rows.isEmpty {
        unavailable
      } else {
        ForEach(Array(entry.rows.prefix(3).enumerated()), id: \.offset) { _, item in
          HStack(spacing: 4) {
            Text(symbol(item))
              .lineLimit(1).minimumScaleFactor(0.75)
              .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 2) {
              direction(item, size: 8)
              Text(price(item))
                .lineLimit(1).minimumScaleFactor(0.65).monospacedDigit()
            }
            .layoutPriority(1)
          }
          .font(.system(size: 12, weight: .medium))
          .frame(maxHeight: .infinity)
          .accessibilityElement(children: .ignore)
          .accessibilityLabel(accessibilityLabel(item))
        }
      }
    }
    // The accessory host already insets its content; expand only the three-row vertical rhythm.
    .padding(.vertical, -2)
  }

  private var compact: some View {
    ZStack {
      AccessoryWidgetBackground()
      if let row {
        VStack(spacing: 2) {
          Text(symbol(row))
            .font(.system(size: 14, weight: .semibold))
            .lineLimit(1).minimumScaleFactor(0.65)
          Text(price(row, compact: true))
            .font(.system(size: 12, weight: .medium))
            .lineLimit(1).minimumScaleFactor(0.6).monospacedDigit()
          direction(row, size: 8)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel(row))
      } else { unavailable }
    }
  }

  private var largePrice: some View {
    VStack(alignment: .leading, spacing: 5) {
      if let row {
        HStack(spacing: 3) {
          direction(row, size: 10)
          Text(symbol(row)).lineLimit(1).minimumScaleFactor(0.65)
          Text(MarketLockScreenFormatting.change(row.quote?.change24h, locale: locale))
            .lineLimit(1).minimumScaleFactor(0.75).monospacedDigit()
        }
        .font(.system(size: 13, weight: .medium))
        Text(price(row, currency: true, fixedDecimals: true))
          .font(.system(size: 32, weight: .medium))
          .lineLimit(1).minimumScaleFactor(0.45).monospacedDigit()
          .frame(maxWidth: .infinity, alignment: .leading)
      } else { unavailable }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(row.map(accessibilityLabel) ?? unavailableLabel)
  }

  private var chart: some View {
    VStack(spacing: 5) {
      if let row {
        HStack(spacing: 4) {
          Text(symbol(row))
            .lineLimit(1).minimumScaleFactor(0.7)
            .frame(maxWidth: .infinity, alignment: .leading)
          HStack(spacing: 2) {
            direction(row, size: 8)
            Text(price(row, currency: true))
              .lineLimit(1).minimumScaleFactor(0.65).monospacedDigit()
          }
          .layoutPriority(1)
        }
        .font(.system(size: 13, weight: .medium))
        .frame(height: 16)
        if let points = row.quote?.chart, MarketLockScreenChartGeometry.isValid(points) {
          MarketLockScreenChart(points: points)
            .accessibilityLabel(localized("market_widget_chart__desc"))
        } else {
          Text("—").font(.system(size: 13)).frame(maxWidth: .infinity, maxHeight: .infinity)
            .accessibilityLabel(localized("market_widget_chart_unavailable__msg"))
        }
      } else { unavailable }
    }
  }

  private var unavailable: some View {
    Text("—")
      .font(.system(size: 16))
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .accessibilityLabel(unavailableLabel)
  }

  private var unavailableLabel: String {
    localized(isMasked ? "market_widget_prices_hidden__msg" : "wallet.price_unavailable")
  }

  private func localized(_ key: String, arguments: [CVarArg] = []) -> String {
    MarketWidgetLocalization.text(key, locale: locale, arguments: arguments)
  }

  private func symbol(_ row: MarketWidgetRow) -> String {
    (row.quote?.asset ?? row.asset).displaySymbol
  }

  private func price(_ row: MarketWidgetRow, currency: Bool = false,
                     compact: Bool = false, fixedDecimals: Bool = false) -> String {
    MarketLockScreenFormatting.price(row.quote?.price, locale: locale,
      currency: currency, compact: compact, fixedDecimals: fixedDecimals)
  }

  @ViewBuilder private func direction(_ row: MarketWidgetRow, size: CGFloat) -> some View {
    if let change = MarketWidgetQuote.decimal(row.quote?.change24h), change != 0 {
      MarketLockScreenDirection(pointsUp: change > 0)
        .fill(.primary)
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    } else {
      Text("—").font(.system(size: size)).frame(width: size, height: size)
        .accessibilityHidden(true)
    }
  }

  private func accessibilityLabel(_ row: MarketWidgetRow) -> String {
    let change = MarketLockScreenFormatting.change(row.quote?.change24h, locale: locale)
    return localized(row.failed ? "market_widget_quote_cached__desc" : "market_widget_quote__desc",
      arguments: [symbol(row), price(row, fixedDecimals: style == .price), change])
  }
}

enum MarketLockScreenFormatting {
  static func price(_ text: String?, locale: Locale, currency: Bool = false,
                    compact: Bool = false, fixedDecimals: Bool = false) -> String {
    guard let number = MarketWidgetQuote.decimal(text), number >= 0 else { return "—" }
    let formatter = NumberFormatter()
    formatter.locale = locale
    let scientific = number > 0 && number < Decimal(sign: .plus, exponent: compact ? -6 : -8, significand: 1)
    formatter.numberStyle = scientific ? .scientific : .decimal
    if scientific {
      formatter.maximumFractionDigits = compact ? 2 : 3
    } else if number >= 1 || number == 0 {
      let singleDecimal = !fixedDecimals && number >= 10_000
      formatter.minimumFractionDigits = singleDecimal ? 1 : (fixedDecimals ? 2 : 0)
      formatter.maximumFractionDigits = singleDecimal ? 1 : 2
    } else {
      formatter.usesSignificantDigits = true
      formatter.minimumSignificantDigits = 1
      formatter.maximumSignificantDigits = compact ? 4 : 6
    }
    guard let value = formatter.string(from: NSDecimalNumber(decimal: number)) else { return "—" }
    return currency ? "$\(value)" : value
  }

  static func change(_ text: String?, locale: Locale) -> String {
    guard let number = MarketWidgetQuote.decimal(text) else { return "—" }
    let formatter = NumberFormatter()
    formatter.locale = locale
    formatter.minimumFractionDigits = 2
    formatter.maximumFractionDigits = 2
    guard let value = formatter.string(from: NSDecimalNumber(decimal: number)) else { return "—" }
    return "\(number > 0 ? "+" : "")\(value)%"
  }
}

private struct MarketLockScreenDirection: Shape {
  let pointsUp: Bool
  func path(in rect: CGRect) -> Path {
    let vertices = [
      CGPoint(x: rect.minX, y: pointsUp ? rect.maxY : rect.minY),
      CGPoint(x: rect.maxX, y: pointsUp ? rect.maxY : rect.minY),
      CGPoint(x: rect.midX, y: pointsUp ? rect.minY : rect.maxY),
    ]
    func inset(_ vertex: CGPoint, toward other: CGPoint) -> CGPoint {
      CGPoint(x: vertex.x + (other.x - vertex.x) * 0.1,
        y: vertex.y + (other.y - vertex.y) * 0.1)
    }
    return Path { path in
      for index in vertices.indices {
        let vertex = vertices[index]
        let start = inset(vertex, toward: vertices[(index + 2) % 3])
        let end = inset(vertex, toward: vertices[(index + 1) % 3])
        if index == 0 { path.move(to: start) } else { path.addLine(to: start) }
        path.addQuadCurve(to: end, control: vertex)
      }
      path.closeSubpath()
    }
  }
}

struct MarketLockScreenChartGeometry {
  let points: [MarketWidgetChartPoint]

  static func isValid(_ points: [MarketWidgetChartPoint]) -> Bool {
    points.count >= 2 && points.allSatisfy { $0.value.isFinite && $0.value > 0 && $0.timestamp.isFinite }
      && zip(points, points.dropFirst()).allSatisfy { $0.timestamp < $1.timestamp }
  }

  func coordinates(in rect: CGRect) -> [CGPoint] {
    guard Self.isValid(points), let first = points.first, let last = points.last,
          let minimum = points.map(\.value).min(), let maximum = points.map(\.value).max() else { return [] }
    let range = maximum - minimum
    let inset = min(1, rect.height / 2)
    return points.map { point in
      CGPoint(x: rect.minX + CGFloat((point.timestamp - first.timestamp) / (last.timestamp - first.timestamp)) * rect.width,
        y: range > 0
          ? rect.minY + inset + CGFloat(1 - (point.value - minimum) / range) * max(0, rect.height - inset * 2)
          : rect.midY)
    }
  }
}

private struct MarketLockScreenChart: View {
  let points: [MarketWidgetChartPoint]

  var body: some View {
    GeometryReader { proxy in
      let rect = CGRect(origin: .zero, size: proxy.size)
      let coordinates = MarketLockScreenChartGeometry(points: points).coordinates(in: rect)
      ZStack {
        if let first = coordinates.first, let last = coordinates.last {
          Path { path in
            path.addLines(coordinates)
            path.addLine(to: CGPoint(x: last.x, y: rect.maxY))
            path.addLine(to: CGPoint(x: first.x, y: rect.maxY))
            path.closeSubpath()
          }
          .fill(LinearGradient(colors: [.primary.opacity(0.5), .primary.opacity(0)],
            startPoint: .top, endPoint: .bottom))
          // The reference line represents the first price in this chart's sampled interval.
          Path { path in
            path.move(to: CGPoint(x: rect.minX, y: first.y))
            path.addLine(to: CGPoint(x: rect.maxX, y: first.y))
          }
          .stroke(.primary.opacity(0.8), style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
          Path { $0.addLines(coordinates) }
            .stroke(.primary, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
        }
      }
    }
  }
}
