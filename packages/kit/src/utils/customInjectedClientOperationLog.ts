import type { ICustomInjectedClientOperationLogRequest } from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiWebview';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

let customInjectedClientOperationLogQueue = Promise.resolve();

export function logCustomInjectedClientOperation(
  request: ICustomInjectedClientOperationLogRequest,
): void {
  const webviewApi = globalThis.desktopApiProxy?.webview;
  if (typeof webviewApi?.logCustomInjectedClientOperation !== 'function') {
    return;
  }
  customInjectedClientOperationLogQueue = customInjectedClientOperationLogQueue
    .catch(() => undefined)
    .then(() => webviewApi.logCustomInjectedClientOperation(request))
    .catch((error) => {
      console.warn(
        'Unable to write Custom Injection client operation log',
        error,
      );
    });
}

export function logCustomInjectedClientError({
  error,
  ...request
}: Omit<
  ICustomInjectedClientOperationLogRequest,
  'error' | 'operationId' | 'status'
> & {
  error: unknown;
}): void {
  logCustomInjectedClientOperation({
    ...request,
    operationId: stringUtils.generateUUID(),
    status: 'error',
    error: error instanceof Error ? error.message : String(error),
  });
}
