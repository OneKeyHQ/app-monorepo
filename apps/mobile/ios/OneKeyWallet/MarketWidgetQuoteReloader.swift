import AppIntents
import Foundation
import UIKit
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
  func installedInstancePreviews() async throws -> [MarketWidgetInstalledInstance] {
    guard configuration().configuration.map({ $0.privacyMasked != true }) == true else { return [] }
    let widgets = try await installedMarketWidgets()
    let bindings = widgets.compactMap { info -> MarketWidgetInstanceBinding? in
      let kind: MarketWidgetKind
      switch info.kind {
      case MarketWidgetKind.single.timelineKind: kind = .single
      case MarketWidgetKind.list.timelineKind: kind = .list
      default: return nil
      }
      guard let id = info.widgetConfigurationIntent(of: MarketWidgetInstanceIntent.self)?.instanceID else { return nil }
      return MarketWidgetInstanceBinding(id: id, kind: kind)
    }
    return try installedInstancePreviews(for: bindings) { kinds in
      for kind in kinds { WidgetCenter.shared.reloadTimelines(ofKind: kind.timelineKind) }
    }
  }

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

@MainActor
final class MarketWidgetQuoteReloader {
  static let shared = MarketWidgetQuoteReloader(reload: reloadInstalledWidgets)

  private nonisolated static func reloadInstalledWidgets(_ assetIDs: Set<String>) async throws {
    let configurations = try await installedMarketWidgets()
    let kinds = affectedKinds(for: assetIDs, configurations: configurations, store: MarketWidgetStore())
    for kind in kinds { WidgetCenter.shared.reloadTimelines(ofKind: kind) }
    MarketWidgetDiagnostics.event("quote.reload_batch", ["assetCount": assetIDs.count,
      "installedCount": configurations.count, "kinds": kinds.sorted().joined(separator: ",")])
  }

  private var pending: Set<String> = []
  private var retry: Set<String> = []
  private var delay: Task<Void, Never>?
  private var delivering = false
  private var backgroundTask = UIBackgroundTaskIdentifier.invalid
  private let reload: (Set<String>) async throws -> Void

  init(reload: @escaping (Set<String>) async throws -> Void) { self.reload = reload }

  func enqueue(_ assetID: String, inBackground: Bool = false) {
    pending.insert(assetID)
    if inBackground { flushForBackground() } else { schedule() }
  }

  private func schedule() {
    guard delay == nil, !delivering, !pending.isEmpty || !retry.isEmpty else { return }
    delay = Task {
      do { try await Task.sleep(nanoseconds: 2_000_000_000) } catch { return }
      delay = nil
      deliver()
    }
  }

  func flushForBackground() {
    guard delivering || !pending.isEmpty || !retry.isEmpty else { return }
    delay?.cancel()
    delay = nil
    if backgroundTask == .invalid {
      backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "MarketWidgetQuoteReload") {
        self.endBackgroundTask()
      }
    }
    deliver()
  }

  private func endBackgroundTask() {
    guard backgroundTask != .invalid else { return }
    UIApplication.shared.endBackgroundTask(backgroundTask)
    backgroundTask = .invalid
  }

  private func deliver() {
    guard !delivering else { return }
    delivering = true
    let fresh = pending
    let batch = fresh.union(retry)
    pending.removeAll()
    retry.removeAll()
    Task {
      do {
        try await reload(batch)
      } catch {
        MarketWidgetDiagnostics.event("quote.configurations_failed", error: error)
        retry = fresh
      }
      delivering = false
      if backgroundTask != .invalid && (!pending.isEmpty || !retry.isEmpty) {
        deliver()
      } else {
        endBackgroundTask()
        schedule()
      }
    }
  }

  nonisolated static func affectedKinds<C: MarketWidgetQuoteConfiguration>(for assetIDs: Set<String>,
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
