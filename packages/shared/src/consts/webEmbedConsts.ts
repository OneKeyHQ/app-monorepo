// Android serves the local web-embed page from a virtual https origin, because
// a file:// page has an opaque origin and cannot use OPFS. The host is
// androidx WebViewAssetLoader's reserved domain, which never resolves on the
// public network; the app answers every request on it (see
// so.onekey.app.wallet.webview.WebEmbedLocalOrigin), so it can never reach a
// server. Browser storage is keyed by this origin: changing it orphans the
// page's databases, so treat it as fixed. Keep it in sync with HOST there.
export const WEB_EMBED_ANDROID_LOCAL_ORIGIN =
  'https://appassets.androidplatform.net';

export enum EWebEmbedRoutePath {
  index = '/',
  primePurchase = '/prime/purchase',
  webEmbedApi = '/webembed/api',
}

export enum EWebEmbedPrivateRequestMethod {
  closeWebViewModal = 'webembedPrivateRequest_closeWebViewModal',
  closeWebViewModalAfterPrimePurchaseSuccess = 'webembedPrivateRequest_closeWebViewModalAfterPrimePurchaseSuccess',
  showToast = 'webembedPrivateRequest_showToast',
  showDebugMessageDialog = 'webembedPrivateRequest_showDebugMessageDialog',
}
