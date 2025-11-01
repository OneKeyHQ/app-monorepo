/**
 * MacApiBridge - Unified macOS Native API Bridge for OneKey Desktop
 *
 * This command-line tool provides a unified interface for accessing macOS-specific APIs:
 * - CloudKit for iCloud data synchronization
 * - Keychain for secure credential storage with iCloud sync
 *
 * Architecture:
 * - Single entry point for all macOS native API operations
 * - Delegates to specialized helper modules (CloudKitHelper, KeychainHelper)
 * - JSON-based communication via stdin/stdout
 *
 * Build Instructions:
 *   See build-mac-api-bridge.sh
 *
 * Usage:
 *   ./onekey-desktop-mac-api-bridge <module>.<command> [<json-params>]
 *
 * Commands:
 *   CloudKit Commands:
 *     cloudkit.isAvailable - Check if CloudKit is available
 *     cloudkit.saveRecord <json> - Save a record
 *     cloudkit.fetchRecord <json> - Fetch a record
 *     cloudkit.deleteRecord <json> - Delete a record
 *     cloudkit.recordExists <json> - Check if record exists
 *     cloudkit.queryRecords <json> - Query records
 *
 *   Keychain Commands:
 *     keychain.setItem <json> - Store an item (with optional iCloud sync)
 *     keychain.getItem <json> - Retrieve an item
 *     keychain.removeItem <json> - Delete an item
 *     keychain.hasItem <json> - Check if item exists
 *     keychain.isICloudSyncEnabled - Check if iCloud Keychain sync is available
 */

import Foundation
import CloudKit
import Security

// Import Core modules from Mobile
// These files are located in apps/mobile/ios/OneKeyWallet/
// Note: When compiling, all Swift files must be specified in the swiftc command

// MARK: - JSON Helper Functions

func jsonString<T: Encodable>(from value: T) throws -> String {
  let encoder = JSONEncoder()
  let data = try encoder.encode(value)
  return String(data: data, encoding: .utf8) ?? "{}"
}

func jsonString(_ dict: [String: Any]) -> String {
  guard let data = try? JSONSerialization.data(withJSONObject: dict),
        let string = String(data: data, encoding: .utf8) else {
    return "{}"
  }
  return string
}

func errorJSON(_ message: String) -> String {
  return jsonString(["error": message])
}

// MARK: - Main Entry Point

@main
struct MacApiBridge {
    static func main() async {
        let args = CommandLine.arguments

        guard args.count >= 2 else {
            print("{\"error\": \"Usage: onekey-desktop-mac-api-bridge <module>.<command> [<json-params>]\"}")
            exit(1)
        }

        let fullCommand = args[1]
        let components = fullCommand.split(separator: ".", maxSplits: 1).map(String.init)

        guard components.count == 2 else {
            print("{\"error\": \"Invalid command format. Use: <module>.<command> (e.g., keychain.setItem)\"}")
            exit(1)
        }

        let module = components[0]
        let command = components[1]
        var result: String

        // Route commands to appropriate helper based on module
        switch module {
        case "cloudkit":
            result = await handleCloudKitCommand(command: command, args: args)
        case "keychain":
            result = await handleKeychainCommand(command: command, args: args)
        default:
            print("{\"error\": \"Unknown module: \(module). Use 'cloudkit' or 'keychain'\"}")
            exit(1)
        }

        print(result)
        exit(0)
    }

    // MARK: - CloudKit Command Handler

