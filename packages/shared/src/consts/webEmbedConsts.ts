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
