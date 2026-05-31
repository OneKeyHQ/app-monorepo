import Foundation
import Security

@objc(OneKeyColdStartCacheKey)
class OneKeyColdStartCacheKey: NSObject {
  private static let account = "onekey_cold_start_cache_storage_key_v1"
  private static let keyBytes = 32

  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc
  func constantsToExport() -> [AnyHashable: Any]! {
    ["encryptionKey": Self.getOrCreateEncryptionKey()]
  }

  private static func getOrCreateEncryptionKey() -> String {
    if let current = readKey(), !current.isEmpty {
      return current
    }
    let next = createRandomKey()
    return saveKey(next) ? next : ""
  }

  private static func readKey() -> String? {
    var query = baseQuery()
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne

    var result: AnyObject?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    guard status == errSecSuccess, let data = result as? Data else {
      return nil
    }
    return String(data: data, encoding: .utf8)
  }

  private static func saveKey(_ key: String) -> Bool {
    guard let data = key.data(using: .utf8) else {
      return false
    }
    SecItemDelete(baseQuery() as CFDictionary)

    var query = baseQuery()
    query[kSecValueData as String] = data
    query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
  }

  private static func createRandomKey() -> String {
    var bytes = [UInt8](repeating: 0, count: keyBytes)
    let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
    if status != errSecSuccess {
      return UUID().uuidString + UUID().uuidString
    }
    return Data(bytes).base64EncodedString()
  }

  private static func baseQuery() -> [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: Bundle.main.bundleIdentifier ?? "so.onekey.app.wallet",
      kSecAttrAccount as String: account,
      kSecAttrSynchronizable as String: kCFBooleanFalse as Any,
    ]
  }
}
