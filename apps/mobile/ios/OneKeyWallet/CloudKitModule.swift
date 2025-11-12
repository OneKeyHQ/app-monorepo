//
//  CloudKitModule.swift
//  OneKeyWallet
//
//  Created by OneKey on 2025-01-27.
//  React Native Bridge layer for CloudKit operations
//

import Foundation
import CloudKit
import React

@objc(CloudKitModule)
class CloudKitModule: NSObject {

  // MARK: - Constants

  // React Native Bridge Parameter Names
  fileprivate static let paramRecordType = "recordType"
  fileprivate static let paramRecordID = "recordID"
  fileprivate static let paramData = "data"
  fileprivate static let paramMeta = "meta"

  // MARK: - Properties

  private let moduleCore = CloudKitModuleCore()

  // MARK: - React Native Bridge

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  // MARK: - Check CloudKit Availability

  @objc
  func isAvailable(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Task {
      do {
        let available = try await moduleCore.isAvailable()
        resolve(available)
      } catch {
        reject("cloudkit_error", "Failed to check CloudKit status: \(error.localizedDescription)", error)
      }
    }
  }

  // MARK: - Get Account Info

  @objc
  func getAccountInfo(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Task {
      do {
        let result = try await moduleCore.getAccountInfo()
        resolve(result.toDictionary())
      } catch {
        reject("cloudkit_error", "Failed to get account info: \(error.localizedDescription)", error)
      }
    }
  }

  // MARK: - Save Record

  @objc
  func saveRecord(_ params: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let typedParams = SaveRecordParams(from: params) else {
      reject("cloudkit_save_error", "Invalid parameters: recordType, recordID, and data are required", nil)
      return
    }

    Task {
      do {
        let result = try await moduleCore.saveRecord(params: typedParams)
        resolve(result.toDictionary())
      } catch {
        reject("cloudkit_save_error", "Failed to save record: \(error.localizedDescription)", error)
      }
    }
  }

  // MARK: - Fetch Record

  @objc
  func fetchRecord(_ params: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let typedParams = FetchRecordParams(from: params) else {
      reject("cloudkit_fetch_error", "Invalid parameters: recordID and recordType are required", nil)
      return
    }

    Task {
      do {
        if let result = try await moduleCore.fetchRecord(params: typedParams) {
          resolve(result.toDictionary())
        } else {
          resolve(NSNull())
        }
      } catch {
        reject("cloudkit_fetch_error", "Failed to fetch record: \(error.localizedDescription)", error)
      }
    }
  }

  // MARK: - Delete Record

  @objc
  func deleteRecord(_ params: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let typedParams = DeleteRecordParams(from: params) else {
      reject("cloudkit_delete_error", "Invalid parameters: recordID and recordType are required", nil)
      return
    }

    Task {
      do {
        try await moduleCore.deleteRecord(params: typedParams)
        resolve(true)
      } catch {
        reject("cloudkit_delete_error", "Failed to delete record: \(error.localizedDescription)", error)
      }
    }
  }

  // MARK: - Check Record Existence

  @objc
  func recordExists(_ params: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let typedParams = RecordExistsParams(from: params) else {
      reject("cloudkit_exists_error", "Invalid parameters: recordID and recordType are required", nil)
      return
    }

    Task {
      do {
        let exists = try await moduleCore.recordExists(params: typedParams)
        resolve(exists)
      } catch {
        reject("cloudkit_exists_error", "Failed to check record existence: \(error.localizedDescription)", error)
      }
    }
  }

  // MARK: - Query Records

  @objc
  func queryRecords(_ params: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let typedParams = QueryRecordsParams(from: params) else {
      reject("cloudkit_query_error", "Invalid parameters: recordType is required", nil)
      return
    }

    Task {
      do {
        let result = try await moduleCore.queryRecords(params: typedParams)
        resolve(result.toDictionary())
      } catch {
        reject("cloudkit_query_error", "Failed to query records: \(error.localizedDescription)", error)
      }
    }
  }
}

// MARK: - Parameter Conversion Extensions

extension SaveRecordParams {
  init?(from dict: NSDictionary) {
    guard let recordType = dict[CloudKitModule.paramRecordType] as? String,
          let recordID = dict[CloudKitModule.paramRecordID] as? String,
          let data = dict[CloudKitModule.paramData] as? String,
          let meta = dict[CloudKitModule.paramMeta] as? String else {
      return nil
    }
    self.recordType = recordType
    self.recordID = recordID
    self.data = data
    self.meta = meta
  }
}

extension FetchRecordParams {
  init?(from dict: NSDictionary) {
    guard let recordType = dict[CloudKitModule.paramRecordType] as? String,
          let recordID = dict[CloudKitModule.paramRecordID] as? String else {
      return nil
    }
    self.recordType = recordType
    self.recordID = recordID
  }
}

extension DeleteRecordParams {
  init?(from dict: NSDictionary) {
    guard let recordType = dict[CloudKitModule.paramRecordType] as? String,
          let recordID = dict[CloudKitModule.paramRecordID] as? String else {
      return nil
    }
    self.recordType = recordType
    self.recordID = recordID
  }
}

extension RecordExistsParams {
  init?(from dict: NSDictionary) {
    guard let recordType = dict[CloudKitModule.paramRecordType] as? String,
          let recordID = dict[CloudKitModule.paramRecordID] as? String else {
      return nil
    }
    self.recordType = recordType
    self.recordID = recordID
  }
}

extension QueryRecordsParams {
  init?(from dict: NSDictionary) {
    guard let recordType = dict[CloudKitModule.paramRecordType] as? String else {
      return nil
    }
    self.recordType = recordType
  }
}

// MARK: - Result Conversion Extensions

extension SaveRecordResult {
  func toDictionary() -> [String: Any] {
    return [
      "recordID": recordID,
      "createdAt": createdAt
    ]
  }
}

extension RecordResult {
  func toDictionary() -> [String: Any] {
    return [
      "recordID": recordID,
      "recordType": recordType,
      "data": data,
      "meta": meta,
      "createdAt": createdAt,
      "modifiedAt": modifiedAt
    ]
  }
}

extension QueryRecordsResult {
  func toDictionary() -> [String: Any] {
    return [
      "records": records.map { $0.toDictionary() }
    ]
  }
}

extension AccountInfoResult {
  func toDictionary() -> [String: Any] {
    let userId: Any = containerUserId ?? NSNull()
    return [
      "status": status,
      "statusName": statusName,
      "containerUserId": userId
    ]
  }
}
