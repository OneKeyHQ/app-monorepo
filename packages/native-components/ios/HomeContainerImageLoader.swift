import SDWebImage
import UIKit

final class HomeContainerImageRequest {
  private let lock = NSLock()
  private var operation: SDWebImageOperation?
  private var retryWorkItem: DispatchWorkItem?
  private var retryIdentifier: UUID?
  private var cancelled = false

  func replace(operation: SDWebImageOperation?) {
    lock.lock()
    let shouldCancel = cancelled
    if !shouldCancel {
      self.operation = operation
    }
    lock.unlock()
    if shouldCancel {
      operation?.cancel()
    }
  }

  func scheduleRetry(after delay: TimeInterval, _ retry: @escaping () -> Void) {
    let identifier = UUID()
    let workItem = DispatchWorkItem { [weak self] in
      guard self?.beginScheduledRetry(identifier: identifier) == true else { return }
      retry()
    }
    lock.lock()
    let shouldSchedule = !cancelled
    if shouldSchedule {
      retryIdentifier = identifier
      retryWorkItem = workItem
    }
    lock.unlock()
    if shouldSchedule {
      DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: workItem)
    }
  }

  func finishAttempt() {
    lock.lock()
    operation = nil
    lock.unlock()
  }

  var isCancelled: Bool {
    lock.lock()
    defer { lock.unlock() }
    return cancelled
  }

  func cancel() {
    lock.lock()
    cancelled = true
    let operation = operation
    let retryWorkItem = retryWorkItem
    self.operation = nil
    self.retryWorkItem = nil
    retryIdentifier = nil
    lock.unlock()
    retryWorkItem?.cancel()
    operation?.cancel()
  }

  deinit {
    cancel()
  }

  private func beginScheduledRetry(identifier: UUID) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    guard !cancelled, retryIdentifier == identifier else { return false }
    retryIdentifier = nil
    retryWorkItem = nil
    return true
  }
}

final class HomeContainerImageLoader {
  static let shared = HomeContainerImageLoader()

  private let imageManager = SDWebImageManager(
    cache: SDImageCache.shared,
    loader: SDImageLoadersManager.shared
  )

  private init() {}

  func load(
    url: URL,
    retryOnFailure: Bool = true,
    completion: @escaping (UIImage?) -> Void
  ) -> HomeContainerImageRequest? {
    #if DEBUG
    if ProcessInfo.processInfo.environment["ONEKEY_NATIVE_HOME_IMAGE_AUDIT"] == "all-fail" {
      DispatchQueue.main.async {
        completion(nil)
      }
      return nil
    }
    #endif

    let request = HomeContainerImageRequest()
    startAttempt(
      request: request,
      url: url,
      retryOnFailure: retryOnFailure,
      attempt: 0,
      completion: completion
    )
    return request
  }

  private func startAttempt(
    request: HomeContainerImageRequest,
    url: URL,
    retryOnFailure: Bool,
    attempt: Int,
    completion: @escaping (UIImage?) -> Void
  ) {
    guard !request.isCancelled else { return }
    let cacheType = SDImageCacheType.all.rawValue
    let context: [SDWebImageContextOption: Any] = [
      .queryCacheType: cacheType,
      .storeCacheType: cacheType,
    ]
    let options: SDWebImageOptions = [.retryFailed, .handleCookies]
    let operation = imageManager.loadImage(
      with: url,
      options: options,
      context: context,
      progress: nil
    ) { [weak self, weak request] image, _, _, _, finished, _ in
      guard finished else { return }
      // SDWebImage may complete synchronously from memory cache. Always publish
      // on the next main run loop so callers store this active request first.
      DispatchQueue.main.async { [weak self, weak request] in
        guard let self, let request, !request.isCancelled else { return }
        request.finishAttempt()
        let maximumRetryCount = 3
        guard image == nil, retryOnFailure, attempt < maximumRetryCount else {
          completion(image)
          return
        }
        // Keep the stable fallback visible while a represented URL recovers.
        // Bound retries so an off-screen cell cannot create background traffic.
        completion(nil)
        let delay: TimeInterval = attempt < 2 ? TimeInterval(2 * (attempt + 1)) : 30
        request.scheduleRetry(after: delay) { [weak self, weak request] in
          guard let self, let request else { return }
          self.startAttempt(
            request: request,
            url: url,
            retryOnFailure: retryOnFailure,
            attempt: attempt + 1,
            completion: completion
          )
        }
      }
    }
    request.replace(operation: operation)
  }
}
