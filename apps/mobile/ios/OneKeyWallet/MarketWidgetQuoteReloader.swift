import AppIntents
import Foundation
import WidgetKit

protocol MarketWidgetQuoteConfiguration {
  var kind: String { get }
  @available(iOS 17.0, *)
  func widgetConfigurationIntent<T: WidgetConfigurationIntent>(of type: T.Type) -> T?
}

extension WidgetInfo: MarketWidgetQuoteConfiguration {}

private func installedMarketWidgets() async throws -> [WidgetInfo] {
  try await withCheckedThrowingContinuation { continuation in
    WidgetCenter.shared.getCurrentConfigurations { continuation.resume(with: $0) }
  }
}

extension MarketWidgetStore {
  @available(iOS 17.0, *)
  func reconcileInstalledInstances() async throws {
    let snapshot = try storedInstanceSettings()
    guard !snapshot.isEmpty else { return }
    let widgets = try await installedMarketWidgets()
    var installed = Set<String>()
    for widget in widgets where widget.kind == MarketWidgetKind.list.timelineKind || widget.kind == MarketWidgetKind.single.timelineKind {
      // An unreadable intent makes this snapshot unsuitable for deleting user settings.
      guard let intent = widget.widgetConfigurationIntent(of: MarketWidgetInstanceIntent.self) else { return }
      if let id = intent.instanceID { installed.insert(id.uuidString.lowercased()) }
    }
    try reconcileInstanceSettings(snapshot: snapshot, installed: installed)
  }
}

actor MarketWidgetQuoteReloader {
  static let shared = MarketWidgetQuoteReloader { assetIDs in
    let configurations = try await installedMarketWidgets()
    let kinds = affectedKinds(for: assetIDs, configurations: configurations, store: MarketWidgetStore())
    for kind in kinds { WidgetCenter.shared.reloadTimelines(ofKind: kind) }
    MarketWidgetDiagnostics.event("quote.reload_batch", ["assetCount": assetIDs.count,
      "installedCount": configurations.count, "kinds": kinds.sorted().joined(separator: ",")])
  }

  private var pending: Set<String> = []
  private var scheduled = false
  private let reload: (Set<String>) async throws -> Void

  init(reload: @escaping (Set<String>) async throws -> Void) { self.reload = reload }

  func enqueue(_ assetID: String) {
    pending.insert(assetID)
    guard !scheduled else { return }
    scheduled = true
    Task {
      // A fixed window still delivers updates when quotes arrive continuously.
      var retry = Set<String>()
      while !pending.isEmpty || !retry.isEmpty {
        try? await Task.sleep(nanoseconds: 2_000_000_000)
        let batch = pending
        pending.removeAll()
        do {
          try await reload(batch.union(retry))
          retry.removeAll()
        } catch {
          MarketWidgetDiagnostics.event("quote.configurations_failed", error: error)
          // Only fresh observations get another attempt, including arrivals during the lookup.
          retry = batch
        }
      }
      scheduled = false
    }
  }

  static func affectedKinds<C: MarketWidgetQuoteConfiguration>(for assetIDs: Set<String>,
    configurations: [C], store: MarketWidgetStore) -> Set<String> {
    guard let configuration = store.configuration().configuration, configuration.privacyMasked != true else { return [] }
    var kinds = Set<String>()
    for info in configurations where !kinds.contains(info.kind) {
      let assets: [MarketWidgetAsset]
      switch info.kind {
      case MarketWidgetKind.single.timelineKind, MarketWidgetKind.list.timelineKind:
        var instanceID: UUID?
        if #available(iOS 17.0, *) {
          let intent = info.widgetConfigurationIntent(of: MarketWidgetInstanceIntent.self)
          instanceID = intent?.instanceID
        }
        let kind: MarketWidgetKind = info.kind == MarketWidgetKind.single.timelineKind ? .single : .list
        assets = store.selection(kind: kind, instanceID: instanceID).assets
      case "OneKeyMarketLockScreenWatchlist":
        guard #available(iOS 17.0, *) else { continue }
        assets = info.widgetConfigurationIntent(of: MarketLockScreenListIntent.self)?.assets ?? []
      case "OneKeyMarketLockScreenCompact", "OneKeyMarketLockScreenPrice", "OneKeyMarketLockScreenChart":
        guard #available(iOS 17.0, *),
              let coin = info.widgetConfigurationIntent(of: MarketLockScreenSpotIntent.self)?.coin else { continue }
        assets = [coin.asset]
      default:
        continue
      }
      if assets.contains(where: { assetIDs.contains($0.id) }) { kinds.insert(info.kind) }
    }
    return kinds
  }
}
