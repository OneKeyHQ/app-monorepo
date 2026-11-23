import Foundation

enum MarketWidgetDiagnostics {
  @TaskLocal static var refreshID: String?
  private static let queue = DispatchQueue(label: "so.onekey.wallet.widget-diagnostics")
  private static let limit = 262_144
  private static var role: String { Bundle.main.bundleURL.pathExtension == "appex" ? "extension" : "app" }
  private static var directory: URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.so.onekey.wallet")?
      .appendingPathComponent("MarketWidgetLogs", isDirectory: true)
  }

  // Callers supply bounded scalars, never assets, URLs, search terms, or settings payloads.
  static func event(_ event: String, _ fields: [String: Any] = [:], error: Error? = nil,
                    storageDirectory: URL? = nil) {
    var value = fields.filter { $0.value is String || $0.value is NSNumber || $0.value is Bool }
    value["event"] = event
    value["time"] = Date().timeIntervalSince1970
    value["pid"] = ProcessInfo.processInfo.processIdentifier
    value["process"] = role
    value["refreshId"] = refreshID
    if let error {
      value["errorClass"] = String(describing: type(of: error))
      value["errorCode"] = (error as NSError).code
    }
    guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]),
          data.count < 4096, let directory = storageDirectory ?? directory else { return }
    let file = directory.appendingPathComponent("widget-\(role).log")
    let line = data + Data([0x0a])
    queue.async {
      do {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var coordinationError: NSError?
        NSFileCoordinator().coordinate(writingItemAt: file, options: .forMerging, error: &coordinationError) { url in
          do {
            let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
            if size + line.count > limit {
              let previous = url.appendingPathExtension("previous")
              try? FileManager.default.removeItem(at: previous)
              try FileManager.default.moveItem(at: url, to: previous)
            }
            if !FileManager.default.fileExists(atPath: url.path) {
              FileManager.default.createFile(atPath: url.path, contents: nil,
                attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
            }
            let handle = try FileHandle(forWritingTo: url)
            defer { try? handle.close() }
            try handle.seekToEnd()
            try handle.write(contentsOf: line)
          } catch { /* Diagnostics must not affect WidgetKit completion. */ }
        }
      } catch { /* The shared container can be unavailable before first unlock. */ }
    }
  }

  static func exportToAppLogs(storageDirectory: URL? = nil, destination: URL? = nil) throws {
    try queue.sync {
      guard let directory = storageDirectory ?? directory else { return }
      let target = destination ?? FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("logs", isDirectory: true)
      try FileManager.default.createDirectory(at: target, withIntermediateDirectories: true)
      for role in ["app", "extension"] {
        let source = directory.appendingPathComponent("widget-\(role).log")
        var coordinationError: NSError?
        var copyError: Error?
        NSFileCoordinator().coordinate(readingItemAt: source, options: [], error: &coordinationError) { url in
          do {
            for suffix in ["", ".previous"] {
              let file = URL(fileURLWithPath: url.path + suffix)
              let destination = target.appendingPathComponent("market-widget-\(role)\(suffix).log")
              try? FileManager.default.removeItem(at: destination)
              guard FileManager.default.fileExists(atPath: file.path) else { continue }
              let data = try Data(contentsOf: file)
              guard data.count <= limit else { continue }
              try data.write(to: destination, options: [.atomic, .completeFileProtection])
            }
          } catch { copyError = error }
        }
        if let copyError { throw copyError }
        if let coordinationError, FileManager.default.fileExists(atPath: source.path) { throw coordinationError }
      }
    }
  }
}
