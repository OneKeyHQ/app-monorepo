/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions, import/order */
import '@onekeyhq/shared/src/polyfills';

import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { startKeepAlivePolling } from '../background/keepAlive';
import { offscreenSetup } from '../offscreen/offscreenSetup';

// send a message every 20 sec to service worker
startKeepAlivePolling();

const offscreenBridge = offscreenSetup();

// eslint-disable-next-line prefer-const -- timer is reassigned by setInterval
let timer: NodeJS.Timeout | undefined;
// background may be down or reloaded (like hot reloading)
// so we need reconnect to background by reload offscreen page
function checkPortEstablished() {
  // @ts-ignore
  if (!offscreenBridge?.portToBg) {
    if (timer !== undefined) {
      clearInterval(timer);
    }
    globalThis.location.reload();
  }
}
timer = setInterval(
  checkPortEstablished,
  timerUtils.getTimeDurationMs({ seconds: 5 }),
);
