import Foundation
import React
import WidgetKit

@objc(OneKeyMarketWidget)
final class MarketWidgetModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc(setConfiguration:resolver:rejecter:)
  func setConfiguration(_ json: String, resolver resolve: RCTPromiseResolveBlock,
                        rejecter reject: RCTPromiseRejectBlock) {
    do {
      if try MarketWidgetStore().saveConfiguration(json: json) {
        WidgetCenter.shared.reloadTimelines(ofKind: "OneKeyMarketSingle")
        WidgetCenter.shared.reloadTimelines(ofKind: "OneKeyMarketWatchlist")
        for kind in ["OneKeyMarketLockScreenWatchlist", "OneKeyMarketLockScreenCompact",
                     "OneKeyMarketLockScreenPrice", "OneKeyMarketLockScreenChart"] {
          WidgetCenter.shared.reloadTimelines(ofKind: kind)
        }
      }
      resolve(nil)
    } catch {
      reject("MARKET_WIDGET_CONFIGURATION_FAILED", "Unable to sync market widgets.", error)
    }
  }

  @objc(getEditorState:rejecter:)
  func getEditorState(_ resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
    Task {
      do {
        let store = MarketWidgetStore()
        if let configuration = store.configuration().configuration, configuration.privacyMasked != true {
          _ = try? await MarketWidgetService.shared.trending(locale: configuration.locale)
        }
        await MarketWidgetService.prepareEditorMetadata(store: store)
        let state = try store.editorState()
        resolve(String(decoding: try JSONEncoder().encode(state), as: UTF8.self))
      } catch {
        reject("MARKET_WIDGET_EDITOR_FAILED", "Unable to load widget configurations.", error)
      }
    }
  }

  @objc(saveProfile:resolver:rejecter:)
  func saveProfile(_ json: String, resolver resolve: RCTPromiseResolveBlock,
                   rejecter reject: RCTPromiseRejectBlock) {
    do {
      let profile = try MarketWidgetStore().saveProfile(json: json)
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
      reject(code, "Unable to save widget configuration.", error)
    }
  }

}
