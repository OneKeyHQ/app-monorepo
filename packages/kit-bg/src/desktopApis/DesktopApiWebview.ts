import { pathToFileURL } from 'url';

import { app, session } from 'electron';
import electronIsDev from 'electron-is-dev';
import logger from 'electron-log/main';

import { getWebviewPreloadPath } from '@onekeyhq/desktop/app/resoucePath';

// @ts-expect-error text-js module imported as string by babel-plugin-inline-import / esbuild
import injectedDesktopCode from './injectedDesktopCode.text-js';

import type { IDesktopApi } from './instance/IDesktopApi';

const isDev = !app?.isPackaged && electronIsDev;

let templatePhishingUrls: string[] = [];

export function getTemplatePhishingUrls(): string[] {
  return templatePhishingUrls;
}

let fiatPaySiteWhitelistOrigins: Set<string> = new Set();
let fiatPaySiteWhitelistDomainKeys: Set<string> = new Set();

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.+$/u, '');
}

function isIpHostname(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(hostname) || hostname.includes(':');
}

function getHostnameDomainKey(hostname: string): string {
  const normalized = normalizeHostname(hostname);
  if (!normalized) {
    return '';
  }
  if (isIpHostname(normalized)) {
    return normalized;
  }

  const labels = normalized.split('.').filter(Boolean);
  if (labels.length <= 2) {
    return normalized;
  }

  const tld = labels[labels.length - 1];
  const sld = labels[labels.length - 2];
  // Country-code TLD with short second-level (e.g., "co.uk", "com.au")
  if (tld.length === 2 && sld.length <= 3) {
    return labels.slice(-3).join('.');
  }

  return labels.slice(-2).join('.');
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

  // WEBVIEW_NEW_WINDOW: 'webview/newWindow',
  // SET_ALLOWED_PHISHING_URLS: 'webview/setAllowedPhishingUrls',
  // CLEAR_WEBVIEW_CACHE: 'webview/clearCache',

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
    // Always load webview preload.js from inside the integrity-checked
    // app.asar archive rather than user-writable OTA or loose resources.
    const preloadJsPath = getWebviewPreloadPath();
    logger.info('getPreloadJsContent', preloadJsPath);
    // ref: https://github.com/electron/electron/blob/7e031f7e33dcc66cbe5e0e4153a0fc0544618612/lib/sandboxed_renderer/preload.ts#L47
    // Add timestamp to prevent Node.js require cache from loading the same file only once
    const preloadUrl = pathToFileURL(preloadJsPath).href;
    return isDev ? `${preloadUrl}?t=${Date.now()}` : preloadUrl;
  }

  async getInjectedJsContent(): Promise<string> {
    return injectedDesktopCode as string;
  }
}

export default DesktopApiNetwork;
