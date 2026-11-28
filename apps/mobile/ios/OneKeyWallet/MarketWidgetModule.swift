import Foundation
import React
import UIKit
import WidgetKit

@objc(OneKeyMarketWidget)
final class MarketWidgetModule: NSObject {
  private struct EditorSession {
    let instance: MarketWidgetInstanceBinding?
    var draft: [MarketWidgetAsset] = []
    var search = MarketWidgetEditorSearch()
  }

  private let editorLock = NSLock()
  private var editorSessions: [String: EditorSession] = [:]

  private func session(for token: String) throws -> EditorSession {
    try editorLock.withLock {
      guard let session = editorSessions[token] else { throw MarketWidgetError.invalidProfile }
      return session
    }
  }

  private func editorState(for token: String) throws -> MarketWidgetEditorState {
    let session = try session(for: token)
    var state = try MarketWidgetStore().editorState(instance: session.instance)
    if state.privacyMasked { return state }
    var seen = Set<String>()
    state.searchAssets = (session.draft + (state.searchAssets ?? [])).filter { seen.insert($0.id).inserted }
    return state
  }

  @objc(beginWidgetEditing:rejecter:)
  func beginWidgetEditing(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    beginEditing(instance: nil, resolve: resolve, reject: reject)
  }

  @objc(getInstalledWidgetInstances:rejecter:)
  func getInstalledWidgetInstances(_ resolve: @escaping RCTPromiseResolveBlock,
                                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard #available(iOS 17.0, *) else { resolve("[]"); return }
    Task {
      do {
        let instances = try await MarketWidgetStore().installedInstancePreviews()
        resolve(String(decoding: try JSONEncoder().encode(instances), as: UTF8.self))
      } catch {
        reject("MARKET_WIDGET_EDITOR_FAILED", "Unable to list installed market widgets.", error)
      }
    }
  }

  @objc(beginWidgetInstanceEditing:kind:resolver:rejecter:)
  func beginWidgetInstanceEditing(_ id: String, kind: String, resolver resolve: RCTPromiseResolveBlock,
                                  rejecter reject: RCTPromiseRejectBlock) {
    guard let id = UUID(uuidString: id), let kind = MarketWidgetKind(rawValue: kind) else {
      reject("MARKET_WIDGET_EDITOR_FAILED", "Invalid widget configuration.", MarketWidgetError.invalidProfile)
      return
    }
    beginEditing(instance: MarketWidgetInstanceBinding(id: id, kind: kind), resolve: resolve, reject: reject)
  }

  private func beginEditing(instance: MarketWidgetInstanceBinding?, resolve: RCTPromiseResolveBlock,
                            reject: RCTPromiseRejectBlock) {
    do {
      let token = try editorLock.withLock {
        guard editorSessions.count < 8 else { throw MarketWidgetError.profileLimitReached }
        let token = UUID().uuidString.lowercased()
        editorSessions[token] = EditorSession(instance: instance)
        return token
      }
      MarketWidgetDiagnostics.event("editor.session_created")
      resolve(token)
    } catch {
      MarketWidgetDiagnostics.event("editor.session_failed", error: error)
      reject("MARKET_WIDGET_EDITOR_FAILED", "Unable to open editor.", error)
    }
  }

  @objc(getWidgetEditorState:resolver:rejecter:)
  func getWidgetEditorState(_ token: String, resolver resolve: @escaping RCTPromiseResolveBlock,
                            rejecter reject: @escaping RCTPromiseRejectBlock) {
    let requested = ProcessInfo.processInfo.systemUptime
    MarketWidgetDiagnostics.event("editor.read_started")
    Task {
      do {
        let started = ProcessInfo.processInfo.systemUptime
        let state = try editorState(for: token)
        let read = ProcessInfo.processInfo.systemUptime
        let json = String(decoding: try JSONEncoder().encode(state), as: UTF8.self)
        let finished = ProcessInfo.processInfo.systemUptime
        MarketWidgetDiagnostics.event("editor.read_succeeded", ["durationMs": Int((finished - requested) * 1000),
          "queueMs": Int((started - requested) * 1000), "readMs": Int((read - started) * 1000),
          "encodeMs": Int((finished - read) * 1000)])
        resolve(json)
      } catch {
        MarketWidgetDiagnostics.event("editor.read_failed", error: error)
        reject("MARKET_WIDGET_EDITOR_FAILED", "Unable to read editor.", error)
      }
    }
  }

