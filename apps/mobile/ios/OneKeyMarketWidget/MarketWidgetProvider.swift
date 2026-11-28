import Foundation
import WidgetKit

struct MarketWidgetRow: Identifiable {
  static let lockScreenFreshnessInterval: TimeInterval = 15 * 60
  let asset: MarketWidgetAsset
  let quote: MarketWidgetQuote?
  let failed: Bool
  var id: String { asset.id }
  var priceDate: Date? { quote.map { $0.priceUpdatedAt ?? $0.fetchedAt } }

  func cacheDate(at date: Date) -> Date? {
    guard let quote, failed || date.timeIntervalSince(quote.fetchedAt) >= Self.lockScreenFreshnessInterval else { return nil }
    return priceDate
  }

  func lockScreenCacheDate(at date: Date) -> Date? { cacheDate(at: date) }

  func forLockScreen(at now: Date) -> MarketWidgetRow {
    guard let quote, quote.fetchedAt.timeIntervalSince(now) <= 60 else {
      return MarketWidgetRow(asset: asset, quote: nil, failed: true)
    }
    return MarketWidgetRow(asset: asset, quote: quote.withFreshChart(at: now), failed: failed)
  }
}

struct MarketWidgetTimelineQuotes {
  let base: MarketWidgetEntry
  let quotes: [MarketWidgetQuoteSnapshot]

  init(base: MarketWidgetEntry, store: MarketWidgetStore) {
    self.base = base
    let mode = store.chartMode()
    let captured = base.rows.map { row in
      store.quoteSnapshot(for: row.asset, fallback: row.quote, mode: mode, at: base.date)
    }
    quotes = store.configuration().configuration.map { $0.privacyMasked != true } == true ? captured : []
  }

  var appQuoteExpiryDates: Set<Date> {
    Set(quotes.compactMap(\.appQuoteExpiresAt).filter { $0 > base.date })
  }

  var detailRows: [MarketWidgetRow] {
    zip(base.rows, quotes).map { row, snapshot in
      MarketWidgetRow(asset: row.asset, quote: snapshot.detail, failed: row.failed)
    }
  }

  func entry(at date: Date, preservingRefreshFailure: Bool = false) -> MarketWidgetEntry {
    var entry = base
    entry.date = date
    entry.rows = zip(base.rows, quotes).map { row, snapshot in
      let quote = snapshot.quote(at: date)
      return MarketWidgetRow(asset: row.asset, quote: quote,
        failed: row.failed && (preservingRefreshFailure || quote?.chartMode == nil))
    }
    return entry
  }
}

struct MarketWidgetEntry: TimelineEntry {
  var date: Date
  let configuration: MarketWidgetConfiguration?
  var rows: [MarketWidgetRow]
  let isWatchlist: Bool
  let selectionUnavailable: Bool
  var source: MarketWidgetSource = .watchlist
  var profileID: String? = nil
  var instanceNumber: Int? = nil
  var profileUnavailable = false
  var manualSelection = false
  var isGalleryPreview = false

  func usingChartMode(in store: MarketWidgetStore) -> MarketWidgetEntry {
    MarketWidgetTimelineQuotes(base: self, store: store).entry(at: date)
  }

  func canDisplayOnLockScreen(store: MarketWidgetStore = MarketWidgetStore()) -> Bool {
    guard let configuration, configuration.privacyMasked != true else { return false }
    if isGalleryPreview { return true }
    // Travel Mode can change between producing the timeline and WidgetKit archiving its views.
    return store.configuration().configuration.map { $0.privacyMasked != true } == true
  }

