import Foundation

// Run with swiftc alongside SharedMarketWidget/MarketWidgetDiagnostics.swift.
@main
struct MarketWidgetDiagnosticsTests {
  static func main() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let source = root.appendingPathComponent("group")
    let destination = root.appendingPathComponent("export")
    let error = NSError(domain: "example", code: 42, userInfo: [NSLocalizedDescriptionKey: "private exception payload"])
    MarketWidgetDiagnostics.event("editor.failed", ["nested": ["private": "payload"]], error: error, storageDirectory: source)
    try MarketWidgetDiagnostics.exportToAppLogs(storageDirectory: source, destination: destination)
    let exported = destination.appendingPathComponent("market-widget-app.log")
    let text = try String(contentsOf: exported, encoding: .utf8)
    precondition(text.contains("editor.failed") && text.contains("42"))
    precondition(!text.contains("private") && !text.contains("payload") && !text.contains("nested"))
    for _ in 0..<600 {
      MarketWidgetDiagnostics.event("refresh.completed", ["testPadding": String(repeating: "a", count: 1000)], storageDirectory: source)
    }
    try MarketWidgetDiagnostics.exportToAppLogs(storageDirectory: source, destination: destination)
    let previous = destination.appendingPathComponent("market-widget-app.previous.log")
    precondition(FileManager.default.fileExists(atPath: previous.path))
    for url in [exported, previous] {
      let data = try Data(contentsOf: url)
      precondition(data.count <= 262_144 && data.last == 0x0a)
      for line in String(decoding: data, as: UTF8.self).split(separator: "\n") {
        _ = try JSONSerialization.jsonObject(with: Data(line.utf8))
      }
    }
    let extensionLog = source.appendingPathComponent("widget-extension.log")
    try Data("{\"event\":\"timeline.completed\"}\n".utf8).write(to: extensionLog)
    try MarketWidgetDiagnostics.exportToAppLogs(storageDirectory: source, destination: destination)
    let copied = try Data(contentsOf: destination.appendingPathComponent("market-widget-extension.log"))
    let original = try Data(contentsOf: extensionLog)
    precondition(copied == original)
    print("PASS: widget diagnostics redact errors, rotate bounded files, flush queued writes, and export both processes")
  }
}
