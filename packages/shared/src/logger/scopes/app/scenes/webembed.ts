import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class WebembedScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public showWebEmbedWebView({ reason }: { reason?: string }) {
    return [reason || 'unknown'];
  }

  @LogToLocal()
  public webEmbedWebViewUriChanged({
    uri,
    remoteUrl,
  }: {
    uri: string | undefined;
    remoteUrl: string | undefined;
  }) {
    return [uri || 'unknown', remoteUrl || 'unknown'];
  }

  @LogToServer()
  @LogToLocal()
  public initTimeout() {
    return true;
  }

  @LogToServer()
  @LogToLocal()
  public emitRenderEvent() {
    return true;
  }

  @LogToServer()
  @LogToLocal()
  public renderWebview() {
    return true;
  }

  @LogToServer()
  @LogToLocal()
  public renderWebviewSingleton() {
    return true;
  }

  @LogToServer()
  @LogToLocal()
  public webembedApiReady() {
    return true;
  }

  @LogToServer()
  @LogToLocal()
  public webembedApiNotReady() {
    return true;
  }

  @LogToServer()
  @LogToLocal()
  public loadWebEmbedWebViewComplete() {
    return true;
  }

  @LogToServer()
  @LogToLocal()
  public getSensitiveEncodeKey() {
    return true;
  }

  @LogToServer()
  @LogToLocal()
  public renderHtmlRoot() {
    return true;
  }

  @LogToServer()
  @LogToLocal()
  public renderHtmlWebembedPage() {
    return true;
  }

  @LogToServer()
  @LogToLocal()
  public callPageInit() {
    return true;
  }

  @LogToServer()
  @LogToLocal()
  public callPageGetEncodeKey() {
    return true;
  }

  @LogToServer()
  @LogToLocal()
  public callPageGetEncodeKeySuccess() {
    return true;
  }

  @LogToServer()
  @LogToLocal()
  public callPageApiReady() {
    return true;
  }

  @LogToServer()
  @LogToLocal()
  public privateProviderStatus({
    init,
    isWebEmbedApiReady,
  }: {
    init: boolean;
    isWebEmbedApiReady: boolean | undefined;
  }) {
    return { init, isWebEmbedApiReady };
  }

  @LogToServer()
  @LogToLocal()
  public webembedApiCallResultIsUndefined({
    module,
    method,
  }: {
    module: string;
    method: string;
  }) {
    return [module || 'unknown', method || 'unknown'];
  }

  @LogToLocal()
  public webViewOnError({
    code,
    description,
    url,
  }: {
    code: number;
    description: string;
    url: string;
  }) {
    return { code, description, url };
  }

  // ---- Diagnostic logging for webembed communication debugging ----

  @LogToLocal()
  public webEmbedProviderEventReceived({ reason }: { reason: string }) {
    return [reason];
  }

  @LogToLocal()
  public webEmbedRevenuecatApiKey({
    hasKey,
    error,
  }: {
    hasKey: boolean;
    error?: string;
  }) {
    return { hasKey, error };
  }

  @LogToLocal()
  public webEmbedAppSettingsResolved({
    hasSettings,
    hasTheme,
    hasLocale,
    hasApiKey,
  }: {
    hasSettings: boolean;
    hasTheme: boolean;
    hasLocale: boolean;
    hasApiKey: boolean;
  }) {
    return { hasSettings, hasTheme, hasLocale, hasApiKey };
  }

  @LogToLocal()
  public webEmbedWebViewSource({
    remoteUrl,
    nativeUri,
    webEmbedPath,
  }: {
    remoteUrl?: string;
    nativeUri?: string;
    webEmbedPath?: string;
  }) {
    return { remoteUrl, nativeUri, webEmbedPath };
  }

  @LogToLocal()
  public webEmbedBridgeEffect({
    isNative,
    hasBridge,
    hasWebview,
    hasSettings,
    bridgeGlobalOnMessageEnabled,
  }: {
    isNative: boolean;
    hasBridge: boolean;
    hasWebview: boolean;
    hasSettings: boolean;
    bridgeGlobalOnMessageEnabled?: boolean;
  }) {
    return {
      isNative,
      hasBridge,
      hasWebview,
      hasSettings,
      bridgeGlobalOnMessageEnabled,
    };
  }

  @LogToLocal()
  public connectWebEmbedBridgeEntry({
    isMainThread: isMain,
    enableBgThread,
    hasTransport,
    bridgeExists,
  }: {
    isMainThread: boolean;
    enableBgThread: boolean;
    hasTransport: boolean;
    bridgeExists: boolean;
  }) {
    return { isMain, enableBgThread, hasTransport, bridgeExists };
  }

  @LogToLocal()
  public connectWebEmbedBridgeTransportReady() {
    return true;
  }

  @LogToLocal()
  public connectWebEmbedBridgeSyncDone() {
    return true;
  }

  @LogToLocal()
  public connectWebEmbedBridgeSyncError({ error }: { error: string }) {
    return [error];
  }

  @LogToLocal()
  public webEmbedWaitRemoteApiReady({ isReady }: { isReady: boolean }) {
    return { isReady };
  }

  @LogToLocal()
  public callWebEmbedApiProxyEntry({
    module,
    method,
    isWebEmbedApiReady,
    hasWebEmbedBridge,
  }: {
    module: string;
    method: string;
    isWebEmbedApiReady: boolean;
    hasWebEmbedBridge: boolean;
  }) {
    return { module, method, isWebEmbedApiReady, hasWebEmbedBridge };
  }

  @LogToLocal()
  public callWebEmbedApiProxyBridgeReady({
    module,
    method,
    origin,
  }: {
    module: string;
    method: string;
    origin: string;
  }) {
    return { module, method, origin };
  }

  @LogToLocal()
  public webEmbedWebViewLoadEvent({
    event,
    url,
    error,
  }: {
    event: string;
    url?: string;
    error?: string;
  }) {
    return { event, url, error };
  }

  @LogToLocal()
  public connectWebEmbedBridgeDirect() {
    return true;
  }

  @LogToLocal()
  public webEmbedBgConnectWebEmbedBridge({
    hasBridge,
  }: {
    hasBridge: boolean;
  }) {
    return { hasBridge };
  }
}
