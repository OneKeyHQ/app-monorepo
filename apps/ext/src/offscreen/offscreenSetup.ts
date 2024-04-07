/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unused-vars */
import { bridgeSetup } from '@onekeyfe/extension-bridge-hosted';

import type { IOffscreenApiMessagePayload } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import offscreenApi from '@onekeyhq/kit-bg/src/offscreens/instance/offscreenApi';
import { OFFSCREEN_API_MESSAGE_TYPE } from '@onekeyhq/kit-bg/src/offscreens/types';

export function offscreenSetup() {
  const offscreenBridge = bridgeSetup.offscreen.createOffscreenJsBridge({
    onPortConnect() {},
    async receiveHandler(payload, bridge) {
      const msg = payload.data as IOffscreenApiMessagePayload | undefined;
      if (msg && msg.type === OFFSCREEN_API_MESSAGE_TYPE) {
        const result = await offscreenApi.callOffscreenApiMethod(msg);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return result;
      }
    },
  });
  window.extJsBridgeOffscreenToBg = offscreenBridge;

  return offscreenBridge;

  // chrome.runtime.sendMessage
  // chrome.runtime.onMessage.addListener(
  //   (msg: IOffscreenApiMessagePayload, sender, sendResponse) => {
  //     (async () => {
  //       if (msg && msg.type === OFFSCREEN_API_MESSAGE_TYPE) {
  //         const { module, method, params } = msg;
  //         const sdk: any = await getModuleByName(module);
  //         if (sdk && sdk[method]) {
  //           const result = await sdk[method](...params);
  //           sendResponse(result);
  //         } else {
  //           throw new Error(
  //             `offscreen module method not found: ${module}.${method}()`,
  //           );
  //         }
  //       }
  //     })();
  //
  //     // **** return true to indicate that sendResponse is async
  //     return true;
  //   },
  // );
}
