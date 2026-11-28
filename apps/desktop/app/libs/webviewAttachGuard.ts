import path from 'path';
import { fileURLToPath } from 'url';

import type { Event, WebPreferences } from 'electron';

type ILoggerLike = {
  warn: (...args: unknown[]) => void;
};

type IWebPreferencesWithExtras = WebPreferences & {
  enableBlinkFeatures?: string;
};

const ALLOWED_WEBVIEW_SRC_PROTOCOLS = new Set(['http:', 'https:']);

export function isAllowedWebviewAttachSrc(src: unknown): boolean {
  if (typeof src !== 'string' || !src.trim()) {
    return true;
  }
  const trimmed = src.trim();
  if (trimmed === 'about:blank') {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return ALLOWED_WEBVIEW_SRC_PROTOCOLS.has(parsed.protocol.toLowerCase());
  } catch {
    return false;
  }
}

export function normalizePreloadPath(
  rawPreload: string,
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  const pathImpl = platform === 'win32' ? path.win32 : path.posix;
  const trimmed = rawPreload.trim();
  if (!trimmed) {
    return undefined;
  }
  if (/^file:/i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      parsed.search = '';
      parsed.hash = '';
      return pathImpl.normalize(fileURLToPath(parsed));
    } catch {
      return undefined;
    }
  }
  return pathImpl.resolve(trimmed);
}

export function isSameFsPath(
  a: string,
  b: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  const pathImpl = platform === 'win32' ? path.win32 : path.posix;
  const normA = pathImpl.normalize(a);
  const normB = pathImpl.normalize(b);
  if (platform === 'win32') {
    return normA.toLowerCase() === normB.toLowerCase();
  }
  return normA === normB;
}

export function createWillAttachWebviewHandler(deps: {
  getTrustedPreloadPath: () => string;
  logger: ILoggerLike;
  platform?: NodeJS.Platform;
}) {
  const platform = deps.platform ?? process.platform;
  return (
    event: Pick<Event, 'preventDefault'>,
    webPreferences: IWebPreferencesWithExtras,
    params?: Record<string, string>,
  ) => {
    if (params && !isAllowedWebviewAttachSrc(params.src)) {
      deps.logger.warn(
        '[will-attach-webview] Blocked disallowed webview src:',
        params.src,
      );
      event.preventDefault();
      return;
    }

    // Enforce sandboxed webview defaults regardless of renderer attributes.
    webPreferences.nodeIntegration = false;
    webPreferences.nodeIntegrationInWorker = false;
    webPreferences.nodeIntegrationInSubFrames = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.webSecurity = true;
    webPreferences.allowRunningInsecureContent = false;
    webPreferences.experimentalFeatures = false;
    webPreferences.plugins = false;
    webPreferences.webviewTag = false;
    delete webPreferences.enableBlinkFeatures;

    if (webPreferences.preload) {
      const trustedPreloadPath = deps.getTrustedPreloadPath();
      const normalizedRequested = normalizePreloadPath(
        webPreferences.preload,
        platform,
      );
      if (
        !normalizedRequested ||
        !isSameFsPath(normalizedRequested, trustedPreloadPath, platform)
      ) {
        deps.logger.warn(
          '[will-attach-webview] Stripping untrusted preload path:',
          webPreferences.preload,
        );
        delete webPreferences.preload;
        return;
      }
      webPreferences.preload = trustedPreloadPath;
    }
  };
}
