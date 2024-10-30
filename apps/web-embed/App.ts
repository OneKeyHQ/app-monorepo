import { setBgSensitiveTextEncodeKey } from '@onekeyhq/core/src/secret';
import type { IBackgroundApiWebembedCallMessage } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import webembedApi from '@onekeyhq/kit-bg/src/webembeds/instance/webembedApi';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

function printMessageToBody(message: string) {
  const p = document.createElement('p');
  p.textContent = `${new Date().toTimeString().slice(0, 8)} ${message}`;
  document.body.appendChild(p);
}

const handler = async (payload: IJsBridgeMessagePayload) =>
  webembedApi.callWebEmbedApiMethod(
    payload.data as IBackgroundApiWebembedCallMessage,
  );

const init = (times = 0) => {
  if (!globalThis.$onekey && times < 5000) {
    setTimeout(() => {
      init(times + 1);
    }, 15);
    return;
  }
  globalThis.$onekey.$private.webembedReceiveHandler = handler;
  void globalThis.$onekey.$private
    .request({
      method: 'getSensitiveEncodeKey',
    })
    .then((key) => {
      if (key) {
        setBgSensitiveTextEncodeKey(key as string);
        void globalThis.$onekey.$private.request({
          method: 'webEmbedApiReady',
        });
        printMessageToBody('web-embed init success!');
      } else {
        printMessageToBody('web-embed init failed! encoded key is empty');
      }
    });
};

init();

printMessageToBody('web-embed init...');
printMessageToBody(`${globalThis.location.href}`);