  @objc(setWidgetEditorDraft:assets:resolver:rejecter:)
  func setWidgetEditorDraft(_ token: String, assets json: String, resolver resolve: RCTPromiseResolveBlock,
                            rejecter reject: RCTPromiseRejectBlock) {
    do {
      try editorLock.withLock {
        guard var session = editorSessions[token] else { throw MarketWidgetError.invalidProfile }
        session.draft = try MarketWidgetStore().editorDraft(json: json, previous: session.draft,
          searchCandidates: session.search.selectable, instance: session.instance)
        editorSessions[token] = session
      }
      MarketWidgetDiagnostics.event("editor.draft_retained")
      resolve(String(decoding: try JSONEncoder().encode(editorState(for: token)), as: UTF8.self))
    } catch {
      MarketWidgetDiagnostics.event("editor.draft_failed", error: error)
      reject("MARKET_WIDGET_EDITOR_FAILED", "Unable to retain selection.", error)
    }
  }

  @objc(searchWidgetStocks:query:resolver:rejecter:)
  func searchWidgetStocks(_ token: String, query: String, resolver resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    searchWidgetCandidates(token, query: query, stocksOnly: true, resolver: resolve, rejecter: reject)
  }

  @objc(searchWidgetAssets:query:resolver:rejecter:)
  func searchWidgetAssets(_ token: String, query: String, resolver resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    searchWidgetCandidates(token, query: query, stocksOnly: false, resolver: resolve, rejecter: reject)
  }

  private func searchWidgetCandidates(_ token: String, query: String, stocksOnly: Bool,
                                      resolver resolve: @escaping RCTPromiseResolveBlock,
                                      rejecter reject: @escaping RCTPromiseRejectBlock) {
    let started = ProcessInfo.processInfo.systemUptime
    MarketWidgetDiagnostics.event("editor.search_started")
    let queryKey = (stocksOnly ? "stocks|" : "") + query.trimmingCharacters(in: .whitespacesAndNewlines)
    let requestID = editorLock.withLock { () -> UUID? in
      guard var session = editorSessions[token] else { return nil }
      let requestID = session.search.begin(query: queryKey)
      editorSessions[token] = session
      return requestID
    }
    guard let requestID else {
      reject("MARKET_WIDGET_SEARCH_FAILED", "Unable to search widget assets.", MarketWidgetError.invalidProfile)
      return
    }
    Task {
      do {
        let configuration = MarketWidgetStore().configuration().configuration
        let result = try await MarketWidgetService.shared.searchCatalog(query: query,
          locale: configuration?.locale ?? "en-US", stocksOnly: stocksOnly)
        var state = try editorState(for: token)
        try editorLock.withLock {
          guard var session = editorSessions[token] else { throw CancellationError() }
          try session.search.publish(result.assets, for: requestID, masked: state.privacyMasked)
          editorSessions[token] = session
        }
        if !state.privacyMasked {
          if stocksOnly {
            var seen = Set<String>()
            state.searchAssets = (result.assets + (state.searchAssets ?? [])).filter { seen.insert($0.id).inserted }
          } else {
            state.searchResults = result.assets
            state.searchIncomplete = !result.isComplete
          }
        }
        MarketWidgetDiagnostics.event("editor.search_succeeded", ["resultCount": result.assets.count,
          "durationMs": Int((ProcessInfo.processInfo.systemUptime - started) * 1000)])
        resolve(String(decoding: try JSONEncoder().encode(state), as: UTF8.self))
      } catch {
        MarketWidgetDiagnostics.event("editor.search_failed", error: error)
        reject("MARKET_WIDGET_SEARCH_FAILED", "Unable to search widget assets.", error)
      }
    }
  }

