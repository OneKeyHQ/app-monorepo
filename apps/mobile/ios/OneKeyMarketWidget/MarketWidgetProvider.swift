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
  var source: MarketWidgetSource = .watchlist
  var profileID: String? = nil
  var profileUnavailable = false
  var manualSelection = false

  var editorURL: URL? {
    MarketWidgetEditorLink.url(profileID: nil, kind: isWatchlist ? .list : .single)
  }

  static func placeholder(isWatchlist: Bool) -> MarketWidgetEntry {
    MarketWidgetEntry(date: Date(), configuration: .initial,
      rows: MarketWidgetAsset.defaults.prefix(isWatchlist ? 3 : 1).map {
        MarketWidgetRow(asset: $0, quote: nil, failed: false)
      }, isWatchlist: isWatchlist, selectionUnavailable: false, source: .hot)
  }

  private static func entry(selection: MarketWidgetSelection, isWatchlist: Bool,
                            store: MarketWidgetStore) -> MarketWidgetEntry {
    MarketWidgetEntry(date: Date(), configuration: selection.configuration,
      rows: selection.assets.map { MarketWidgetRow(asset: $0, quote: store.quote(for: $0), failed: false) },
      isWatchlist: isWatchlist, selectionUnavailable: selection.selectionUnavailable,
      source: selection.source, profileID: selection.profileID, profileUnavailable: selection.profileUnavailable,
      manualSelection: selection.profile?.assets != nil)
  }

  static func snapshot(isWatchlist: Bool, selected _: [MarketWidgetAsset]? = nil,
                       source _: MarketWidgetSource = .watchlist, profileID _: String? = nil,
                       store: MarketWidgetStore = MarketWidgetStore()) -> MarketWidgetEntry {
    entry(selection: store.selection(kind: isWatchlist ? .list : .single), isWatchlist: isWatchlist, store: store)
  }

  static func timeline(isWatchlist: Bool, selected _: [MarketWidgetAsset]? = nil,
                       source _: MarketWidgetSource = .watchlist, profileID _: String? = nil,
                       store: MarketWidgetStore = MarketWidgetStore(),
                       service: MarketWidgetService = .shared) async -> Timeline<MarketWidgetEntry> {
    return await MarketWidgetDiagnostics.$refreshID.withValue(UUID().uuidString) {
      let started = Date()
      MarketWidgetDiagnostics.event("timeline.started", ["surface": "home", "kind": isWatchlist ? "list" : "single"])
      defer { MarketWidgetDiagnostics.event("timeline.completed", ["durationMs": Int(Date().timeIntervalSince(started) * 1000), "nextRequestedAfterSeconds": 900]) }
      let kind: MarketWidgetKind = isWatchlist ? .list : .single
      let initial = store.selection(kind: kind)
      // Single-coin settings are fixed, including the initial BTC default.
      if isWatchlist, initial.profile?.assets == nil, initial.source == .hot, initial.configuration.map({ $0.privacyMasked != true }) == true {
        _ = try? await service.trending(locale: initial.configuration?.locale ?? "en-US")
      }
      let selection = store.selection(kind: kind)
      let snapshot = entry(selection: selection, isWatchlist: isWatchlist, store: store)
      let rows = await withTaskGroup(of: (Int, MarketWidgetRow).self) { group in
        for (index, row) in snapshot.rows.enumerated() {
          group.addTask {
            do {
              let quote = try await service.quote(
                for: row.asset, locale: snapshot.configuration?.locale ?? "en-US", includingChart: isWatchlist)
              return (index, MarketWidgetRow(asset: row.asset, quote: quote, failed: false))
            } catch {
              MarketWidgetDiagnostics.event("timeline.quote_fallback", error: error)
              return (index, MarketWidgetRow(asset: row.asset, quote: row.quote?.withFreshChart(), failed: true))
            }
          }
        }
        var results: [(Int, MarketWidgetRow)] = []
        for await result in group { results.append(result) }
        return results.sorted { $0.0 < $1.0 }.map(\.1)
      }
      // Settings and privacy can change while a quote is pending in another process.
      let current = store.selection(kind: kind)
      guard current == selection else {
        return Timeline(entries: [entry(selection: current, isWatchlist: isWatchlist, store: store)],
          policy: .after(Date().addingTimeInterval(15 * 60)))
      }
      let entry = MarketWidgetEntry(date: Date(), configuration: snapshot.configuration,
        rows: rows, isWatchlist: isWatchlist, selectionUnavailable: snapshot.selectionUnavailable,
        source: snapshot.source, profileID: snapshot.profileID, profileUnavailable: snapshot.profileUnavailable,
        manualSelection: snapshot.manualSelection)
      return Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(15 * 60)))
    }
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
