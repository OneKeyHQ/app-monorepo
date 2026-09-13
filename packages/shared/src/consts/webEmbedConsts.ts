// Reserved Android AssetLoader origin. Only the explicit protected APK WebEmbed
// instance maps this origin; ordinary WebViews and OTA files retain their paths.
export const ANDROID_WEB_EMBED_ORIGIN = 'https://appassets.androidplatform.net';
export const ANDROID_WEB_EMBED_DOCUMENT_URL = `${ANDROID_WEB_EMBED_ORIGIN}/web-embed/index.html`;

// The candidate-only WebKit scheme handler serves the packaged directory without
// granting file URL cross-origin access. Native code authenticates each frame.
export const IOS_WEB_EMBED_ORIGIN = 'onekey-web-embed://bundle';
export const IOS_WEB_EMBED_DOCUMENT_URL = `${IOS_WEB_EMBED_ORIGIN}/index.html`;

export function isIOSWebEmbedDocumentUrl(url?: string): boolean {
  // Compare before parsing: URL normalization must not erase credentials,
  // ports, encoded paths or traversal. Only the existing hash route may vary.
  return url?.split('#', 1)[0] === IOS_WEB_EMBED_DOCUMENT_URL;
}

export function getIOSWebEmbedMessageOrigin({
  sourceUrl,
  messageUrl,
}: {
  sourceUrl?: string;
  messageUrl?: string;
}): string | undefined {
  // This is an additional JS check, not a substitute for WK frame/origin proof.
  return isIOSWebEmbedDocumentUrl(sourceUrl) &&
    isIOSWebEmbedDocumentUrl(messageUrl)
    ? IOS_WEB_EMBED_ORIGIN
    : undefined;
}

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
