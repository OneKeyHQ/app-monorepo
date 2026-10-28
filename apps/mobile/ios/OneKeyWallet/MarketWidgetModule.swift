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
      }
      resolve(nil)
    } catch {
      reject("MARKET_WIDGET_CONFIGURATION_FAILED", "Unable to sync market widgets.", error)
    }
  }
}
