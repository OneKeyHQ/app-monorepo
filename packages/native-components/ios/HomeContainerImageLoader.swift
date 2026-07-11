import SDWebImage
import UIKit

final class HomeContainerImageRequest {
  private let operation: SDWebImageOperation

  init(operation: SDWebImageOperation) {
    self.operation = operation
  }

  func cancel() {
    operation.cancel()
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
    completion: @escaping (UIImage?) -> Void
  ) -> HomeContainerImageRequest? {
    let cacheType = SDImageCacheType.all.rawValue
    let context: [SDWebImageContextOption: Any] = [
      .queryCacheType: cacheType,
      .storeCacheType: cacheType,
    ]
    let operation = imageManager.loadImage(
      with: url,
      options: [.retryFailed, .handleCookies],
      context: context,
      progress: nil
    ) { image, _, _, _, finished, _ in
      guard finished else { return }
      completion(image)
    }
    return operation.map(HomeContainerImageRequest.init(operation:))
  }
}
