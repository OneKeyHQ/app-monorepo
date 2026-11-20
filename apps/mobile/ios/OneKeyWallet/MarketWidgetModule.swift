import Foundation
import React
import WidgetKit

@objc(OneKeyMarketWidget)
final class MarketWidgetModule: NSObject {
  private let editorLock = NSLock()
  private var editorDrafts: [String: [MarketWidgetAsset]] = [:]

  private func draft(for token: String) throws -> [MarketWidgetAsset] {
    try editorLock.withLock {
      guard let draft = editorDrafts[token] else { throw MarketWidgetError.invalidProfile }
      return draft
    }
  }

  private func editorState(for token: String) throws -> MarketWidgetEditorState {
    var state = try MarketWidgetStore().editorState()
    if state.privacyMasked { return state }
    var seen = Set<String>()
    state.searchAssets = (try draft(for: token) + (state.searchAssets ?? [])).filter { seen.insert($0.id).inserted }
    return state
  }

  @objc(beginWidgetEditing:rejecter:)
  func beginWidgetEditing(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    do {
      let token = try editorLock.withLock {
        guard editorDrafts.count < 8 else { throw MarketWidgetError.profileLimitReached }
        let token = UUID().uuidString.lowercased()
        editorDrafts[token] = []
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
        guard let previous = editorDrafts[token] else { throw MarketWidgetError.invalidProfile }
        editorDrafts[token] = try MarketWidgetStore().editorDraft(json: json, previous: previous)
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
    let started = ProcessInfo.processInfo.systemUptime
    MarketWidgetDiagnostics.event("editor.search_started")
    Task {
      do {
        _ = try draft(for: token)
        let configuration = MarketWidgetStore().configuration().configuration
        let assets = try await MarketWidgetService.shared.search(query: query, locale: configuration?.locale ?? "en-US", stocksOnly: true)
        MarketWidgetDiagnostics.event("editor.search_succeeded", ["resultCount": assets.count,
          "durationMs": Int((ProcessInfo.processInfo.systemUptime - started) * 1000)])
        resolve(String(decoding: try JSONEncoder().encode(editorState(for: token)), as: UTF8.self))
      } catch {
        MarketWidgetDiagnostics.event("editor.search_failed", error: error)
        reject("MARKET_WIDGET_SEARCH_FAILED", "Unable to search stocks.", error)
      }
    }
  }

  @objc(refreshWidgetEditorState:resolver:rejecter:)
  func refreshWidgetEditorState(_ token: String, resolver resolve: @escaping RCTPromiseResolveBlock,
                                rejecter reject: @escaping RCTPromiseRejectBlock) {
    Task {
      do {
        _ = try draft(for: token)
        await MarketWidgetService.shared.refreshEditorMetadata()
        resolve(String(decoding: try JSONEncoder().encode(editorState(for: token)), as: UTF8.self))
      } catch { reject("MARKET_WIDGET_EDITOR_FAILED", "Unable to refresh editor.", error) }
    }
  }

  @objc(saveWidgetSettings:settings:resolver:rejecter:)
  func saveWidgetSettings(_ token: String, settings json: String, resolver resolve: RCTPromiseResolveBlock,
                          rejecter reject: RCTPromiseRejectBlock) {
    do {
      let saved = try MarketWidgetStore().saveSettings(json: json, draftAssets: draft(for: token))
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
    _ = editorLock.withLock { editorDrafts.removeValue(forKey: token) }
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
      let changed = try MarketWidgetStore().syncQuote(json: json)
      if changed {
        for kind in ["OneKeyMarketSingle", "OneKeyMarketWatchlist", "OneKeyMarketLockScreenWatchlist",
                     "OneKeyMarketLockScreenCompact", "OneKeyMarketLockScreenPrice", "OneKeyMarketLockScreenChart"] {
          WidgetCenter.shared.reloadTimelines(ofKind: kind)
        }
      }
      MarketWidgetDiagnostics.event("quote.app_synced", ["changed": changed, "reloadRequested": changed])
      resolve(changed)
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

  @objc(setConfiguration:resolver:rejecter:)
  func setConfiguration(_ json: String, resolver resolve: RCTPromiseResolveBlock,
                        rejecter reject: RCTPromiseRejectBlock) {
    do {
      let changed = try MarketWidgetStore().saveConfiguration(json: json)
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
