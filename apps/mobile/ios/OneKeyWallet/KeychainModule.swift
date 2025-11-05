//
//  KeychainModule.swift
//  OneKeyWallet
//
//  Created by OneKey on 2025-01-27.
//  React Native Bridge layer for Keychain operations
//

import Foundation
import Security
import React

@objc(KeychainModule)
class KeychainModule: NSObject {

  // MARK: - Constants

  // React Native Bridge Parameter Names
  fileprivate static let paramKey = "key"
  fileprivate static let paramValue = "value"
  fileprivate static let paramLabel = "label"
  fileprivate static let paramDescription = "description"

  // MARK: - Properties

  private let moduleCore = KeychainModuleCore()

  // MARK: - React Native Bridge

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  // MARK: - Set Item

  @objc
  func setItem(_ params: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let typedParams = SetItemParams(from: params) else {
      reject("keychain_set_error", "Invalid parameters: key and value are required", nil)
      return
    }

    do {
      try moduleCore.setItem(params: typedParams)
      resolve(true)
    } catch let error as KeychainModuleError {
      switch error {
      case .encodingFailed:
        reject("keychain_set_error", "Failed to encode value", nil)
      case .operationFailed(let status):
        let nsError = NSError(domain: NSOSStatusErrorDomain, code: Int(status), userInfo: nil)
        reject("keychain_set_error", "Failed to set keychain item: \(status)", nsError)
      default:
        reject("keychain_set_error", "Failed to set keychain item", error as NSError)
      }
    } catch {
      reject("keychain_set_error", "Failed to set keychain item", error as NSError)
    }
  }

  // MARK: - Get Item

  @objc
  func getItem(_ params: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let typedParams = GetItemParams(from: params) else {
      reject("keychain_get_error", "Invalid parameters: key is required", nil)
      return
    }

    do {
      if let result = try moduleCore.getItem(params: typedParams) {
        resolve(result.toDictionary())
      } else {
        resolve(NSNull())
      }
    } catch let error as KeychainModuleError {
      switch error {
      case .operationFailed(let status):
        let nsError = NSError(domain: NSOSStatusErrorDomain, code: Int(status), userInfo: nil)
        reject("keychain_get_error", "Failed to get keychain item: \(status)", nsError)
      default:
        reject("keychain_get_error", "Failed to get keychain item", error as NSError)
      }
    } catch {
      reject("keychain_get_error", "Failed to get keychain item", error as NSError)
    }
  }

  // MARK: - Remove Item

  @objc
  func removeItem(_ params: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let typedParams = RemoveItemParams(from: params) else {
      reject("keychain_remove_error", "Invalid parameters: key is required", nil)
      return
    }

    do {
      try moduleCore.removeItem(params: typedParams)
      resolve(true)
    } catch let error as KeychainModuleError {
      switch error {
      case .operationFailed(let status):
        let nsError = NSError(domain: NSOSStatusErrorDomain, code: Int(status), userInfo: nil)
        reject("keychain_remove_error", "Failed to remove keychain item: \(status)", nsError)
      default:
        reject("keychain_remove_error", "Failed to remove keychain item", error as NSError)
      }
    } catch {
      reject("keychain_remove_error", "Failed to remove keychain item", error as NSError)
    }
  }

  // MARK: - Check Item Existence

  @objc
  func hasItem(_ params: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let typedParams = HasItemParams(from: params) else {
      reject("keychain_has_error", "Invalid parameters: key is required", nil)
      return
    }

    do {
      let exists = try moduleCore.hasItem(params: typedParams)
      resolve(exists)
    } catch {
      reject("keychain_has_error", "Failed to check keychain item", error as NSError)
    }
  }

  // MARK: - Check iCloud Keychain Sync Status

  @objc
  func isICloudSyncEnabled(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    do {
      let enabled = try moduleCore.isICloudSyncEnabled()
      resolve(enabled)
    } catch {
      reject("keychain_sync_check_error", "Failed to check iCloud sync status", error as NSError)
    }
  }
}

// MARK: - Parameter Conversion Extensions

extension SetItemParams {
  init?(from dict: NSDictionary) {
    guard let key = dict[KeychainModule.paramKey] as? String,
          let value = dict[KeychainModule.paramValue] as? String else {
      return nil
    }
    self.key = key
    self.value = value
    self.enableSync = dict["enableSync"] as? Bool  // Optional, defaults to true in Core
    self.label = dict[KeychainModule.paramLabel] as? String
    self.description = dict[KeychainModule.paramDescription] as? String
  }
}

extension GetItemParams {
  init?(from dict: NSDictionary) {
    guard let key = dict[KeychainModule.paramKey] as? String else {
      return nil
    }
    self.key = key
  }
}

extension RemoveItemParams {
  init?(from dict: NSDictionary) {
    guard let key = dict[KeychainModule.paramKey] as? String else {
      return nil
    }
    self.key = key
  }
}

extension HasItemParams {
  init?(from dict: NSDictionary) {
    guard let key = dict[KeychainModule.paramKey] as? String else {
      return nil
    }
    self.key = key
  }
}

// MARK: - Result Conversion Extensions

extension GetItemResult {
  func toDictionary() -> [String: Any] {
    return [
      "key": key,
      "value": value
    ]
  }
}
