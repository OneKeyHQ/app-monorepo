import Foundation
import React
import WidgetKit

@objc(OneKeyMarketWidget)
final class MarketWidgetModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }
  @objc func constantsToExport() -> [String: Any] { ["stockSupportVersion": 1] }

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
    Task {
      do {
        let store = MarketWidgetStore()
        let state = try store.editorState()
        MarketWidgetDiagnostics.event("editor.read_succeeded")
        resolve(String(decoding: try JSONEncoder().encode(state), as: UTF8.self))
      } catch {
        MarketWidgetDiagnostics.event("editor.read_failed", error: error)
        reject("MARKET_WIDGET_EDITOR_FAILED", "Unable to load widget configurations.", error)
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
