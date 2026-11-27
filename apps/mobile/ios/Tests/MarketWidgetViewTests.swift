import SwiftUI
import UIKit

// Compile with the widget sources, omitting the WidgetBundle's @main attribute.
// Include the widget's en/de Localizable.strings in the test executable's bundle.
@main
struct MarketWidgetViewTests {
  @MainActor static func main() throws {
    let now = Date(timeIntervalSince1970: 1_800_000_000)
    testQuoteAnnouncements(at: now)
    for size in [CGSize(width: 292, height: 141), CGSize(width: 305.5, height: 141),
                 CGSize(width: 321, height: 148), CGSize(width: 329, height: 155)] {
      for scheme in [ColorScheme.light, .dark] {
        for (age, failed) in [(0.0, false), (1800.0, false), (0.0, true)] {
          let first = render(change: "2.5", age: age, failed: failed, at: now, scheme: scheme, size: size)
          let second = render(change: "-9.25", age: age, failed: failed, at: now, scheme: scheme, size: size)
          precondition(first != second, "Daily change must render at age \(age), failed \(failed), scheme \(scheme)")
        }
        let expired = render(change: "2.5", age: 1800, failed: false, at: now, scheme: scheme, size: size)
        let older = render(change: "2.5", age: 7200, failed: false, at: now, scheme: scheme, size: size)
        precondition(expired != older, "Cached list rows must still render the quote timestamp")
        let fresh = render(change: "2.5", age: 0, failed: false, at: now, scheme: scheme, size: size)
        let failed = render(change: "2.5", age: 0, failed: true, at: now, scheme: scheme, size: size)
        precondition(fresh != failed, "A failed refresh must visibly mark the cached quote")
        for index in MarketWidgetAsset.defaults.indices {
          let changed = render(change: "-9.25", age: 1800, failed: false, at: now, scheme: scheme, size: size,
            changedRow: index)
          precondition(rowImage(expired, index: index, size: size) != rowImage(changed, index: index, size: size),
            "Every cached row must display its daily change at \(size)")
          let olderRow = render(change: "2.5", age: 7200, failed: false, at: now, scheme: scheme, size: size,
            changedRow: index)
          precondition(rowImage(expired, index: index, size: size) != rowImage(olderRow, index: index, size: size),
            "Every cached row must display its timestamp at \(size)")
        }
        let output = FileManager.default.temporaryDirectory.appendingPathComponent("market-widget-cached-\(Int(size.width))-\(scheme).png")
        try expired.write(to: output)
        print("Cached list rendering: \(output.path)")
      }
    }
    print("PASS: per-row daily change and timestamp at minimum, SE and regular sizes in both themes")
  }

  @MainActor private static func testQuoteAnnouncements(at now: Date) {
    let asset = MarketWidgetAsset.defaults[0]
    for (identifier, separator) in [("en-US", "."), ("de-DE", ",")] {
      let configuration = MarketWidgetConfiguration(schemaVersion: 1, assets: [], greenUp: true, locale: identifier)
      let cases: [(String?, String)] = [("2.5", "+2\(separator)50%"), ("-2.5", "-2\(separator)50%"),
        ("0", "+0\(separator)00%"), (nil, "—"), ("NaN", "—")]
      for (value, expected) in cases {
        for (age, failed) in [(0.0, false), (1800.0, false), (0.0, true)] {
          let date = now.addingTimeInterval(-age)
          let quote = MarketWidgetQuote(asset: asset, price: "123.45", change24h: value, fetchedAt: date)
          let row = MarketWidgetRow(asset: asset, quote: quote, failed: failed)
          let entry = MarketWidgetEntry(date: now, configuration: configuration, rows: [row],
            isWatchlist: true, selectionUnavailable: false)
          let label = MarketWidgetView(entry: entry).quoteStatusAccessibilityLabel(row, date: date)
          precondition(label.components(separatedBy: expected).count == 2,
            "The \(identifier) quote announcement must contain \(expected) exactly once: \(label)")
        }
      }
    }
    print("PASS: localized quote announcements preserve percentage units, signs and unavailable values")
  }

  private static func rowImage(_ data: Data, index: Int, size: CGSize) -> Data {
    guard let image = UIImage(data: data)?.cgImage else { preconditionFailure("Unable to decode list image") }
    let scale = CGFloat(image.width) / size.width
    let rowHeight = (size.height - 38) / 3
    let rect = CGRect(x: 0, y: (30 + CGFloat(index) * rowHeight) * scale,
      width: size.width * scale, height: rowHeight * scale).integral
    guard let cropped = image.cropping(to: rect), let pixels = cropped.dataProvider?.data else {
      preconditionFailure("Unable to crop cached row \(index)")
    }
    return pixels as Data
  }

  @MainActor private static func render(change: String, age: TimeInterval, failed: Bool,
                                        at now: Date, scheme: ColorScheme, size: CGSize, changedRow: Int? = nil) -> Data {
    let rows = MarketWidgetAsset.defaults.enumerated().map { index, asset in
      let selected = changedRow == nil || changedRow == index
      return MarketWidgetRow(asset: asset, quote: MarketWidgetQuote(asset: asset, price: "123.45",
        change24h: selected ? change : "2.5", fetchedAt: now.addingTimeInterval(-(selected ? age : 1800))), failed: failed)
    }
    let entry = MarketWidgetEntry(date: now, configuration: .initial, rows: rows,
      isWatchlist: true, selectionUnavailable: false, isGalleryPreview: true)
    let renderer = ImageRenderer(content: MarketWidgetView(entry: entry)
      .frame(width: size.width, height: size.height).environment(\.colorScheme, scheme))
    renderer.scale = 3
    guard let image = renderer.uiImage, let data = image.pngData() else {
      preconditionFailure("Unable to render the market list")
    }
    return data
  }
}
