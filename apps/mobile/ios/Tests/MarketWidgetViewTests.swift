import SwiftUI
import UIKit

// Compile with the widget sources, omitting the WidgetBundle's @main attribute.
@main
struct MarketWidgetViewTests {
  @MainActor static func main() throws {
    let now = Date(timeIntervalSince1970: 1_800_000_000)
    for scheme in [ColorScheme.light, .dark] {
      for (age, failed) in [(0.0, false), (1800.0, false), (0.0, true)] {
        let first = render(change: "2.5", age: age, failed: failed, at: now, scheme: scheme)
        let second = render(change: "-9.25", age: age, failed: failed, at: now, scheme: scheme)
        precondition(first != second, "Daily change must render at age \(age), failed \(failed), scheme \(scheme)")
      }
      let expired = render(change: "2.5", age: 1800, failed: false, at: now, scheme: scheme)
      let older = render(change: "2.5", age: 7200, failed: false, at: now, scheme: scheme)
      precondition(expired != older, "Cached list rows must still render the quote timestamp")
      let fresh = render(change: "2.5", age: 0, failed: false, at: now, scheme: scheme)
      let failed = render(change: "2.5", age: 0, failed: true, at: now, scheme: scheme)
      precondition(fresh != failed, "A failed refresh must visibly mark the cached quote")
      let output = FileManager.default.temporaryDirectory.appendingPathComponent("market-widget-cached-\(scheme).png")
      try expired.write(to: output)
      print("Cached list rendering: \(output.path)")
    }
    print("PASS: daily change, cached timestamp and refresh warning in light and dark lists")
  }

  @MainActor private static func render(change: String, age: TimeInterval, failed: Bool,
                                        at now: Date, scheme: ColorScheme) -> Data {
    let rows = MarketWidgetAsset.defaults.map { asset in
      MarketWidgetRow(asset: asset, quote: MarketWidgetQuote(asset: asset, price: "123.45",
        change24h: change, fetchedAt: now.addingTimeInterval(-age)), failed: failed)
    }
    let entry = MarketWidgetEntry(date: now, configuration: .initial, rows: rows,
      isWatchlist: true, selectionUnavailable: false, isGalleryPreview: true)
    let renderer = ImageRenderer(content: MarketWidgetView(entry: entry)
      .frame(width: 329, height: 155).environment(\.colorScheme, scheme))
    renderer.scale = 3
    guard let image = renderer.uiImage, let data = image.pngData() else {
      preconditionFailure("Unable to render the market list")
    }
    return data
  }
}
