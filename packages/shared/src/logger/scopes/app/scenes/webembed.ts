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
}
