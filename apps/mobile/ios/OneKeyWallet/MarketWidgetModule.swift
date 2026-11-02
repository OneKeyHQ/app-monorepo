import Foundation
import React
import WidgetKit

@objc(OneKeyMarketWidget)
final class MarketWidgetModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }
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
