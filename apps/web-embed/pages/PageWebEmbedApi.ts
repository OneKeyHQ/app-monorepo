import { memo, useEffect } from 'react';

import { setBgSensitiveTextEncodeKey } from '@onekeyhq/core/src/secret';
import type { IBackgroundApiWebembedCallMessage } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import webembedApi from '@onekeyhq/kit-bg/src/webembeds/instance/webembedApi';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

defaultLogger.app.webembed.renderHtmlWebembedPage();

// create button which can refresh, append to body
const refreshButton = document.createElement('button');
refreshButton.textContent = 'Refresh';
refreshButton.addEventListener('click', () => {
  globalThis.location.reload();
});
document.body.appendChild(refreshButton);

function printMessageToBody(message: string) {
  const p = document.createElement('p');
  p.textContent = `${new Date().toTimeString().slice(0, 8)} ${message}`;
  document.body.appendChild(p);
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const htmlRenderTime = rootElement.getAttribute('data-html-render-time');
  const message = `web-embed render html time: ${new Date(
    parseFloat(htmlRenderTime ?? '0'),
  )
    .toTimeString()
    .slice(0, 8)}`;
  printMessageToBody(message);
}

printMessageToBody('web-embed init...');

const handler = async (payload: IJsBridgeMessagePayload) =>
  webembedApi.callWebEmbedApiMethod(
    payload.data as IBackgroundApiWebembedCallMessage,
  );

const init = (times = 0) => {
  defaultLogger.app.webembed.callPageInit();

  if (!globalThis.$onekey && times < 5000) {
    setTimeout(() => {
      init(times + 1);
    }, 15);
    return;
  }

  // it only works on GeckoView on Android
  globalThis.addEventListener('webembedReceiveHandler', async (event) => {
    if (!event) {
      return;
    }
    const { detail } = event as unknown as {
      detail: {
        data: IJsBridgeMessagePayload;
        callbackId: number;
      };
    };
    let error: unknown;
    let response: unknown;
    try {
      response = await handler(detail.data);
    } catch (e) {
      error = e;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    (globalThis as any).$webEmbed.callWebEmbedApiMethod(
      detail.callbackId,
      error,
      response,
    );
  });

  globalThis.$onekey.$private.webembedReceiveHandler = handler;

  defaultLogger.app.webembed.callPageGetEncodeKey();

  void globalThis.$onekey.$private
    .request({
      method: 'getSensitiveEncodeKey',
    })
    .then((key) => {
      defaultLogger.app.webembed.callPageGetEncodeKeySuccess();

      if (key) {
        setBgSensitiveTextEncodeKey(key as string);

        defaultLogger.app.webembed.callPageApiReady();

        void globalThis.$onekey.$private.request({
          method: 'webEmbedApiReady',
        });
        printMessageToBody('web-embed init success! 73765183');
      } else {
        printMessageToBody('web-embed init failed! encoded key is empty');
      }
    });
};

let isInitExecuted = false;
const PageWebEmbedApi = memo(() => {
  useEffect(() => {
    if (isInitExecuted) {
      return;
    }
    isInitExecuted = true;
    init();
    printMessageToBody(`${globalThis.location.href}`);
  }, []);
  return null;
});
PageWebEmbedApi.displayName = 'PageWebEmbedApi';

export default PageWebEmbedApi;
