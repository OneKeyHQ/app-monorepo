import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { promisify } from 'util';

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
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { isAllowedWebViewUrl } from '@onekeyhq/shared/src/utils/webViewUrlSafety';

// @ts-expect-error text-js module imported as string by babel-plugin-inline-import / esbuild
import injectedDesktopCode from './injectedDesktopCode.text-js';

import type { IDesktopApi } from './instance/IDesktopApi';

const execFileAsync = promisify(execFile);
const CUSTOM_INJECTED_MANIFEST = 'onekey-app-custom-injected.json';
const CUSTOM_INJECTED_MANIFEST_MAX_BYTES = 128 * 1024;
const CUSTOM_INJECTED_REGISTRY_MAX_BYTES = 32 * 1024 * 1024;
const CUSTOM_INJECTED_PRELOAD_MAX_BYTES = 64 * 1024 * 1024;
const CUSTOM_INJECTED_UPDATER_MAX_BYTES = 1024 * 1024;

type ICustomInjectedManifest = {
  schemaVersion: 1;
  kind: 'onekey-app-custom-injected';
  protocolRegistry: string;
  registryUpdater: string;
  desktopPreload: string;
};

export type ICustomInjectedProtocol = {
  id: string;
  name: string;
  slug: string;
  url: string;
  urlSource: 'override' | 'resolved' | 'defillama';
  totalTvl: number;
  bestRank: number | null;
  manualReview: {
    state: 'pending' | 'processed';
    reviewedAt: string | null;
    reviewedUrl: string | null;
    injectedBundleSha256: string | null;
  };
};

export type ICustomInjectedSession = {
  sessionId: string;
  workspace: string;
  registrySha256: string;
  bundleSha256: string;
  preloadUrl: string;
  protocols: ICustomInjectedProtocol[];
};

export type ICustomInjectedWorkspacePreview = {
  sessionId: string;
  workspace: string;
  protocolRegistry: string;
  desktopPreload: string;
  protocolCount: number;
  pendingCount: number;
  bundleSha256: string;
};

export type ICustomInjectedProtocolUpdate =
  | {
      action: 'set-url';
      sessionId: string;
      protocolId: string;
      expectedRegistrySha256: string;
      url: string | null;
    }
  | {
      action: 'set-review';
      sessionId: string;
      protocolId: string;
      expectedRegistrySha256: string;
      state: 'pending' | 'processed';
      reviewedUrl?: string;
      bundleSha256?: string;
    };

type ICustomInjectedWorkspaceSession = {
  sessionId: string;
  workspace: string;
  registryFile: string;
  updaterFile: string;
  preloadFile: string;
  registryStamp: string;
  preloadStamp: string;
  registrySha256: string;
  bundleSha256: string;
  protocols: ICustomInjectedProtocol[];
  active: boolean;
};

const customInjectedSessions = new Map<
  string,
  ICustomInjectedWorkspaceSession
>();

function sha256(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function ensureCustomInjectedEnabled(devSettingsEnabled: boolean) {
  if (devSettingsEnabled !== true) {
    throw new OneKeyLocalError(
      'Custom injection requires enabled developer settings',
    );
  }
}

async function statLimitedFile(
  file: string,
  maxBytes: number,
  label: string,
): Promise<{ stamp: string }> {
  const stat = await fs.stat(file, { bigint: true });
  if (!stat.isFile()) {
    throw new OneKeyLocalError(`${label} must be a regular file`);
  }
  if (stat.size <= 0 || stat.size > BigInt(maxBytes)) {
    throw new OneKeyLocalError(
      `${label} size must be between 1 and ${String(maxBytes)} bytes`,
    );
  }
  return { stamp: `${String(stat.mtimeNs)}:${String(stat.size)}` };
}

async function readLimitedFile(
  file: string,
  maxBytes: number,
  label: string,
): Promise<{ content: Buffer; stamp: string }> {
  const { stamp } = await statLimitedFile(file, maxBytes, label);
  return { content: await fs.readFile(file), stamp };
}

async function resolveWorkspaceFile(
  workspace: string,
  relativePath: string,
  label: string,
): Promise<string> {
  if (
    typeof relativePath !== 'string' ||
    !relativePath ||
    path.isAbsolute(relativePath)
  ) {
    throw new OneKeyLocalError(`${label} must be a relative path`);
  }
  const resolved = await fs.realpath(path.resolve(workspace, relativePath));
  const relative = path.relative(workspace, resolved);
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new OneKeyLocalError(`${label} escapes the selected workspace`);
  }
  return resolved;
}

