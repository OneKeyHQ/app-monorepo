import SwiftUI
import WebKit

enum CampaignURLPolicy {
  private static let allowedHosts = Set([
    "app.onekey.so",
    "app.onekeytest.com",
  ])

  static func isAllowed(_ url: URL) -> Bool {
    guard
      url.scheme?.lowercased() == "https",
      let host = url.host?.lowercased(),
      url.user == nil,
      url.password == nil,
      url.port == nil || url.port == 443
    else {
      return false
    }
    return allowedHosts.contains(host)
  }
}

struct CampaignWebView: UIViewRepresentable {
  let url: URL

  func makeCoordinator() -> Coordinator {
    Coordinator()
  }

  func makeUIView(context: Context) -> WKWebView {
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .nonPersistent()
    configuration.defaultWebpagePreferences.allowsContentJavaScript = true
    configuration.limitsNavigationsToAppBoundDomains = true
    let webView = WKWebView(frame: .zero, configuration: configuration)
    webView.navigationDelegate = context.coordinator
    webView.uiDelegate = context.coordinator
    webView.allowsBackForwardNavigationGestures = false
    webView.scrollView.contentInsetAdjustmentBehavior = .automatic
    webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
    return webView
  }

  func updateUIView(_ webView: WKWebView, context: Context) {
    guard webView.url != url else {
      return
    }
    webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
  }

  final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
    func webView(
      _ webView: WKWebView,
      decidePolicyFor navigationAction: WKNavigationAction,
      decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
      guard
        let url = navigationAction.request.url,
        CampaignURLPolicy.isAllowed(url)
      else {
        decisionHandler(.cancel)
        return
      }
      decisionHandler(.allow)
    }

    func webView(
      _ webView: WKWebView,
      createWebViewWith configuration: WKWebViewConfiguration,
      for navigationAction: WKNavigationAction,
      windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
      guard
        navigationAction.targetFrame == nil,
        let url = navigationAction.request.url,
        CampaignURLPolicy.isAllowed(url)
      else {
        return nil
      }
      webView.load(URLRequest(url: url))
      return nil
    }
  }
}
