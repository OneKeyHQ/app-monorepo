import Foundation

// Compile with the shared widget sources, MarketWidgetProvider, and MarketLockScreenView.
@main
struct MarketLockScreenViewTests {
  private static var checks = 0

  private static func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
    checks += 1
    precondition(condition(), message)
  }

  static func main() {
    let locale = Locale(identifier: "en-US")
    for invalid in [nil, "", "NaN", "Infinity", "-1", "1garbage", "1\n", "1,234"] as [String?] {
      expect(MarketLockScreenFormatting.price(invalid, locale: locale) == "—",
             "Invalid or missing prices must remain unavailable, not zero")
    }
    expect(MarketLockScreenFormatting.price("0", locale: locale, currency: true, fixedDecimals: true) == "$0.00",
           "A real zero keeps the large-price decimal format")
    expect(MarketLockScreenFormatting.price("77447.7", locale: locale, currency: true) == "$77,447.7",
           "The compact rectangular formats preserve meaningful decimals without padding")
    expect(MarketLockScreenFormatting.price("77447.7", locale: locale, currency: true, fixedDecimals: true) == "$77,447.70",
           "The large price uses two decimal places")
    expect(MarketLockScreenFormatting.price("123456789.12", locale: locale, currency: true) == "$123,456,789.12",
           "Large prices remain numeric rather than being abbreviated or clamped")
    expect(MarketLockScreenFormatting.price("0.028765", locale: locale) == "0.028765",
           "Sub-dollar assets retain their significant fractional digits")
    expect(MarketLockScreenFormatting.price("0.028765", locale: locale, compact: true) == "0.02876",
           "The circular price limits significant digits to fit its smaller area")
    for (price, exponent) in [("0.000000001", "-9"), ("0.000000000000000001", "-18")] {
      expect(MarketLockScreenFormatting.price(price, locale: locale, compact: true) == "1E\(exponent)",
             "Tiny positive circular prices must not display a false zero")
      expect(MarketLockScreenFormatting.price(price, locale: locale, currency: true) == "$1E\(exponent)",
             "Tiny positive rectangular prices must not display a false zero")
    }
    expect(MarketLockScreenFormatting.price("77447.7", locale: Locale(identifier: "de-DE"),
      currency: true, fixedDecimals: true) == "$77.447,70", "Price separators follow the configured locale")
    expect(MarketLockScreenFormatting.change(nil, locale: locale) == "—", "A missing change is not flat performance")
    expect(MarketLockScreenFormatting.change("NaN", locale: locale) == "—", "An invalid change remains unavailable")
    expect(MarketLockScreenFormatting.change("-4.24", locale: locale) == "-4.24%", "A decline keeps its sign")
    expect(MarketLockScreenFormatting.change("2", locale: locale) == "+2.00%", "A gain has an explicit positive sign")
    expect(MarketLockScreenFormatting.change("0", locale: locale) == "0.00%", "An unchanged price is neutral")

    let rect = CGRect(x: 10, y: 20, width: 150, height: 40)
    let points = [MarketWidgetChartPoint(timestamp: 100, value: 20),
                  MarketWidgetChartPoint(timestamp: 125, value: 30),
                  MarketWidgetChartPoint(timestamp: 200, value: 10)]
    let coordinates = MarketLockScreenChartGeometry(points: points).coordinates(in: rect)
    expect(coordinates.count == points.count, "Each real sample has one plotted point")
    expect(coordinates.first?.x == rect.minX && coordinates.last?.x == rect.maxX,
           "The chart uses the full horizontal range")
    expect(coordinates[1].x == rect.minX + rect.width * 0.25,
           "Horizontal positions respect timestamps rather than equal array spacing")
    expect(coordinates[1].y == rect.minY + 1 && coordinates[2].y == rect.maxY - 1,
           "Highest and lowest values remain inside the stroke inset")
    expect(coordinates[0].y == rect.midY,
           "The first-point reference line shares the same price scale as the chart")
    expect(coordinates.allSatisfy {
      $0.x.isFinite && $0.y.isFinite && (rect.minX...rect.maxX).contains($0.x)
        && (rect.minY...rect.maxY).contains($0.y)
    },
           "Every plotted coordinate stays finite and within its drawing bounds")

    let flat = [MarketWidgetChartPoint(timestamp: 100, value: 20),
                MarketWidgetChartPoint(timestamp: 200, value: 20)]
    expect(MarketLockScreenChartGeometry(points: flat).coordinates(in: rect).allSatisfy { $0.y == rect.midY },
           "Flat prices render as a centered horizontal line without division by zero")
    let invalidCharts: [[MarketWidgetChartPoint]] = [
      [], [points[0]],
      [points[0], MarketWidgetChartPoint(timestamp: 200, value: .nan)],
      [points[0], MarketWidgetChartPoint(timestamp: 200, value: .infinity)],
      [points[0], MarketWidgetChartPoint(timestamp: 200, value: 0)],
      [points[0], MarketWidgetChartPoint(timestamp: 200, value: -1)],
      [points[0], MarketWidgetChartPoint(timestamp: .nan, value: 30)],
      [points[0], MarketWidgetChartPoint(timestamp: .infinity, value: 30)],
      [points[0], MarketWidgetChartPoint(timestamp: 100, value: 30)],
      [points[0], MarketWidgetChartPoint(timestamp: 99, value: 30)],
    ]
    for invalid in invalidCharts {
      expect(!MarketLockScreenChartGeometry.isValid(invalid), "Incomplete or invalid charts are not drawable")
      expect(MarketLockScreenChartGeometry(points: invalid).coordinates(in: rect).isEmpty,
             "Invalid chart data must not fabricate a trend")
    }
    let zeroSize = MarketLockScreenChartGeometry(points: points).coordinates(in: .zero)
    expect(zeroSize.count == 3 && zeroSize.allSatisfy { $0 == .zero },
           "A zero-sized layout keeps coordinates finite")
    print("MarketLockScreenViewTests: \(checks) checks passed")
  }
}
