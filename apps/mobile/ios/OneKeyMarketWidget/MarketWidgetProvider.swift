import Foundation
import WidgetKit

struct MarketWidgetRow: Identifiable {
  let asset: MarketWidgetAsset
  let quote: MarketWidgetQuote?
  let failed: Bool
  var id: String { asset.id }
}

struct MarketWidgetEntry: TimelineEntry {
  let date: Date
  let configuration: MarketWidgetConfiguration?
  let rows: [MarketWidgetRow]
  let isWatchlist: Bool
  let selectionUnavailable: Bool

  static func placeholder(isWatchlist: Bool) -> MarketWidgetEntry {
    MarketWidgetEntry(date: Date(), configuration: .initial,
      rows: MarketWidgetAsset.defaults.prefix(isWatchlist ? 3 : 1).map {
        MarketWidgetRow(asset: $0, quote: nil, failed: false)
      }, isWatchlist: isWatchlist, selectionUnavailable: false)
  }

  static func snapshot(isWatchlist: Bool, selected: [MarketWidgetAsset]? = nil) -> MarketWidgetEntry {
    let store = MarketWidgetStore()
    let configuration = store.configuration().configuration
    let available = configuration?.displayAssets ?? []
    let selectionUnavailable = selected?.contains { selected in
      !available.contains { $0.id == selected.id }
    } ?? false
    let canonicalSelection = selected?.compactMap { configuration?.asset(withID: $0.id) }
    let assets = selectionUnavailable ? [] : Array((canonicalSelection ?? available).prefix(isWatchlist ? 3 : 1))
    return MarketWidgetEntry(date: Date(), configuration: configuration,
      rows: assets.map { MarketWidgetRow(asset: $0, quote: store.quote(for: $0), failed: false) },
      isWatchlist: isWatchlist, selectionUnavailable: selectionUnavailable)
  }

  static func timeline(isWatchlist: Bool, selected: [MarketWidgetAsset]? = nil) async -> Timeline<MarketWidgetEntry> {
    let snapshot = snapshot(isWatchlist: isWatchlist, selected: selected)
    let rows = await withTaskGroup(of: (Int, MarketWidgetRow).self) { group in
      for (index, row) in snapshot.rows.enumerated() {
        group.addTask {
          do {
            let quote = try await MarketWidgetService.shared.quote(
              for: row.asset, locale: snapshot.configuration?.locale ?? "en-US")
            return (index, MarketWidgetRow(asset: row.asset, quote: quote, failed: false))
          } catch {
            return (index, MarketWidgetRow(asset: row.asset, quote: row.quote, failed: true))
          }
        }
      }
      var results: [(Int, MarketWidgetRow)] = []
      for await result in group { results.append(result) }
      return results.sorted { $0.0 < $1.0 }.map(\.1)
    }
    // An in-flight request must not publish a watchlist that was cleared or changed meanwhile.
    guard MarketWidgetStore().configuration().configuration == snapshot.configuration else {
      return Timeline(entries: [.snapshot(isWatchlist: isWatchlist, selected: selected)],
                      policy: .after(Date().addingTimeInterval(15 * 60)))
    }
    let entry = MarketWidgetEntry(date: Date(), configuration: snapshot.configuration,
      rows: rows, isWatchlist: isWatchlist, selectionUnavailable: snapshot.selectionUnavailable)
    // This is a requested reload time; WidgetKit decides when it can actually run.
    return Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(15 * 60)))
  }
}

struct MarketWidgetProvider: TimelineProvider {
  let isWatchlist: Bool
  func placeholder(in context: Context) -> MarketWidgetEntry { .placeholder(isWatchlist: isWatchlist) }
  func getSnapshot(in context: Context, completion: @escaping (MarketWidgetEntry) -> Void) {
    completion(.snapshot(isWatchlist: isWatchlist))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<MarketWidgetEntry>) -> Void) {
    Task { completion(await MarketWidgetEntry.timeline(isWatchlist: isWatchlist)) }
  }
}
