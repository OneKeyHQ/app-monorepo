internal import CryptoKit
import Foundation
import ImageIO
import UniformTypeIdentifiers

private final class SwapLiveActivityIconRedirects: NSObject, URLSessionTaskDelegate {
  func urlSession(
    _ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void
  ) {
    completionHandler(MarketWidgetService.validIconURL(request.url?.absoluteString) == nil ? nil : request)
  }
}

actor SwapLiveActivityIconCache {
  static let shared = SwapLiveActivityIconCache()
  private static let maximumBytes = 256 * 1024
  private static let maximumFiles = 256
  private let directory: URL?
  private let session: URLSession
  private var inFlight: [URL: Task<Bool, Never>] = [:]

  init(directory: URL? = SwapLiveActivityIconFiles.directory, session: URLSession? = nil) {
    self.directory = directory
    let configuration = URLSessionConfiguration.ephemeral
    configuration.timeoutIntervalForRequest = 1
    configuration.timeoutIntervalForResource = 1
    configuration.httpShouldSetCookies = false
    configuration.urlCredentialStorage = nil
    configuration.urlCache = nil
    self.session = session ?? URLSession(
      configuration: configuration, delegate: SwapLiveActivityIconRedirects(), delegateQueue: nil
    )
  }

  func filename(for rawURL: String?) async -> String {
    guard let directory, let url = MarketWidgetService.validIconURL(rawURL) else { return "" }
    let digest = SHA256.hash(data: Data(url.absoluteString.utf8))
    let name = digest.map { String(format: "%02x", $0) }.joined() + ".png"
    let destination = directory.appendingPathComponent(name)
    if FileManager.default.fileExists(atPath: destination.path) {
      try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: destination.path)
      return name
    }
    if let existing = inFlight[url] {
      return await existing.value ? name : ""
    }
    let task = Task {
      do {
        let (bytes, response) = try await session.bytes(from: url)
        guard let response = response as? HTTPURLResponse, response.statusCode == 200,
              MarketWidgetService.validIconURL(response.url?.absoluteString) != nil,
              response.expectedContentLength <= Int64(Self.maximumBytes) else { return false }
        var data = Data()
        for try await byte in bytes {
          guard data.count < Self.maximumBytes else { return false }
          data.append(byte)
        }
        guard let png = Self.thumbnail(from: data) else { return false }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try png.write(to: destination, options: .atomic)
        trim(directory)
        return true
      } catch {
        return false
      }
    }
    inFlight[url] = task
    let stored = await task.value
    inFlight.removeValue(forKey: url)
    return stored ? name : ""
  }

  private static func thumbnail(from data: Data) -> Data? {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
          let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
          let width = properties[kCGImagePropertyPixelWidth] as? Int,
          let height = properties[kCGImagePropertyPixelHeight] as? Int,
          (1...2048).contains(width), (1...2048).contains(height),
          let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceThumbnailMaxPixelSize: 144,
            kCGImageSourceCreateThumbnailWithTransform: true,
          ] as CFDictionary) else { return nil }
    let png = NSMutableData()
    guard let output = CGImageDestinationCreateWithData(png, UTType.png.identifier as CFString, 1, nil) else {
      return nil
    }
    CGImageDestinationAddImage(output, image, nil)
    return CGImageDestinationFinalize(output) ? png as Data : nil
  }

  private func trim(_ directory: URL) {
    guard let files = try? FileManager.default.contentsOfDirectory(
      at: directory, includingPropertiesForKeys: [.contentModificationDateKey], options: [.skipsHiddenFiles]
    ), files.count > Self.maximumFiles else { return }
    let sorted = files.map { file in
      (file, (try? file.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast)
    }.sorted { $0.1 > $1.1 }
    for (file, _) in sorted.dropFirst(Self.maximumFiles) {
      try? FileManager.default.removeItem(at: file)
    }
  }
}