  var editorURL: URL? {
    guard !isGalleryPreview else { return nil }
    let kind: MarketWidgetKind = isWatchlist ? .list : .single
    if let profileID, let id = UUID(uuidString: profileID) {
      return MarketWidgetEditorLink.url(instance: MarketWidgetInstanceBinding(id: id, kind: kind))
    }
    return MarketWidgetEditorLink.url(profileID: nil, kind: kind)
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
      isWatchlist: isWatchlist, selectionUnavailable: false, source: .hot, isGalleryPreview: true)
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
      rows: selection.assets.map { MarketWidgetRow(asset: $0, quote: store.quote(for: $0, allowLegacy: true), failed: false) },
      isWatchlist: isWatchlist, selectionUnavailable: selection.selectionUnavailable,
      source: selection.source, profileID: selection.profileID, instanceNumber: selection.profile?.instanceNumber,
      profileUnavailable: selection.profileUnavailable,
      manualSelection: selection.profile?.assets != nil)
  }

  static func snapshot(isWatchlist: Bool, selected _: [MarketWidgetAsset]? = nil,
                       source _: MarketWidgetSource = .watchlist, profileID _: String? = nil, instanceID: UUID? = nil,
                       store: MarketWidgetStore = MarketWidgetStore()) -> MarketWidgetEntry {
    entry(selection: store.selection(kind: isWatchlist ? .list : .single, instanceID: instanceID), isWatchlist: isWatchlist, store: store)
      .usingChartMode(in: store)
  }

  static func loadedSnapshot(isWatchlist: Bool, instanceID: UUID? = nil,
                             store: MarketWidgetStore = MarketWidgetStore(),
                             service: MarketWidgetService = .shared) async -> MarketWidgetEntry {
    let initial = snapshot(isWatchlist: isWatchlist, instanceID: instanceID, store: store)
    guard initial.rows.contains(where: { $0.quote == nil }) else { return initial }
    // The first real snapshot needs prices, but must not wait for ranking, chart or icon requests.
    let fetched = await withTaskGroup(of: MarketWidgetQuote?.self) { group in
      for row in initial.rows where row.quote == nil {
        group.addTask {
          do { return try await service.price(for: row.asset, locale: initial.configuration?.locale ?? "en-US") }
          catch { MarketWidgetDiagnostics.event("snapshot.quote_failed", error: error); return nil }
        }
      }
      var quotes: [String: MarketWidgetQuote] = [:]
      for await quote in group {
        if let quote { quotes[quote.asset.id] = quote.merging(quotes[quote.asset.id]) }
      }
      return quotes
    }
    var result = entry(selection: store.selection(kind: isWatchlist ? .list : .single, instanceID: instanceID),
      isWatchlist: isWatchlist, store: store)
    result.rows = result.rows.map { row in
      let quote = store.permitsRequests(for: row.asset)
        ? fetched[row.id]?.merging(row.quote, at: result.date) ?? row.quote : nil
      return MarketWidgetRow(asset: row.asset, quote: quote, failed: quote == nil)
    }
    return result.usingChartMode(in: store)
  }

  static func homeTimeline(_ base: MarketWidgetEntry, store: MarketWidgetStore) -> Timeline<MarketWidgetEntry> {
    let quotes = MarketWidgetTimelineQuotes(base: base, store: store)
    var dates = quotes.appQuoteExpiryDates
    dates.insert(base.date)
    for row in quotes.detailRows + quotes.entry(at: base.date).rows {
      if let expiry = row.quote?.fetchedAt.addingTimeInterval(MarketWidgetRow.lockScreenFreshnessInterval), expiry > base.date {
        dates.insert(expiry)
      }
    }
    let retryInterval: TimeInterval = base.rows.contains { $0.failed || $0.quote == nil } ? 60 : 15 * 60
    return Timeline(entries: dates.sorted().map { quotes.entry(at: $0, preservingRefreshFailure: true) },
      policy: .after(base.date.addingTimeInterval(retryInterval)))
  }

  static func timeline(isWatchlist: Bool, selected _: [MarketWidgetAsset]? = nil,
                       source _: MarketWidgetSource = .watchlist, profileID _: String? = nil, instanceID: UUID? = nil,
                       store: MarketWidgetStore = MarketWidgetStore(),
                       service: MarketWidgetService = .shared) async -> Timeline<MarketWidgetEntry> {
    return await MarketWidgetDiagnostics.$refreshID.withValue(UUID().uuidString) {
      let started = Date()
      MarketWidgetDiagnostics.event("timeline.started", ["surface": "home", "kind": isWatchlist ? "list" : "single"])
      defer { MarketWidgetDiagnostics.event("timeline.completed", ["durationMs": Int(Date().timeIntervalSince(started) * 1000)]) }
      let kind: MarketWidgetKind = isWatchlist ? .list : .single
      let initial = store.selection(kind: kind, instanceID: instanceID)
      // Single-coin settings are fixed, including the initial BTC default.
      if isWatchlist, initial.profile?.assets == nil, initial.source == .hot, initial.configuration.map({ $0.privacyMasked != true }) == true {
        _ = try? await service.trending(locale: initial.configuration?.locale ?? "en-US")
      }
      let selection = store.selection(kind: kind, instanceID: instanceID)
      let snapshot = entry(selection: selection, isWatchlist: isWatchlist, store: store)
      let rows = await withTaskGroup(of: (Int, MarketWidgetRow).self) { group in
        for (index, row) in snapshot.rows.enumerated() {
          group.addTask {
            do {
              let quote = try await service.quote(
                for: row.asset, locale: snapshot.configuration?.locale ?? "en-US", includingChart: isWatchlist, force: true)
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
      let current = store.selection(kind: kind, instanceID: instanceID)
      var base = snapshot
      if current == selection {
        base.date = Date()
        base.rows = rows
      } else {
        base = entry(selection: current, isWatchlist: isWatchlist, store: store)
      }
      return homeTimeline(base, store: store)
    }
  }
}

struct MarketWidgetProvider: TimelineProvider {
  let isWatchlist: Bool
  func placeholder(in context: Context) -> MarketWidgetEntry { .preview(isWatchlist: isWatchlist) }
  func getSnapshot(in context: Context, completion: @escaping (MarketWidgetEntry) -> Void) {
    if context.isPreview {
      completion(.preview(isWatchlist: isWatchlist))
    } else {
      Task { completion(await .loadedSnapshot(isWatchlist: isWatchlist)) }
    }
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<MarketWidgetEntry>) -> Void) {
    Task { completion(await MarketWidgetEntry.timeline(isWatchlist: isWatchlist)) }
  }
}
