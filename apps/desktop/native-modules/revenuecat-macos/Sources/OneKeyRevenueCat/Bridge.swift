import Foundation
import PurchasesHybridCommon
import RevenueCat

private var configuredAPIKey: String?

private struct BridgeError: Error {
    let message: String
}

private func requiredString(_ params: [String: Any], _ key: String) throws -> String {
    guard let value = params[key] as? String, !value.isEmpty else {
        throw BridgeError(message: "Missing or invalid \(key)")
    }
    return value
}

// The callback copies its string synchronously; no Swift allocation crosses the C ABI.
public typealias RevenueCatCallback = @convention(c) (UnsafeMutableRawPointer?, UnsafePointer<CChar>) -> Void

@_cdecl("onekey_revenuecat_invoke")
public func invoke(
    _ request: UnsafePointer<CChar>,
    _ context: UnsafeMutableRawPointer?,
    _ callback: @escaping RevenueCatCallback
) {
    let requestData = Data(String(cString: request).utf8)
    let reply: (Any?, [String: Any]?) -> Void = { result, error in
        let envelope: [String: Any] = error.map { ["error": $0] } ?? ["result": result ?? NSNull()]
        let encoded: String
        if let data = try? JSONSerialization.data(withJSONObject: envelope),
           let json = String(data: data, encoding: .utf8) {
            encoded = json
        } else {
            encoded = "{\"error\":{\"code\":\"SERIALIZATION_ERROR\",\"message\":\"Could not encode RevenueCat response\"}}"
        }
        encoded.withCString { callback(context, $0) }
    }
    let completion: ([String: Any]?, ErrorContainer?) -> Void = { result, error in
        if let error {
            var info = error.info
            // React Native exposes error codes as strings.
            info["code"] = String(error.code)
            info["userCancelled"] = (error.info["userCancelled"] as? Bool) ?? (error.code == 1)
            reply(nil, info)
        } else {
            reply(result, nil)
        }
    }

    // Electron's main process owns this SDK singleton and the application's StoreKit identity.
    DispatchQueue.main.async {
        do {
            guard let decoded = try JSONSerialization.jsonObject(with: requestData) as? [String: Any],
                  let method = decoded["method"] as? String,
                  let params = decoded["params"] as? [String: Any] else {
                throw BridgeError(message: "Invalid RevenueCat request")
            }
            if method == "configure" {
                let apiKey = try requiredString(params, "apiKey")
                if let configuredAPIKey {
                    guard configuredAPIKey == apiKey else {
                        throw BridgeError(message: "RevenueCat is already configured with a different API key")
                    }
                } else {
                    Purchases.logLevel = .error
                    _ = Purchases.configure(
                        apiKey: apiKey,
                        appUserID: nil,
                        purchasesAreCompletedBy: "REVENUECAT",
                        userDefaultsSuiteName: nil,
                        platformFlavor: "electron",
                        platformFlavorVersion: "1.0.0",
                        dangerousSettings: nil,
                        verificationMode: nil,
                        diagnosticsEnabled: false,
                        automaticDeviceIdentifierCollectionEnabled: true,
                        preferredLocale: nil
                    )
                    configuredAPIKey = apiKey
                }
                reply(nil, nil)
                return
            }
            guard configuredAPIKey != nil else {
                throw BridgeError(message: "RevenueCat must be configured before use")
            }
            switch method {
            case "logIn":
                CommonFunctionality.logIn(appUserID: try requiredString(params, "appUserId"), completion: completion)
            case "logOut":
                CommonFunctionality.logOut(completion: completion)
            case "getAppUserId":
                reply(CommonFunctionality.appUserID, nil)
            case "getCustomerInfo":
                CommonFunctionality.customerInfo(completion: completion)
            case "getOfferings":
                CommonFunctionality.getOfferings(completion: completion)
            case "purchasePackage":
                CommonFunctionality.purchase(
                    package: try requiredString(params, "packageIdentifier"),
                    presentedOfferingContext: ["offeringIdentifier": try requiredString(params, "offeringIdentifier")],
                    signedDiscountTimestamp: nil,
                    completion: completion
                )
            case "restorePurchases":
                CommonFunctionality.restorePurchases(completion: completion)
            case "checkTrialOrIntroductoryPriceEligibility":
                guard let identifiers = params["productIdentifiers"] as? [String],
                      identifiers.allSatisfy({ !$0.isEmpty }) else {
                    throw BridgeError(message: "Invalid productIdentifiers")
                }
                CommonFunctionality.checkTrialOrIntroductoryPriceEligibility(for: identifiers) { reply($0, nil) }
            case "setAttributes":
                guard let attributes = params["attributes"] as? [String: String] else {
                    throw BridgeError(message: "Invalid subscriber attributes")
                }
                CommonFunctionality.setAttributes(attributes)
                reply(nil, nil)
            case "setEmail":
                CommonFunctionality.setEmail(try requiredString(params, "email"))
                reply(nil, nil)
            default:
                throw BridgeError(message: "Unsupported RevenueCat operation")
            }
        } catch {
            reply(nil, [
                "code": "BRIDGE_ERROR",
                "message": (error as? BridgeError)?.message ?? "Invalid RevenueCat request",
                "userCancelled": false
            ])
        }
    }
}