  @objc(refreshWidgetEditorState:resolver:rejecter:)
  func refreshWidgetEditorState(_ token: String, resolver resolve: @escaping RCTPromiseResolveBlock,
                                rejecter reject: @escaping RCTPromiseRejectBlock) {
    Task {
      do {
        _ = try session(for: token)
        await MarketWidgetService.shared.refreshEditorMetadata()
        resolve(String(decoding: try JSONEncoder().encode(editorState(for: token)), as: UTF8.self))
      } catch { reject("MARKET_WIDGET_EDITOR_FAILED", "Unable to refresh editor.", error) }
    }
  }

  @objc(saveWidgetSettings:settings:resolver:rejecter:)
  func saveWidgetSettings(_ token: String, settings json: String, resolver resolve: RCTPromiseResolveBlock,
                          rejecter reject: RCTPromiseRejectBlock) {
    do {
      let session = try session(for: token)
      let saved = try MarketWidgetStore().saveSettings(json: json, draftAssets: session.draft, instance: session.instance)
      WidgetCenter.shared.reloadTimelines(ofKind: saved.kind.timelineKind)
      MarketWidgetDiagnostics.event("editor.settings_saved", ["kind": saved.kind.rawValue, "reloadRequested": true])
      resolve(String(decoding: try JSONEncoder().encode(saved), as: UTF8.self))
    } catch {
      MarketWidgetDiagnostics.event("editor.save_failed", error: error)
      reject("MARKET_WIDGET_SETTINGS_FAILED", "Unable to save settings.", error)
    }
  }

  @objc(finishWidgetEditing:saved:resolver:rejecter:)
  func finishWidgetEditing(_ token: String, saved: Bool, resolver resolve: RCTPromiseResolveBlock,
                           rejecter reject: RCTPromiseRejectBlock) {
    _ = editorLock.withLock { editorSessions.removeValue(forKey: token) }
    MarketWidgetDiagnostics.event("editor.session_finished", ["saved": saved])
    resolve(nil)
  }
  @objc static func requiresMainQueueSetup() -> Bool { false }
  @objc(maskForTravelMode:rejecter:)
  func maskForTravelMode(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    do {
      let store = MarketWidgetStore()
      let current = store.configuration().configuration ?? .initial
      let configuration = MarketWidgetConfiguration(schemaVersion: 1, assets: [],
        greenUp: current.greenUp, locale: current.locale, privacyMasked: true)
      _ = try store.saveConfiguration(json: String(decoding: try JSONEncoder().encode(configuration), as: UTF8.self))
      WidgetCenter.shared.reloadAllTimelines()
      MarketWidgetDiagnostics.event("privacy.masked")
      resolve(nil)
    } catch {
      MarketWidgetDiagnostics.event("privacy.mask_failed", error: error)
      reject("MARKET_WIDGET_PRIVACY_FAILED", "Unable to mask widgets.", error)
    }
  }
  @objc func constantsToExport() -> [String: Any] { ["stockSupportVersion": 1] }

  @objc(syncQuote:resolver:rejecter:)
  func syncQuote(_ json: String, resolver resolve: RCTPromiseResolveBlock,
                 rejecter reject: RCTPromiseRejectBlock) {
    do {
      let assetID = try MarketWidgetStore().syncQuote(json: json)
      if let assetID {
        Task { @MainActor in
          MarketWidgetQuoteReloader.shared.enqueue(assetID, inBackground: UIApplication.shared.applicationState != .active)
        }
      }
      MarketWidgetDiagnostics.event("quote.app_synced", ["changed": assetID != nil])
      resolve(assetID != nil)
    } catch {
      MarketWidgetDiagnostics.event("quote.app_sync_failed", error: error)
      reject("MARKET_WIDGET_QUOTE_FAILED", "Unable to sync widget quote.", error)
    }
  }

