/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions, import/order */
import '@onekeyhq/shared/src/polyfills';

import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { startKeepAlivePolling } from '../background/keepAlive';
import { offscreenSetup } from '../offscreen/offscreenSetup';

// send a message every 20 sec to service worker
startKeepAlivePolling();

const offscreenBridge = offscreenSetup();

let timer: any = null;
// background may be down or reloaded (like hot reloading)
// so we need reconnect to background by reload offscreen page
function checkPortEstablished() {
  // @ts-ignore
  if (!offscreenBridge?.portToBg) {
    clearInterval(timer);
    window.location.reload();
  }
}
timer = setInterval(
  checkPortEstablished,
  timerUtils.getTimeDurationMs({ seconds: 5 }),
);
// console.log('offscreen');
