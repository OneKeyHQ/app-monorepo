/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import type { IBackgroundApiWebembedCallMessage } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import webembedApi from '@onekeyhq/kit-bg/src/webembeds/instance/webembedApi';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

const handler = async (payload: IJsBridgeMessagePayload) =>
  webembedApi.callWebEmbedApiMethod(
    payload.data as IBackgroundApiWebembedCallMessage,
  );

const init = (times = 0) => {
  if (!window.$onekey && times < 100) {
    setTimeout(() => {
      init(times + 1);
    }, 10);
    return;
  }
  window.$onekey.$private.webembedReceiveHandler = handler;
  window.$onekey.$private.request({
    method: 'webEmbedApiReady',
  });
};

init();
