import { contextBridge, ipcRenderer } from 'electron';

import {
  DESKTOP_CAPTCHA_MESSAGE_CHANNEL,
  isDesktopCaptchaPage,
  parseCaptchaMessage,
} from '@onekeyhq/shared/src/utils/captchaMessage';

// This guest preload ships in the signed renderer bundle, not the app shell.
export function installCaptchaBridge(): boolean {
  const url = globalThis.location.href;
  if (!isDesktopCaptchaPage(url)) return false;

  // CAPTCHA pages never receive the wallet provider, including child frames
  // and documents without a valid attempt. Only the guest main frame may reply.
  if (!process.isMainFrame) return true;
  const requestId = new URL(url).searchParams.get('requestId');
  const fragmentRequestId = new URLSearchParams(new URL(url).hash.slice(1)).get(
    'requestId',
  );
  if (requestId || !fragmentRequestId) return true;

  contextBridge.exposeInMainWorld('ReactNativeWebView', {
    postMessage(raw: unknown) {
      if (
        globalThis.location.href !== url ||
        typeof raw !== 'string' ||
        raw.length > 4096
      ) {
        return;
      }
      const message = parseCaptchaMessage(raw, fragmentRequestId);
      if (message) {
        ipcRenderer.sendToHost(DESKTOP_CAPTCHA_MESSAGE_CHANNEL, {
          url,
          message,
        });
      }
    },
  });
  return true;
}
