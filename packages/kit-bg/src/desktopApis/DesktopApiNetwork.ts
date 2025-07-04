import { ipcRenderer } from 'electron';

import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';

class DesktopApiNetwork {
  setAllowedPhishingUrls(urls: string[]): void {
    ipcRenderer.send(ipcMessageKeys.SET_ALLOWED_PHISHING_URLS, urls);
  }

  touchUpdateResource(params: {
    resourceUrl: string;
    dialogTitle: string;
    buttonLabel: string;
  }): void {
    ipcRenderer.send(ipcMessageKeys.TOUCH_RES, params);
  }
}

export default DesktopApiNetwork;