    static func handleCloudKitCommand(command: String, args: [String]) async -> String {
        // Test command without CloudKit initialization
        if command == "test" {
            return jsonString(["test": "Basic async command works"])
        }

        // For all other commands, initialize CloudKit
        let moduleCore = CloudKitModuleCore()

        switch command {
        case "isAvailable":
            do {
                let available = try await moduleCore.isAvailable()
                return try jsonString(from: ["available": available])
            } catch {
                return errorJSON("Failed to check CloudKit status: \(error.localizedDescription)")
            }

        case "saveRecord":
            guard args.count >= 3,
                  let params = try? JSONDecoder().decode(SaveRecordParams.self, from: args[2].data(using: .utf8)!) else {
                return errorJSON("Invalid saveRecord params")
            }
            do {
                let result = try await moduleCore.saveRecord(params: params)
                return try jsonString(from: result)
            } catch {
                return errorJSON("Failed to save record: \(error.localizedDescription)")
            }

        case "fetchRecord":
            guard args.count >= 3,
                  let params = try? JSONDecoder().decode(FetchRecordParams.self, from: args[2].data(using: .utf8)!) else {
                return errorJSON("Invalid fetchRecord params")
            }
            do {
                if let result = try await moduleCore.fetchRecord(params: params) {
                    return try jsonString(from: ["record": result])
                } else {
                    return try jsonString(from: ["record": nil as String?])
                }
            } catch {
                return errorJSON("Failed to fetch record: \(error.localizedDescription)")
            }

        case "deleteRecord":
            guard args.count >= 3,
                  let params = try? JSONDecoder().decode(DeleteRecordParams.self, from: args[2].data(using: .utf8)!) else {
                return errorJSON("Invalid deleteRecord params")
            }
            do {
                try await moduleCore.deleteRecord(params: params)
                return try jsonString(from: ["success": true])
            } catch {
                return errorJSON("Failed to delete record: \(error.localizedDescription)")
            }

        case "recordExists":
            guard args.count >= 3,
                  let params = try? JSONDecoder().decode(RecordExistsParams.self, from: args[2].data(using: .utf8)!) else {
                return errorJSON("Invalid recordExists params")
            }
            do {
                let exists = try await moduleCore.recordExists(params: params)
                return try jsonString(from: ["exists": exists])
            } catch {
                return errorJSON("Failed to check record existence: \(error.localizedDescription)")
            }

        case "queryRecords":
            guard args.count >= 3,
                  let params = try? JSONDecoder().decode(QueryRecordsParams.self, from: args[2].data(using: .utf8)!) else {
                return errorJSON("Invalid queryRecords params")
            }
            do {
                let result = try await moduleCore.queryRecords(params: params)
                return try jsonString(from: ["records": result.records])
            } catch {
                return errorJSON("Failed to query records: \(error.localizedDescription)")
            }

        default:
            return errorJSON("Unknown CloudKit command: \(command)")
        }
    }

    // MARK: - Keychain Command Handler

    static func handleKeychainCommand(command: String, args: [String]) async -> String {
        let moduleCore = KeychainModuleCore()

        switch command {
        case "setItem":
            guard args.count >= 3,
                  let params = try? JSONDecoder().decode(SetItemParams.self, from: args[2].data(using: .utf8)!) else {
                return errorJSON("Invalid setItem params")
            }
            do {
                try moduleCore.setItem(params: params)
                return jsonString(["success": true])
            } catch {
                return errorJSON("Failed to set keychain item: \(error.localizedDescription)")
            }

        case "getItem":
            guard args.count >= 3,
                  let params = try? JSONDecoder().decode(GetItemParams.self, from: args[2].data(using: .utf8)!) else {
                return errorJSON("Invalid getItem params")
            }
            do {
                if let result = try moduleCore.getItem(params: params) {
                    return try jsonString(from: result)
                } else {
                    return try jsonString(from: ["result": nil as String?])
                }
            } catch {
                return errorJSON("Failed to get keychain item: \(error.localizedDescription)")
            }

        case "removeItem":
            guard args.count >= 3,
                  let params = try? JSONDecoder().decode(RemoveItemParams.self, from: args[2].data(using: .utf8)!) else {
                return errorJSON("Invalid removeItem params")
            }
            do {
                try moduleCore.removeItem(params: params)
                return jsonString(["success": true])
            } catch {
                return errorJSON("Failed to remove keychain item: \(error.localizedDescription)")
            }

        case "hasItem":
            guard args.count >= 3,
                  let params = try? JSONDecoder().decode(HasItemParams.self, from: args[2].data(using: .utf8)!) else {
                return errorJSON("Invalid hasItem params")
            }
            do {
                let exists = try moduleCore.hasItem(params: params)
                return jsonString(["exists": exists])
            } catch {
                return errorJSON("Failed to check keychain item: \(error.localizedDescription)")
            }

        case "isICloudSyncEnabled":
            do {
                let enabled = try moduleCore.isICloudSyncEnabled()
                return jsonString(["enabled": enabled])
            } catch {
                return errorJSON("Failed to check iCloud sync status: \(error.localizedDescription)")
            }

        default:
            return errorJSON("Unknown Keychain command: \(command)")
        }
    }
}