export function parseCustomInjectedProtocols(
  registryText: string,
): ICustomInjectedProtocol[] {
  const registry = JSON.parse(registryText) as {
    protocols?: Array<{
      id?: unknown;
      name?: unknown;
      slug?: unknown;
      active?: unknown;
      category?: unknown;
      totalTvl?: unknown;
      sourceUrl?: unknown;
      priority?: { bestRank?: unknown };
      target?: {
        urlOverride?: unknown;
        resolvedDappUrl?: unknown;
      };
      manualReview?: {
        state?: unknown;
        reviewedAt?: unknown;
        reviewedUrl?: unknown;
        injectedBundleSha256?: unknown;
      };
    }>;
  };
  if (!Array.isArray(registry.protocols)) {
    throw new OneKeyLocalError(
      'Custom injection registry must contain a protocols array',
    );
  }
  const seenHostnames = new Set<string>();
  return registry.protocols.flatMap((protocol) => {
    const id = String(protocol.id || '').trim();
    if (
      !id ||
      protocol.active !== true ||
      String(protocol.category || '').toLowerCase() === 'cex'
    ) {
      return [];
    }
    const override = String(protocol.target?.urlOverride || '');
    const resolved = String(protocol.target?.resolvedDappUrl || '');
    const source = String(protocol.sourceUrl || '');
    const url = override || resolved || source;
    if (!isAllowedWebViewUrl(url)) {
      return [];
    }
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./u, '');
    if (seenHostnames.has(hostname)) {
      return [];
    }
    seenHostnames.add(hostname);
    const manualState =
      protocol.manualReview?.state === 'processed' ? 'processed' : 'pending';
    let urlSource: ICustomInjectedProtocol['urlSource'] = 'defillama';
    if (override) {
      urlSource = 'override';
    } else if (resolved) {
      urlSource = 'resolved';
    }
    return [
      {
        id,
        name: String(protocol.name || protocol.slug || protocol.id || ''),
        slug: String(protocol.slug || protocol.name || protocol.id || ''),
        url,
        urlSource,
        totalTvl: Number(protocol.totalTvl || 0),
        bestRank: Number.isFinite(Number(protocol.priority?.bestRank))
          ? Number(protocol.priority?.bestRank)
          : null,
        manualReview: {
          state: manualState,
          reviewedAt:
            typeof protocol.manualReview?.reviewedAt === 'string'
              ? protocol.manualReview.reviewedAt
              : null,
          reviewedUrl:
            typeof protocol.manualReview?.reviewedUrl === 'string'
              ? protocol.manualReview.reviewedUrl
              : null,
          injectedBundleSha256:
            typeof protocol.manualReview?.injectedBundleSha256 === 'string'
              ? protocol.manualReview.injectedBundleSha256
              : null,
        },
      } satisfies ICustomInjectedProtocol,
    ];
  });
}

async function refreshCustomInjectedSession(
  customSession: ICustomInjectedWorkspaceSession,
): Promise<void> {
  const [registryFile, preloadFile] = await Promise.all([
    statLimitedFile(
      customSession.registryFile,
      CUSTOM_INJECTED_REGISTRY_MAX_BYTES,
      'Protocol registry',
    ),
    statLimitedFile(
      customSession.preloadFile,
      CUSTOM_INJECTED_PRELOAD_MAX_BYTES,
      'Desktop preload',
    ),
  ]);
  if (registryFile.stamp !== customSession.registryStamp) {
    const registryText = await fs.readFile(customSession.registryFile, 'utf8');
    customSession.protocols = parseCustomInjectedProtocols(registryText);
    customSession.registrySha256 = sha256(registryText);
    customSession.registryStamp = registryFile.stamp;
  }
  if (preloadFile.stamp !== customSession.preloadStamp) {
    customSession.bundleSha256 = sha256(
      await fs.readFile(customSession.preloadFile),
    );
    customSession.preloadStamp = preloadFile.stamp;
  }
}

