/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions, import/order */
import '@onekeyhq/shared/src/polyfills';

import { offscreenSetup } from '../offscreen/offscreenSetup';
import { startKeepAlivePolling } from '../background/keepAlive';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';

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
timer = setInterval(checkPortEstablished, getTimeDurationMs({ seconds: 5 }));
