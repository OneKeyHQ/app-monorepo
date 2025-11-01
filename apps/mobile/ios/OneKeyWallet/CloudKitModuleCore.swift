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
}

// MARK: - Parameter Models

struct SaveRecordParams: Codable {
  let recordType: String
  let recordID: String
  let data: String
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
  let createdAt: Int64
  let modifiedAt: Int64
}

struct QueryRecordsResult: Codable {
  let records: [RecordResult]
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

  // MARK: - Save Record

  func saveRecord(params: SaveRecordParams) async throws -> SaveRecordResult {
    let ckRecordID = CKRecord.ID(recordName: params.recordID)
    let record = CKRecord(recordType: params.recordType, recordID: ckRecordID)
    record[CloudKitConstants.recordDataField] = params.data as CKRecordValue

    let savedRecord = try await database.save(record)
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
      let createdAt = Int64((record.creationDate?.timeIntervalSince1970 ?? 0) * 1000)
      let modifiedAt = Int64((record.modificationDate?.timeIntervalSince1970 ?? 0) * 1000)

      return RecordResult(
        recordID: record.recordID.recordName,
        recordType: record.recordType,
        data: data,
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

    // Note: Sort by creation date is commented out to avoid queryable field issues
    // query.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]

    let (matchResults, _) = try await database.records(matching: query)

    var records: [RecordResult] = []
    for (_, result) in matchResults {
      switch result {
      case .success(let record):
        let data = record[CloudKitConstants.recordDataField] as? String ?? ""
        let createdAt = Int64((record.creationDate?.timeIntervalSince1970 ?? 0) * 1000)
        let modifiedAt = Int64((record.modificationDate?.timeIntervalSince1970 ?? 0) * 1000)

        let recordResult = RecordResult(
          recordID: record.recordID.recordName,
          recordType: record.recordType,
          data: data,
          createdAt: createdAt,
          modifiedAt: modifiedAt
        )
        records.append(recordResult)
      case .failure:
        continue
      }
    }

    return QueryRecordsResult(records: records)
  }
}
