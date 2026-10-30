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

  var editorURL: URL? {
    MarketWidgetEditorLink.url(profileID: profileID, kind: isWatchlist ? .list : .single)
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
      source: selection.source, profileID: selection.profileID, profileUnavailable: selection.profileUnavailable)
  }

  static func snapshot(isWatchlist: Bool, selected: [MarketWidgetAsset]? = nil,
                       source: MarketWidgetSource = .watchlist, profileID: String? = nil) -> MarketWidgetEntry {
    let store = MarketWidgetStore()
    return entry(selection: store.selection(kind: isWatchlist ? .list : .single, profileID: profileID,
      legacySource: source, legacyAsset: selected?.first), isWatchlist: isWatchlist, store: store)
  }

  static func timeline(isWatchlist: Bool, selected: [MarketWidgetAsset]? = nil,
                       source: MarketWidgetSource = .watchlist, profileID: String? = nil,
                       store: MarketWidgetStore = MarketWidgetStore(),
                       service: MarketWidgetService = .shared) async -> Timeline<MarketWidgetEntry> {
    let kind: MarketWidgetKind = isWatchlist ? .list : .single
    let initial = store.selection(kind: kind, profileID: profileID, legacySource: source, legacyAsset: selected?.first)
    if initial.source == .hot && initial.configuration.map({ $0.privacyMasked != true }) == true {
      if profileID == nil, let asset = selected?.first { try? store.rememberHotAsset(asset) }
      // A fixed coin remains valid after leaving the ranking; only dynamic selections need the catalog.
      if isWatchlist || (initial.profile?.asset == nil && selected?.first == nil) {
        _ = try? await service.trending(locale: initial.configuration?.locale ?? "en-US")
      }
    }
    let selection = store.selection(kind: kind, profileID: profileID, legacySource: source, legacyAsset: selected?.first)
    let snapshot = entry(selection: selection, isWatchlist: isWatchlist, store: store)
    let rows = await withTaskGroup(of: (Int, MarketWidgetRow).self) { group in
      for (index, row) in snapshot.rows.enumerated() {
        group.addTask {
          do {
            let quote = try await service.quote(
              for: row.asset, locale: snapshot.configuration?.locale ?? "en-US", includingChart: isWatchlist)
            return (index, MarketWidgetRow(asset: row.asset, quote: quote, failed: false))
          } catch {
            return (index, MarketWidgetRow(asset: row.asset, quote: row.quote?.withFreshChart(), failed: true))
          }
        }
      }
      var results: [(Int, MarketWidgetRow)] = []
      for await result in group { results.append(result) }
      return results.sorted { $0.0 < $1.0 }.map(\.1)
    }
    // Re-resolve the bound profile after awaits; edits must not publish the previous selection.
    let current = store.selection(kind: kind, profileID: profileID, legacySource: source, legacyAsset: selected?.first)
    guard current == selection else {
      return Timeline(entries: [entry(selection: current, isWatchlist: isWatchlist, store: store)],
        policy: .after(Date().addingTimeInterval(15 * 60)))
    }
    let entry = MarketWidgetEntry(date: Date(), configuration: snapshot.configuration,
      rows: rows, isWatchlist: isWatchlist, selectionUnavailable: snapshot.selectionUnavailable,
      source: snapshot.source, profileID: snapshot.profileID, profileUnavailable: snapshot.profileUnavailable)
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
