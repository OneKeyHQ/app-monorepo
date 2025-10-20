import path from 'path';

import { session } from 'electron';
import isDev from 'electron-is-dev';
import logger from 'electron-log/main';

import {
  checkFileHash,
  getBundleDirPath,
  getDriveLetter,
  getMetadata,
} from '@onekeyhq/desktop/app/bundle';
import * as store from '@onekeyhq/desktop/app/libs/store';
import { getStaticPath } from '@onekeyhq/desktop/app/resoucePath';

import type { IDesktopApi } from './instance/IDesktopApi';

let templatePhishingUrls: string[] = [];

export function getTemplatePhishingUrls(): string[] {
  return templatePhishingUrls;
}

class DesktopApiNetwork {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
  }

  desktopApi: IDesktopApi;

  // WEBVIEW_NEW_WINDOW: 'webview/newWindow',
  // SET_ALLOWED_PHISHING_URLS: 'webview/setAllowedPhishingUrls',
  // CLEAR_WEBVIEW_CACHE: 'webview/clearCache',

  async setAllowedPhishingUrls(urls: string[]): Promise<string[]> {
    if (Array.isArray(urls)) {
      templatePhishingUrls = urls;
    }
    return templatePhishingUrls;
  }

  async clearWebViewCache(): Promise<void> {
    await session.defaultSession.clearStorageData({
      storages: ['cookies', 'cachestorage'],
    });
  }

  async getPreloadJsContent(): Promise<string> {
    const staticPath = getStaticPath();
    const preloadJsPath = path.join(staticPath, 'preload.js');
    logger.info('getPreloadJsContent', preloadJsPath);
    if (globalThis.$desktopMainAppFunctions?.useJsBundle?.()) {
      const bundleDirPath = getBundleDirPath();
      const bundleData = store.getUpdateBundleData();
      const metadata = bundleDirPath
        ? await getMetadata({
            bundleDir: bundleDirPath,
            appVersion: bundleData.appVersion,
            bundleVersion: bundleData.bundleVersion,
            signature: bundleData.signature,
          })
        : {};
      const driveLetter = getDriveLetter();
      checkFileHash({
        bundleDirPath,
        metadata,
        driveLetter,
        url: preloadJsPath.replace(`${bundleDirPath}/`, ''),
      });
    }
    // ref: https://github.com/electron/electron/blob/7e031f7e33dcc66cbe5e0e4153a0fc0544618612/lib/sandboxed_renderer/preload.ts#L47
    // Add timestamp to prevent Node.js require cache from loading the same file only once
    return isDev
      ? `file://${preloadJsPath}?t=${Date.now()}`
      : `file://${preloadJsPath}`;
  }
}

export default DesktopApiNetwork;