  @objc(exportDiagnostics:rejecter:)
  func exportDiagnostics(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    do { try MarketWidgetDiagnostics.exportToAppLogs(); resolve(nil) }
    catch { reject("MARKET_WIDGET_LOG_EXPORT_FAILED", "Unable to export widget diagnostics.", error) }
  }

  @objc(setChartMode:resolver:rejecter:)
  func setChartMode(_ value: String, resolver resolve: RCTPromiseResolveBlock,
                    rejecter reject: RCTPromiseRejectBlock) {
    do {
      guard let mode = MarketWidgetChartMode(rawValue: value) else { throw MarketWidgetError.invalidConfiguration }
      if try MarketWidgetStore().setChartMode(mode) { WidgetCenter.shared.reloadAllTimelines() }
      resolve(nil)
    } catch {
      reject("MARKET_WIDGET_CHART_MODE_FAILED", "Unable to sync chart mode.", error)
    }
  }

  @objc(setConfiguration:resolver:rejecter:)
  func setConfiguration(_ json: String, resolver resolve: RCTPromiseResolveBlock,
                        rejecter reject: RCTPromiseRejectBlock) {
    do {
      let store = MarketWidgetStore()
      let changed = try store.saveConfiguration(json: json)
      // Configuration sync also runs on foreground when its contents have not changed.
      Task {
        do {
          if #available(iOS 17.0, *) {
            do { try await store.reconcileInstalledInstances() }
            catch { MarketWidgetDiagnostics.event("instance.reconciliation_failed", error: error) }
          }
          let widgets = try await installedMarketWidgets()
          let assets = MarketWidgetQuoteReloader.assetsForForegroundRefresh(configurations: widgets, store: store)
          guard !assets.isEmpty, let configuration = store.configuration().configuration,
                configuration.privacyMasked != true else { return }
          await MarketWidgetService.shared.refreshPrices(assets: assets, locale: configuration.locale)
          // Cached prices must be committed before WidgetKit asks any size for a new timeline.
          for kind in Set(widgets.map(\.kind)).filter({ $0.hasPrefix("OneKeyMarket") }) {
            WidgetCenter.shared.reloadTimelines(ofKind: kind)
          }
        } catch { MarketWidgetDiagnostics.event("quote.foreground_failed", error: error) }
      }
      MarketWidgetDiagnostics.event("configuration.synced", ["changed": changed])
      if changed {
        WidgetCenter.shared.reloadTimelines(ofKind: "OneKeyMarketSingle")
        WidgetCenter.shared.reloadTimelines(ofKind: "OneKeyMarketWatchlist")
        for kind in ["OneKeyMarketLockScreenWatchlist", "OneKeyMarketLockScreenCompact",
                     "OneKeyMarketLockScreenPrice", "OneKeyMarketLockScreenChart"] {
          WidgetCenter.shared.reloadTimelines(ofKind: kind)
        }
      }
      resolve(nil)
    } catch {
      MarketWidgetDiagnostics.event("configuration.failed", error: error)
      reject("MARKET_WIDGET_CONFIGURATION_FAILED", "Unable to sync market widgets.", error)
    }
  }

  @objc(getEditorState:rejecter:)
  func getEditorState(_ resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
    let requested = ProcessInfo.processInfo.systemUptime
    MarketWidgetDiagnostics.event("editor.read_started")
    Task {
      do {
        let started = ProcessInfo.processInfo.systemUptime
        let store = MarketWidgetStore()
        let state = try store.editorState()
        let read = ProcessInfo.processInfo.systemUptime
        let json = String(decoding: try JSONEncoder().encode(state), as: UTF8.self)
        let finished = ProcessInfo.processInfo.systemUptime
        MarketWidgetDiagnostics.event("editor.read_succeeded", ["durationMs": Int((finished - requested) * 1000),
          "queueMs": Int((started - requested) * 1000), "readMs": Int((read - started) * 1000),
          "encodeMs": Int((finished - read) * 1000)])
        resolve(json)
      } catch {
        MarketWidgetDiagnostics.event("editor.read_failed", error: error)
        reject("MARKET_WIDGET_EDITOR_FAILED", "Unable to load widget configurations.", error)
      }
    }
  }

  @objc(searchStocks:resolver:rejecter:)
  func searchStocks(_ query: String, resolver resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
    let started = ProcessInfo.processInfo.systemUptime
    MarketWidgetDiagnostics.event("editor.search_started")
    Task {
      do {
        let store = MarketWidgetStore()
        guard let configuration = store.configuration().configuration, configuration.privacyMasked != true else {
          throw MarketWidgetError.privacyMasked
        }
        let assets = try await MarketWidgetService.shared.search(query: query, locale: configuration.locale, stocksOnly: true)
        let state = try store.editorState()
        MarketWidgetDiagnostics.event("editor.search_succeeded", ["resultCount": assets.count,
          "durationMs": Int((ProcessInfo.processInfo.systemUptime - started) * 1000)])
        resolve(String(decoding: try JSONEncoder().encode(state), as: UTF8.self))
      } catch {
        MarketWidgetDiagnostics.event("editor.search_failed", error: error)
        reject("MARKET_WIDGET_SEARCH_FAILED", "Unable to search stocks.", error)
      }
    }
  }

  @objc(refreshEditorState:rejecter:)
  func refreshEditorState(_ resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    Task {
      do {
        await MarketWidgetService.shared.refreshEditorMetadata()
        let state = try MarketWidgetStore().editorState()
        MarketWidgetDiagnostics.event("editor.metadata_succeeded")
        resolve(String(decoding: try JSONEncoder().encode(state), as: UTF8.self))
      } catch {
        MarketWidgetDiagnostics.event("editor.read_failed", error: error)
        reject("MARKET_WIDGET_EDITOR_FAILED", "Unable to refresh widget settings.", error)
      }
    }
  }

  @objc(saveProfile:resolver:rejecter:)
  func saveProfile(_ json: String, resolver resolve: RCTPromiseResolveBlock,
                   rejecter reject: RCTPromiseRejectBlock) {
    do {
      let profile = try MarketWidgetStore().saveProfile(json: json)
      MarketWidgetDiagnostics.event("saveProfile.succeeded")
      WidgetCenter.shared.reloadTimelines(ofKind: profile.kind.timelineKind)
      resolve(String(decoding: try JSONEncoder().encode(profile), as: UTF8.self))
    } catch {
      let code: String
      switch error {
      case MarketWidgetError.privacyMasked: code = "MARKET_WIDGET_PRIVACY_MASKED"
      case MarketWidgetError.profileNotFound: code = "MARKET_WIDGET_PROFILE_NOT_FOUND"
      case MarketWidgetError.profileLimitReached: code = "MARKET_WIDGET_PROFILE_LIMIT"
      default: code = "MARKET_WIDGET_PROFILE_FAILED"
      }
      MarketWidgetDiagnostics.event("profile.save_failed", error: error)
      reject(code, "Unable to save widget configuration.", error)
    }
  }

  @objc(saveSettings:resolver:rejecter:)
  func saveSettings(_ json: String, resolver resolve: RCTPromiseResolveBlock,
                    rejecter reject: RCTPromiseRejectBlock) {
    do {
      let settings = try MarketWidgetStore().saveSettings(json: json)
      MarketWidgetDiagnostics.event("settings.persisted", ["kind": settings.kind.rawValue, "source": settings.source.rawValue,
        "slotCount": settings.assets?.count ?? (settings.asset == nil ? 0 : 1)])
      WidgetCenter.shared.reloadTimelines(ofKind: settings.kind.timelineKind)
      MarketWidgetDiagnostics.event("timeline.reload_requested", ["kind": settings.kind.rawValue])
      resolve(String(decoding: try JSONEncoder().encode(settings), as: UTF8.self))
    } catch {
      MarketWidgetDiagnostics.event("settings.failed", error: error)
      reject("MARKET_WIDGET_SETTINGS_FAILED", "Unable to save widget settings.", error)
    }
  }

}
