// Android serves web-embed from this virtual https origin (file:// is opaque
// and cannot use OPFS); native WebEmbedLocalOrigin answers every request on it.
// Browser storage is keyed by this origin: never change it. Keep in sync with
// WebEmbedLocalOrigin.HOST.
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
  // The embedded Stripe checkout failed; continue in the hosted Purchase Link.
  fallbackToPrimeHostedCheckout = 'webembedPrivateRequest_fallbackToPrimeHostedCheckout',
}
