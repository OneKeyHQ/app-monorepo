import path from 'path';

import { session, webContents } from 'electron';
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
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

// @ts-expect-error text-js module imported as string by babel-plugin-inline-import / esbuild
import injectedDesktopCode from './injectedDesktopCode.text-js';

import type { IDesktopApi } from './instance/IDesktopApi';

let templatePhishingUrls: string[] = [];
let fiatPaySiteWhitelistOrigins = new Set<string>();
let fiatPaySiteWhitelistDomainKeys = new Set<string>();

export function getTemplatePhishingUrls(): string[] {
  return templatePhishingUrls;
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.+$/u, '');
}

function isIpHostname(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(hostname) || hostname.includes(':');
}

function getHostnameDomainKey(hostname: string): string {
  const normalized = normalizeHostname(hostname);
  if (!normalized || isIpHostname(normalized)) {
    return normalized;
  }
  const labels = normalized.split('.').filter(Boolean);
  if (labels.length <= 2) {
    return normalized;
  }
  const tld = labels[labels.length - 1];
  const sld = labels[labels.length - 2];
  return tld.length === 2 && sld.length <= 3
    ? labels.slice(-3).join('.')
    : labels.slice(-2).join('.');
}

export function getOriginDomainKey(origin: string): string {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return '';
    }
    const domainKey = getHostnameDomainKey(url.hostname);
    return domainKey ? `${url.protocol}//${domainKey}` : '';
  } catch {
    return '';
  }
}

export function getFiatPaySiteWhitelistOrigins(): Set<string> {
  return fiatPaySiteWhitelistOrigins;
}

export function getFiatPaySiteWhitelistDomainKeys(): Set<string> {
  return fiatPaySiteWhitelistDomainKeys;
}

class DesktopApiNetwork {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
  }

  desktopApi: IDesktopApi;

  async setAllowedPhishingUrls(urls: string[]): Promise<string[]> {
    if (Array.isArray(urls)) {
      templatePhishingUrls = urls;
    }
    return templatePhishingUrls;
  }

  async setFiatPaySiteWhitelist(origins: string[]): Promise<void> {
    fiatPaySiteWhitelistOrigins = new Set(
      Array.isArray(origins) ? origins : [],
    );
    fiatPaySiteWhitelistDomainKeys = new Set(
      [...fiatPaySiteWhitelistOrigins].map(getOriginDomainKey).filter(Boolean),
    );
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
    return isDev
      ? `file://${preloadJsPath}?t=${Date.now()}`
      : `file://${preloadJsPath}`;
  }

  async getInjectedJsContent(): Promise<string> {
    return injectedDesktopCode as string;
  }

  async toggleDevTools(
    webContentsId: number,
    devSettingsEnabled: boolean,
  ): Promise<'closed' | 'opened'> {
    if (devSettingsEnabled !== true) {
      throw new OneKeyLocalError(
        'WebView DevTools require enabled developer settings',
      );
    }
    const guest = webContents.fromId(webContentsId);
    if (!guest || guest.isDestroyed() || guest.getType() !== 'webview') {
      throw new OneKeyLocalError('WebView is not available');
    }
    if (guest.isDevToolsOpened()) {
      guest.closeDevTools();
      return 'closed';
    }
    guest.openDevTools({ mode: 'detach', activate: true });
    guest.devToolsWebContents?.focus();
    return 'opened';
  }
}

export default DesktopApiNetwork;
