import fs from 'fs';
import path from 'path';

import { session } from 'electron';

import {
  checkFileHash,
  getBundleDirPath,
  getDriveLetter,
  getMetadata,
} from '@onekeyhq/desktop/app/bundle';
import * as store from '@onekeyhq/desktop/app/libs/store';
import { getStaticPath } from '@onekeyhq/desktop/app/resoucePath';
import { IDesktopStoreUpdateBundleData } from '@onekeyhq/shared/types/desktop';

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
    return new Promise((resolve, reject) => {
      fs.readFile(preloadJsPath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        }
        resolve(data);
      });
    });
  }
}

export default DesktopApiNetwork;
