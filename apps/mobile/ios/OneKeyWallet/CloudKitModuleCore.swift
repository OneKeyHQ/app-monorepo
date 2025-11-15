//
//  CloudKitModuleCore.swift
//  OneKeyWallet
//
//  Created by OneKey on 2025-01-27.
//  Core implementation layer for CloudKit operations (React Native independent)
//

import Foundation
import CloudKit

// MARK: - Constants

struct CloudKitConstants {
  static let recordDataField = "data"
  static let recordMetaField = "meta"
}

// MARK: - Parameter Models

struct SaveRecordParams: Codable {
  let recordType: String
  let recordID: String
  let data: String
  let meta: String
}

struct FetchRecordParams: Codable {
  let recordType: String
  let recordID: String
}

struct DeleteRecordParams: Codable {
  let recordType: String
  let recordID: String
}

struct RecordExistsParams: Codable {
  let recordType: String
  let recordID: String
}

struct QueryRecordsParams: Codable {
  let recordType: String
}

// MARK: - Result Models

struct SaveRecordResult: Codable {
  let recordID: String
  let createdAt: Int64
}

struct RecordResult: Codable {
  let recordID: String
  let recordType: String
  let data: String
  let meta: String
  let createdAt: Int64
  let modifiedAt: Int64
}

struct QueryRecordsResult: Codable {
  let records: [RecordResult]
}

// New: Account Info Result
struct AccountInfoResult: Codable {
  let status: Int
  let statusName: String
  let containerUserId: String?
}

// MARK: - Error Types

enum CloudKitModuleError: Error {
  case invalidParameters(String)
  case operationFailed(String)
  case recordNotFound
  case noRecordReturned
}

// MARK: - CloudKit Module Core

class CloudKitModuleCore {

  // MARK: - Properties

  // let container = CKContainer(identifier: "iCloud.so.onekey.wallet")
  private let container = CKContainer.default()
  private lazy var database = container.privateCloudDatabase

  // MARK: - Check Availability

  func isAvailable() async throws -> Bool {
    let status = try await container.accountStatus()
    return status == .available
  }

  // MARK: - Get Account Info

  func getAccountInfo() async throws -> AccountInfoResult {
    let status = try await container.accountStatus()
    var userId: String?
    if status == .available {
      do {
        let userRecordID = try await container.userRecordID()
        userId = userRecordID.recordName
      } catch {
        userId = nil
      }
    }
    let name: String
    switch status {
    case .available:
      name = "available"
    case .noAccount:
      name = "noAccount"
    case .restricted:
      name = "restricted"
    default:
      name = "couldNotDetermine"
    }
    return AccountInfoResult(status: status.rawValue, statusName: name, containerUserId: userId)
  }

  // MARK: - Save Record

  func saveRecord(params: SaveRecordParams) async throws -> SaveRecordResult {
    let ckRecordID = CKRecord.ID(recordName: params.recordID)
    let recordToSave: CKRecord
    do {
      // Update existing record if found
      let record = try await database.record(for: ckRecordID)
      recordToSave = record
    } catch let error as CKError where error.code == .unknownItem {
      // Create new record when not found
      let record = CKRecord(recordType: params.recordType, recordID: ckRecordID)
      recordToSave = record
    }
    recordToSave[CloudKitConstants.recordDataField] = params.data as CKRecordValue
    recordToSave[CloudKitConstants.recordMetaField] = params.meta as CKRecordValue
    let savedRecord = try await database.save(recordToSave)
    let createdAt = Int64((savedRecord.creationDate?.timeIntervalSince1970 ?? 0) * 1000)
    return SaveRecordResult(
      recordID: savedRecord.recordID.recordName,
      createdAt: createdAt
    )
  }

  // MARK: - Fetch Record

  func fetchRecord(params: FetchRecordParams) async throws -> RecordResult? {
    let ckRecordID = CKRecord.ID(recordName: params.recordID)

    do {
      let record = try await database.record(for: ckRecordID)

      let data = record[CloudKitConstants.recordDataField] as? String ?? ""
      let meta = record[CloudKitConstants.recordMetaField] as? String ?? ""
      let createdAt = Int64((record.creationDate?.timeIntervalSince1970 ?? 0) * 1000)
      let modifiedAt = Int64((record.modificationDate?.timeIntervalSince1970 ?? 0) * 1000)

      return RecordResult(
        recordID: record.recordID.recordName,
        recordType: record.recordType,
        data: data,
        meta: meta,
        createdAt: createdAt,
        modifiedAt: modifiedAt
      )
    } catch let error as CKError where error.code == .unknownItem {
      return nil
    }
  }

  // MARK: - Delete Record

  func deleteRecord(params: DeleteRecordParams) async throws {
    let ckRecordID = CKRecord.ID(recordName: params.recordID)

    do {
      _ = try await database.deleteRecord(withID: ckRecordID)
    } catch let error as CKError where error.code == .unknownItem {
      // Item not found is considered success for delete
      return
    }
  }

  // MARK: - Record Exists

  func recordExists(params: RecordExistsParams) async throws -> Bool {
    let ckRecordID = CKRecord.ID(recordName: params.recordID)

    do {
      _ = try await database.record(for: ckRecordID)
      return true
    } catch let error as CKError where error.code == .unknownItem {
      return false
    }
  }

  // MARK: - Query Records

  func queryRecords(params: QueryRecordsParams) async throws -> QueryRecordsResult {
    let predicate = NSPredicate(value: true)
    let query = CKQuery(recordType: params.recordType, predicate: predicate)

    // Use CKQueryOperation with desiredKeys to fetch only meta (exclude large data field)
    return try await withCheckedThrowingContinuation { continuation in
      var results: [RecordResult] = []
      let operation = CKQueryOperation(query: query)
      operation.desiredKeys = [CloudKitConstants.recordMetaField]
      // operation.resultsLimit = 500 // Optional: tune as needed

      operation.recordMatchedBlock = { _, result in
        switch result {
        case .success(let record):
          let meta = record[CloudKitConstants.recordMetaField] as? String ?? ""
          let createdAt = Int64((record.creationDate?.timeIntervalSince1970 ?? 0) * 1000)
          let modifiedAt = Int64((record.modificationDate?.timeIntervalSince1970 ?? 0) * 1000)
          let rr = RecordResult(
            recordID: record.recordID.recordName,
            recordType: record.recordType,
            data: "",
            meta: meta,
            createdAt: createdAt,
            modifiedAt: modifiedAt
          )
          results.append(rr)
        case .failure:
          break
        }
      }

      operation.queryResultBlock = { result in
        switch result {
        case .success:
          // Sort by modification time descending to return latest first
          let sorted = results.sorted { $0.modifiedAt > $1.modifiedAt }
          continuation.resume(returning: QueryRecordsResult(records: sorted))
        case .failure(let error):
          continuation.resume(throwing: error)
        }
      }

      self.database.add(operation)
    }
  }
}