function publicCustomInjectedSession(
  customSession: ICustomInjectedWorkspaceSession,
): ICustomInjectedSession {
  return {
    sessionId: customSession.sessionId,
    workspace: customSession.workspace,
    registrySha256: customSession.registrySha256,
    bundleSha256: customSession.bundleSha256,
    preloadUrl: `${pathToFileURL(customSession.preloadFile).href}?sha256=${
      customSession.bundleSha256
    }`,
    protocols: customSession.protocols,
  };
}

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

  async getInjectedJsContent(): Promise<string> {
    return injectedDesktopCode as string;
  }

  async prepareCustomInjectedWorkspace(
    workspacePath: string,
    devSettingsEnabled: boolean,
  ): Promise<ICustomInjectedWorkspacePreview> {
    ensureCustomInjectedEnabled(devSettingsEnabled);
    if (typeof workspacePath !== 'string' || !path.isAbsolute(workspacePath)) {
      throw new OneKeyLocalError(
        'Custom injection workspace must be an absolute path',
      );
    }
    const workspace = await fs.realpath(workspacePath);
    const workspaceStat = await fs.stat(workspace);
    if (!workspaceStat.isDirectory()) {
      throw new OneKeyLocalError(
        'Custom injection workspace must be a directory',
      );
    }
    const manifestFile = path.join(workspace, CUSTOM_INJECTED_MANIFEST);
    const manifestContent = await readLimitedFile(
      manifestFile,
      CUSTOM_INJECTED_MANIFEST_MAX_BYTES,
      'Custom injection manifest',
    );
    const manifest = JSON.parse(
      manifestContent.content.toString('utf8'),
    ) as ICustomInjectedManifest;
    if (
      manifest.schemaVersion !== 1 ||
      manifest.kind !== 'onekey-app-custom-injected'
    ) {
      throw new OneKeyLocalError('Unsupported custom injection manifest');
    }
    const [registryFile, updaterFile, preloadFile] = await Promise.all([
      resolveWorkspaceFile(
        workspace,
        manifest.protocolRegistry,
        'protocolRegistry',
      ),
      resolveWorkspaceFile(
        workspace,
        manifest.registryUpdater,
        'registryUpdater',
      ),
      resolveWorkspaceFile(
        workspace,
        manifest.desktopPreload,
        'desktopPreload',
      ),
    ]);
    await readLimitedFile(
      updaterFile,
      CUSTOM_INJECTED_UPDATER_MAX_BYTES,
      'Registry updater',
    );
    const customSession: ICustomInjectedWorkspaceSession = {
      sessionId: crypto.randomUUID(),
      workspace,
      registryFile,
      updaterFile,
      preloadFile,
      registryStamp: '',
      preloadStamp: '',
      registrySha256: '',
      bundleSha256: '',
      protocols: [],
      active: false,
    };
    await refreshCustomInjectedSession(customSession);
    if (customSession.protocols.length === 0) {
      throw new OneKeyLocalError(
        'Custom injection registry has no supported active protocols',
      );
    }
    customInjectedSessions.set(customSession.sessionId, customSession);
    return {
      sessionId: customSession.sessionId,
      workspace,
      protocolRegistry: path.relative(workspace, registryFile),
      desktopPreload: path.relative(workspace, preloadFile),
      protocolCount: customSession.protocols.length,
      pendingCount: customSession.protocols.filter(
        (protocol) => protocol.manualReview.state === 'pending',
      ).length,
      bundleSha256: customSession.bundleSha256,
    };
  }

  async activateCustomInjectedWorkspace(
    sessionId: string,
  ): Promise<ICustomInjectedSession> {
    const customSession = customInjectedSessions.get(sessionId);
    if (!customSession) {
      throw new OneKeyLocalError('Custom injection session not found');
    }
    customSession.active = true;
    await refreshCustomInjectedSession(customSession);
    return publicCustomInjectedSession(customSession);
  }

  async getCustomInjectedWorkspace(
    sessionId: string,
  ): Promise<ICustomInjectedSession> {
    const customSession = customInjectedSessions.get(sessionId);
    if (!customSession?.active) {
      throw new OneKeyLocalError('Custom injection session is not active');
    }
    await refreshCustomInjectedSession(customSession);
    return publicCustomInjectedSession(customSession);
  }

  async updateCustomInjectedProtocol(
    update: ICustomInjectedProtocolUpdate,
  ): Promise<ICustomInjectedSession> {
    const customSession = customInjectedSessions.get(update.sessionId);
    if (!customSession?.active) {
      throw new OneKeyLocalError('Custom injection session is not active');
    }
    const args = [
      customSession.updaterFile,
      '--file',
      customSession.registryFile,
      '--protocol-id',
      update.protocolId,
      '--expected-sha256',
      update.expectedRegistrySha256,
      '--action',
      update.action,
    ];
    if (update.action === 'set-url') {
      if (update.url) {
        if (!isAllowedWebViewUrl(update.url)) {
          throw new OneKeyLocalError(
            'Custom injection protocol URL must be a safe HTTPS URL',
          );
        }
        args.push('--url', update.url);
      } else {
        args.push('--clear-url');
      }
    } else {
      args.push('--state', update.state);
      if (update.state === 'processed') {
        if (!update.reviewedUrl || !update.bundleSha256) {
          throw new OneKeyLocalError(
            'Processed review requires reviewed URL and bundle SHA-256',
          );
        }
        args.push(
          '--reviewed-url',
          update.reviewedUrl,
          '--bundle-sha256',
          update.bundleSha256,
        );
      }
    }
    try {
      await execFileAsync(process.execPath, args, {
        cwd: customSession.workspace,
        encoding: 'utf8',
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
        },
        maxBuffer: 1024 * 1024,
        timeout: 30_000,
      });
    } catch (error) {
      const detail =
        (error as { stderr?: string; message?: string }).stderr ||
        (error as Error).message;
      throw new OneKeyLocalError(
        `Failed to update custom injection registry: ${detail}`,
      );
    }
    customSession.registryStamp = '';
    await refreshCustomInjectedSession(customSession);
    return publicCustomInjectedSession(customSession);
  }

  async closeCustomInjectedWorkspace(sessionId: string): Promise<void> {
    customInjectedSessions.delete(sessionId);
  }
}

export default DesktopApiNetwork;
