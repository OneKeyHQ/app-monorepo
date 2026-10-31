import Foundation
import WidgetKit

enum MarketLockScreenTimeline {
  static func snapshot(assets: [MarketWidgetAsset], isWatchlist: Bool,
                       store: MarketWidgetStore = MarketWidgetStore()) -> MarketWidgetEntry {
    let configuration = store.configuration().configuration
    let permitted = configuration.map { $0.privacyMasked != true } == true
    let selected = permitted ? Array(assets.filter(\.isValid).prefix(isWatchlist ? 3 : 1)) : []
    return MarketWidgetEntry(date: Date(), configuration: configuration,
      rows: selected.map { MarketWidgetRow(asset: $0, quote: store.quote(for: $0)?.withFreshChart(), failed: false) },
      isWatchlist: isWatchlist, selectionUnavailable: selected.isEmpty, source: .hot)
  }

  static func timeline(assets: [MarketWidgetAsset], isWatchlist: Bool, includingChart: Bool,
                       store: MarketWidgetStore = MarketWidgetStore(),
                       service: MarketWidgetService = .shared) async -> Timeline<MarketWidgetEntry> {
    return await MarketWidgetDiagnostics.$refreshID.withValue(UUID().uuidString) {
      let started = Date()
      MarketWidgetDiagnostics.event("timeline.started", ["surface": "lock_screen", "kind": isWatchlist ? "list" : "single"])
      defer { MarketWidgetDiagnostics.event("timeline.completed", ["durationMs": Int(Date().timeIntervalSince(started) * 1000), "nextRequestedAfterSeconds": 900]) }
      let initial = snapshot(assets: assets, isWatchlist: isWatchlist, store: store)
      guard !initial.rows.isEmpty else { return result(initial) }
      do { try store.rememberLockScreenAssets(initial.rows.map(\.asset)) }
      catch { return result(snapshot(assets: assets, isWatchlist: isWatchlist, store: store)) }
      let rows = await withTaskGroup(of: (Int, MarketWidgetRow).self) { group in
        for (index, row) in initial.rows.enumerated() {
          group.addTask {
            do {
              let quote = try await service.quote(for: row.asset,
                locale: initial.configuration?.locale ?? "en-US", includingChart: includingChart)
              return (index, MarketWidgetRow(asset: row.asset, quote: quote, failed: false))
            } catch {
              MarketWidgetDiagnostics.event("timeline.quote_fallback", error: error)
              return (index, MarketWidgetRow(asset: row.asset, quote: row.quote?.withFreshChart(), failed: true))
            }
          }
        }
        var values: [(Int, MarketWidgetRow)] = []
        for await value in group { values.append(value) }
        return values.sorted { $0.0 < $1.0 }.map(\.1)
      }
      // The App can mask shared data while requests are suspended.
      let current = snapshot(assets: assets, isWatchlist: isWatchlist, store: store)
      guard current.configuration == initial.configuration else { return result(current) }
      return result(MarketWidgetEntry(date: Date(), configuration: current.configuration, rows: rows,
        isWatchlist: isWatchlist, selectionUnavailable: false, source: .hot))
    }
  }

  private static func result(_ entry: MarketWidgetEntry) -> Timeline<MarketWidgetEntry> {
    Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(15 * 60)))
  }

  static func preview(isWatchlist: Bool) -> MarketWidgetEntry {
    let date = Date()
    let prices = ["77447.70", "2214.59", "95.73"]
    let values = [1.0, 0.99, 1.0, 1.02, 1.01, 1.01, 1.08, 1.04, 1.02, 1.03, 0.91, 0.93, 0.90, 0.84, 0.87, 0.87]
    let rows = MarketWidgetAsset.defaults.prefix(isWatchlist ? 3 : 1).enumerated().map { index, asset in
      let chart = values.enumerated().map { offset, value in
        MarketWidgetChartPoint(timestamp: date.timeIntervalSince1970 - 86400 + Double(offset) / Double(values.count - 1) * 86400,
          value: value * (Double(prices[index]) ?? 1))
      }
      let quote = MarketWidgetQuote(asset: asset, price: prices[index], change24h: "-3.11", fetchedAt: date,
        chart: chart, chartFetchedAt: date)
      return MarketWidgetRow(asset: asset, quote: quote, failed: false)
    }
    return MarketWidgetEntry(date: date, configuration: .initial, rows: rows,
      isWatchlist: isWatchlist, selectionUnavailable: false, source: .hot)
  }
}
