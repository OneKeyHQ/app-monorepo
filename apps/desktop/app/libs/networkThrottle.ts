import { type Session, type WebContents, session, webContents } from 'electron';
import logger from 'electron-log/main';

import { DESKTOP_WEBVIEW_OVERLAY_PARTITION } from '@onekeyhq/shared/src/consts/desktopWebviewPartitions';
import { devSettingSyncStorage } from '@onekeyhq/shared/src/storage/instance/devSettingSyncStorageInstance';
import { syncStorage } from '@onekeyhq/shared/src/storage/instance/syncStorageInstance';
import {
  EAppSyncStorageKeys,
  EDevSettingSyncStorageKeys,
} from '@onekeyhq/shared/src/storage/syncStorageKeys';
import type {
  IDesktopStoreNetworkThrottle,
  IDesktopStoreNetworkThrottleProfile,
} from '@onekeyhq/shared/types/desktop';

import * as store from './store';

const DESKTOP_WEBVIEW_PARTITION = 'persist:onekey';

type IDesktopNetworkThrottleProfileConfig = {
  offline: false;
  latency: number;
  downloadThroughput: number;
  uploadThroughput: number;
};

type IDesktopNetworkThrottleSessionEntry = {
  label: string;
  targetSession: Session;
};

type IDesktopNetworkThrottleAppliedSession =
  IDesktopNetworkThrottleSessionEntry & {
    stateKey: string;
  };

type IDesktopNetworkThrottleWebContentsEntry = {
  label: string;
  contents: WebContents;
  config: IDesktopStoreNetworkThrottle;
  throwOnFailure?: boolean;
  suppressFailureLog?: boolean;
};

type IDesktopNetworkThrottleWebContentsReapplyEntry = {
  label: string;
  contents: WebContents;
  reason: string;
  attempt?: number;
};

type IApplyDesktopNetworkThrottleOptions = {
  closeConnections?: boolean;
  config?: IDesktopStoreNetworkThrottle;
  throwOnFailure?: boolean;
};

const DESKTOP_NETWORK_THROTTLE_PROFILES: Record<
  IDesktopStoreNetworkThrottleProfile,
  IDesktopNetworkThrottleProfileConfig
> = {
  slow4g: {
    offline: false,
    latency: 562.5,
    downloadThroughput: 180_000,
    uploadThroughput: 84_375,
  },
};

const DEFAULT_NETWORK_THROTTLE_CONFIG: IDesktopStoreNetworkThrottle = {
  enabled: false,
  profile: 'slow4g',
};

const DESKTOP_NETWORK_THROTTLE_DIAGNOSTIC_URL_FILTER = {
  urls: [
    'https://onekeycn.com/*',
    'https://*.onekeycn.com/*',
    'https://onekey.so/*',
    'https://*.onekey.so/*',
  ],
};

const DESKTOP_NETWORK_THROTTLE_DIAGNOSTIC_MAX_REQUEST_LOGS = 2000;
const LOG_URL_MAX_LENGTH = 160;

const appliedStateBySession = new WeakMap<Session, string>();
const appliedStateByWebContentsDebugger = new WeakMap<WebContents, string>();
const diagnosticInstalledSessions = new WeakSet<Session>();
const diagnosticRequestStartedAtBySession = new WeakMap<
  Session,
  Map<number, number>
>();
const webContentsDebuggersAttachedByNetworkThrottle =
  new WeakSet<WebContents>();
const webContentsDebuggersDetachingByNetworkThrottle =
  new WeakSet<WebContents>();
const webContentsDebuggerReapplyTimers = new WeakMap<
  WebContents,
  ReturnType<typeof setTimeout>
>();
const webContentsDebuggerReapplyOnDevToolsClosed = new WeakMap<
  WebContents,
  () => void
>();

const MAX_DEBUGGER_REAPPLY_ATTEMPTS = 10;

let runtimeNetworkThrottleConfig: IDesktopStoreNetworkThrottle | undefined;
let desktopNetworkThrottleDiagnosticRequestLogCount = 0;
let desktopNetworkThrottleDiagnosticRequestLimitLogged = false;

function normalizeDesktopNetworkThrottleConfig(
  config: Partial<IDesktopStoreNetworkThrottle> | undefined,
): IDesktopStoreNetworkThrottle {
  return {
    enabled: Boolean(config?.enabled),
    profile: config?.profile === 'slow4g' ? config.profile : 'slow4g',
  };
}

function isDeveloperModeEnabledForNetworkThrottle(): boolean {
  const devSettingEnabled = devSettingSyncStorage.getBoolean(
    EDevSettingSyncStorageKeys.onekey_developer_mode_enabled,
  );
  if (devSettingEnabled !== undefined) {
    return devSettingEnabled;
  }
  return (
    syncStorage.getBoolean(
      EAppSyncStorageKeys.onekey_developer_mode_enabled,
    ) === true
  );
}

function applyDeveloperModeGateToNetworkThrottleConfig(
  config: IDesktopStoreNetworkThrottle,
): IDesktopStoreNetworkThrottle {
  if (!config.enabled || isDeveloperModeEnabledForNetworkThrottle()) {
    return config;
  }
  return DEFAULT_NETWORK_THROTTLE_CONFIG;
}

function getDesktopNetworkThrottleEnvConfig():
  | IDesktopStoreNetworkThrottle
  | undefined {
  const envValue = process.env.ONEKEY_DESKTOP_NETWORK_THROTTLE?.trim();
  if (!envValue) {
    return undefined;
  }

  const normalizedEnvValue = envValue.toLowerCase();
  if (['1', 'true', 'on', 'enabled', 'slow4g'].includes(normalizedEnvValue)) {
    return {
      enabled: true,
      profile: 'slow4g',
    };
  }
  if (['0', 'false', 'off', 'disabled', 'none'].includes(normalizedEnvValue)) {
    return DEFAULT_NETWORK_THROTTLE_CONFIG;
  }

  logger.warn(
    '[desktop-network-throttle] ignored unknown ONEKEY_DESKTOP_NETWORK_THROTTLE value:',
    envValue,
  );
  return undefined;
}

function getRuntimeNetworkThrottleConfig(): IDesktopStoreNetworkThrottle {
  const envConfig = getDesktopNetworkThrottleEnvConfig();
  if (envConfig) {
    return normalizeDesktopNetworkThrottleConfig(envConfig);
  }

  runtimeNetworkThrottleConfig ??=
    applyDeveloperModeGateToNetworkThrottleConfig(
      normalizeDesktopNetworkThrottleConfig(store.getNetworkThrottle()),
    );
  return runtimeNetworkThrottleConfig;
}

function getSessionStateKey(config: IDesktopStoreNetworkThrottle): string {
  return config.enabled ? config.profile : 'disabled';
}

function getDiagnosticThrottleStateText(
  config: IDesktopStoreNetworkThrottle = getRuntimeNetworkThrottleConfig(),
): string {
  if (!config.enabled) {
    return 'state=disabled';
  }

  const profile = DESKTOP_NETWORK_THROTTLE_PROFILES[config.profile];
  return (
    `state=${config.profile} latencyMs=${profile.latency} ` +
    `downloadBps=${profile.downloadThroughput} ` +
    `uploadBps=${profile.uploadThroughput}`
  );
}

function getSanitizedDiagnosticUrl(urlText: string): string {
  try {
    const parsedUrl = new URL(urlText);
    return `${parsedUrl.host}${parsedUrl.pathname}`.slice(
      0,
      LOG_URL_MAX_LENGTH,
    );
  } catch {
    const [withoutQuery] = urlText.split('?');
    const [withoutHash] = withoutQuery.split('#');
    return (withoutHash || '<unknown>').slice(0, LOG_URL_MAX_LENGTH);
  }
}

function shouldLogDesktopNetworkThrottleDiagnosticUrl(
  urlText: string,
): boolean {
  try {
    const parsedUrl = new URL(urlText);
    const host = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.toLowerCase();
    if (
      !(
        host === 'onekeycn.com' ||
        host.endsWith('.onekeycn.com') ||
        host === 'onekey.so' ||
        host.endsWith('.onekey.so')
      )
    ) {
      return false;
    }
    if (
      /\.(?:avif|css|gif|ico|jpeg|jpg|js|map|png|svg|webp|woff|woff2)$/u.test(
        pathname,
      )
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function getDiagnosticRequestStartMap(targetSession: Session) {
  let requestStartedAt = diagnosticRequestStartedAtBySession.get(targetSession);
  if (!requestStartedAt) {
    requestStartedAt = new Map<number, number>();
    diagnosticRequestStartedAtBySession.set(targetSession, requestStartedAt);
  }
  return requestStartedAt;
}

function canLogDesktopNetworkThrottleDiagnosticRequest(): boolean {
  if (
    desktopNetworkThrottleDiagnosticRequestLogCount <
    DESKTOP_NETWORK_THROTTLE_DIAGNOSTIC_MAX_REQUEST_LOGS
  ) {
    desktopNetworkThrottleDiagnosticRequestLogCount += 1;
    return true;
  }

  if (!desktopNetworkThrottleDiagnosticRequestLimitLogged) {
    desktopNetworkThrottleDiagnosticRequestLimitLogged = true;
    logger.info(
      `[desktop-network-throttle-diagnostic] main-webRequest log limit reached max=${DESKTOP_NETWORK_THROTTLE_DIAGNOSTIC_MAX_REQUEST_LOGS}`,
    );
  }
  return false;
}

function installDesktopNetworkThrottleDiagnosticsForSession(
  targetSession: Session,
  label: string,
): void {
  if (diagnosticInstalledSessions.has(targetSession)) {
    return;
  }
  diagnosticInstalledSessions.add(targetSession);

  const requestStartedAt = getDiagnosticRequestStartMap(targetSession);
  logger.info(
    `[desktop-network-throttle-diagnostic] main-webRequest installed session=${label} ${getDiagnosticThrottleStateText()}`,
  );

  targetSession.webRequest.onBeforeRequest(
    DESKTOP_NETWORK_THROTTLE_DIAGNOSTIC_URL_FILTER,
    (details, callback) => {
      if (
        shouldLogDesktopNetworkThrottleDiagnosticUrl(details.url) &&
        canLogDesktopNetworkThrottleDiagnosticRequest()
      ) {
        requestStartedAt.set(details.id, Date.now());
        logger.info(
          `[desktop-network-throttle-diagnostic] main-webRequest-start session=${label} id=${details.id} method=${details.method} resourceType=${details.resourceType} webContentsId=${details.webContentsId} url=${getSanitizedDiagnosticUrl(details.url)} ${getDiagnosticThrottleStateText()}`,
        );
      }
      callback({ cancel: false });
    },
  );

  targetSession.webRequest.onCompleted(
    DESKTOP_NETWORK_THROTTLE_DIAGNOSTIC_URL_FILTER,
    (details) => {
      if (!shouldLogDesktopNetworkThrottleDiagnosticUrl(details.url)) {
        return;
      }
      const startedAt = requestStartedAt.get(details.id);
      if (!startedAt) {
        return;
      }
      requestStartedAt.delete(details.id);
      const durationMs = Date.now() - startedAt;
      logger.info(
        `[desktop-network-throttle-diagnostic] main-webRequest-completed session=${label} id=${details.id} method=${details.method} resourceType=${details.resourceType} webContentsId=${details.webContentsId} statusCode=${details.statusCode} durationMs=${durationMs} url=${getSanitizedDiagnosticUrl(details.url)} ${getDiagnosticThrottleStateText()}`,
      );
    },
  );

  targetSession.webRequest.onErrorOccurred(
    DESKTOP_NETWORK_THROTTLE_DIAGNOSTIC_URL_FILTER,
    (details) => {
      if (!shouldLogDesktopNetworkThrottleDiagnosticUrl(details.url)) {
        return;
      }
      const startedAt = requestStartedAt.get(details.id);
      if (!startedAt) {
        return;
      }
      requestStartedAt.delete(details.id);
      const durationMs = Date.now() - startedAt;
      logger.info(
        `[desktop-network-throttle-diagnostic] main-webRequest-error session=${label} id=${details.id} method=${details.method} resourceType=${details.resourceType} webContentsId=${details.webContentsId} durationMs=${durationMs} error=${details.error} url=${getSanitizedDiagnosticUrl(details.url)} ${getDiagnosticThrottleStateText()}`,
      );
    },
  );
}

function getSessionAppliedLogMessage(
  config: IDesktopStoreNetworkThrottle,
  label: string,
): string {
  if (!config.enabled) {
    return `[desktop-network-throttle] applied state=disabled session=${label}`;
  }

  const profile = DESKTOP_NETWORK_THROTTLE_PROFILES[config.profile];
  return (
    `[desktop-network-throttle] applied state=${config.profile} ` +
    `session=${label} latencyMs=${profile.latency} ` +
    `downloadBps=${profile.downloadThroughput} ` +
    `uploadBps=${profile.uploadThroughput}`
  );
}

function getWebContentsAppliedLogMessage(
  config: IDesktopStoreNetworkThrottle,
  label: string,
): string {
  if (!config.enabled) {
    return `[desktop-network-throttle] debugger applied state=disabled webContents=${label}`;
  }

  const profile = DESKTOP_NETWORK_THROTTLE_PROFILES[config.profile];
  return (
    `[desktop-network-throttle] debugger applied state=${config.profile} ` +
    `webContents=${label} latencyMs=${profile.latency} ` +
    `downloadBps=${profile.downloadThroughput} ` +
    `uploadBps=${profile.uploadThroughput}`
  );
}

function getDebuggerNetworkConditions(config: IDesktopStoreNetworkThrottle) {
  if (!config.enabled) {
    return {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    };
  }

  return DESKTOP_NETWORK_THROTTLE_PROFILES[config.profile];
}

function shouldApplyDebuggerNetworkThrottle(contents: WebContents): boolean {
  if (contents.isDestroyed()) {
    return false;
  }

  const url = contents.getURL();
  if (contents.getType() === 'remote' || url.startsWith('devtools://')) {
    return false;
  }

  return true;
}

function clearDesktopNetworkThrottleDebuggerReapply(
  contents: WebContents,
): void {
  const timer = webContentsDebuggerReapplyTimers.get(contents);
  if (timer) {
    clearTimeout(timer);
    webContentsDebuggerReapplyTimers.delete(contents);
  }
  const onDevToolsClosed =
    webContentsDebuggerReapplyOnDevToolsClosed.get(contents);
  if (onDevToolsClosed) {
    contents.off('devtools-closed', onDevToolsClosed);
    webContentsDebuggerReapplyOnDevToolsClosed.delete(contents);
  }
}

function scheduleDesktopNetworkThrottleDebuggerReapply({
  contents,
  label,
  reason,
  attempt = 0,
}: IDesktopNetworkThrottleWebContentsReapplyEntry): void {
  if (!shouldApplyDebuggerNetworkThrottle(contents)) {
    return;
  }

  const config = getRuntimeNetworkThrottleConfig();
  if (!config.enabled) {
    return;
  }

  clearDesktopNetworkThrottleDebuggerReapply(contents);

  const targetLabel = `${label}:${contents.id}:${contents.getType()}`;
  if (contents.isDevToolsOpened()) {
    const onDevToolsClosed = () => {
      webContentsDebuggerReapplyOnDevToolsClosed.delete(contents);
      scheduleDesktopNetworkThrottleDebuggerReapply({
        contents,
        label,
        reason,
      });
    };
    webContentsDebuggerReapplyOnDevToolsClosed.set(contents, onDevToolsClosed);
    contents.once('devtools-closed', onDevToolsClosed);
    logger.info(
      `[desktop-network-throttle] waiting for DevTools to close before debugger reapply webContents=${targetLabel} reason=${reason}`,
    );
    return;
  }

  if (attempt >= MAX_DEBUGGER_REAPPLY_ATTEMPTS) {
    logger.warn(
      `[desktop-network-throttle] stopped debugger reapply after max attempts webContents=${targetLabel} reason=${reason} attempts=${attempt}`,
    );
    return;
  }

  const retryDelay = Math.min(250 * (attempt + 1), 2000);
  const timer = setTimeout(() => {
    webContentsDebuggerReapplyTimers.delete(contents);
    if (!shouldApplyDebuggerNetworkThrottle(contents)) {
      return;
    }

    const nextConfig = getRuntimeNetworkThrottleConfig();
    if (!nextConfig.enabled) {
      return;
    }

    void applyDesktopNetworkThrottleToWebContentsDebugger({
      contents,
      label,
      config: nextConfig,
      throwOnFailure: true,
      suppressFailureLog: true,
    }).catch((error) => {
      if (attempt === 0 || (attempt + 1) % 10 === 0) {
        logger.warn(
          `[desktop-network-throttle] failed to reapply debugger after detach webContents=${targetLabel} reason=${reason} attempt=${
            attempt + 1
          }`,
          error,
        );
      }
      scheduleDesktopNetworkThrottleDebuggerReapply({
        contents,
        label,
        reason,
        attempt: attempt + 1,
      });
    });
  }, retryDelay);

  webContentsDebuggerReapplyTimers.set(contents, timer);
}

function applyDesktopNetworkThrottleToSession(
  targetSession: Session,
  label: string,
  config: IDesktopStoreNetworkThrottle,
  throwOnFailure?: boolean,
): IDesktopNetworkThrottleAppliedSession | undefined {
  const stateKey = getSessionStateKey(config);
  const previousStateKey = appliedStateBySession.get(targetSession);
  if (previousStateKey === stateKey) {
    return undefined;
  }

  try {
    if (config.enabled) {
      targetSession.enableNetworkEmulation(
        DESKTOP_NETWORK_THROTTLE_PROFILES[config.profile],
      );
    } else {
      targetSession.disableNetworkEmulation();
    }
    appliedStateBySession.set(targetSession, stateKey);
    if (config.enabled || previousStateKey) {
      logger.info(getSessionAppliedLogMessage(config, label));
    }
    return {
      label,
      stateKey,
      targetSession,
    };
  } catch (error) {
    logger.warn(
      `[desktop-network-throttle] failed to apply ${stateKey} to ${label}`,
      error,
    );
    if (throwOnFailure) {
      throw error;
    }
    return undefined;
  }
}

async function applyDesktopNetworkThrottleToWebContentsDebugger({
  contents,
  label,
  config,
  throwOnFailure,
  suppressFailureLog,
}: IDesktopNetworkThrottleWebContentsEntry): Promise<void> {
  if (!shouldApplyDebuggerNetworkThrottle(contents)) {
    return;
  }

  const stateKey = getSessionStateKey(config);
  const previousStateKey = appliedStateByWebContentsDebugger.get(contents);
  if (!config.enabled && !previousStateKey) {
    return;
  }
  if (previousStateKey === stateKey) {
    return;
  }

  const targetLabel = `${label}:${contents.id}:${contents.getType()}`;
  try {
    const { debugger: targetDebugger } = contents;
    logger.info(
      `[desktop-network-throttle-diagnostic] debugger-apply webContents=${targetLabel} url=${getSanitizedDiagnosticUrl(contents.getURL())} ${getDiagnosticThrottleStateText(config)}`,
    );
    if (!targetDebugger.isAttached()) {
      targetDebugger.attach('1.3');
      webContentsDebuggersAttachedByNetworkThrottle.add(contents);
      targetDebugger.once('detach', (_event, reason) => {
        const detachedByNetworkThrottle =
          webContentsDebuggersDetachingByNetworkThrottle.has(contents);
        webContentsDebuggersDetachingByNetworkThrottle.delete(contents);
        clearDesktopNetworkThrottleDebuggerReapply(contents);
        appliedStateByWebContentsDebugger.delete(contents);
        webContentsDebuggersAttachedByNetworkThrottle.delete(contents);
        const detachedReason = String(reason);
        logger.info(
          `[desktop-network-throttle] debugger detached webContents=${targetLabel} reason=${detachedReason}`,
        );
        if (!detachedByNetworkThrottle && detachedReason !== 'target closed') {
          scheduleDesktopNetworkThrottleDebuggerReapply({
            contents,
            label,
            reason: detachedReason,
          });
        }
      });
    }

    await targetDebugger.sendCommand('Network.enable');
    await targetDebugger.sendCommand(
      'Network.emulateNetworkConditions',
      getDebuggerNetworkConditions(config),
    );
    clearDesktopNetworkThrottleDebuggerReapply(contents);
    appliedStateByWebContentsDebugger.set(contents, stateKey);
    if (config.enabled || previousStateKey) {
      logger.info(getWebContentsAppliedLogMessage(config, targetLabel));
    }

    if (
      !config.enabled &&
      webContentsDebuggersAttachedByNetworkThrottle.has(contents) &&
      targetDebugger.isAttached()
    ) {
      webContentsDebuggersDetachingByNetworkThrottle.add(contents);
      try {
        targetDebugger.detach();
      } catch (error) {
        webContentsDebuggersDetachingByNetworkThrottle.delete(contents);
        throw error;
      }
    }
  } catch (error) {
    if (!suppressFailureLog) {
      logger.warn(
        `[desktop-network-throttle] failed to apply debugger ${stateKey} to ${targetLabel}`,
        error,
      );
    }
    if (throwOnFailure) {
      throw error;
    }
  }
}

function uniqueSessions(
  entries: IDesktopNetworkThrottleSessionEntry[],
): IDesktopNetworkThrottleSessionEntry[] {
  const result: IDesktopNetworkThrottleSessionEntry[] = [];
  for (const entry of entries) {
    if (
      !result.some(
        (existingEntry) => existingEntry.targetSession === entry.targetSession,
      )
    ) {
      result.push(entry);
    }
  }
  return result;
}

async function closeSessionConnections(
  appliedSession: IDesktopNetworkThrottleAppliedSession,
): Promise<void> {
  try {
    await appliedSession.targetSession.closeAllConnections();
    logger.info(
      `[desktop-network-throttle] closed connections session=${appliedSession.label} state=${appliedSession.stateKey}`,
    );
  } catch (error) {
    logger.warn(
      `[desktop-network-throttle] failed to close connections session=${appliedSession.label} state=${appliedSession.stateKey}`,
      error,
    );
  }
}

export async function applyDesktopNetworkThrottleToKnownSessions(
  options?: IApplyDesktopNetworkThrottleOptions,
): Promise<void> {
  const config = normalizeDesktopNetworkThrottleConfig(
    options?.config ?? getRuntimeNetworkThrottleConfig(),
  );
  const entries = uniqueSessions([
    {
      label: 'defaultSession',
      targetSession: session.defaultSession,
    },
    {
      label: DESKTOP_WEBVIEW_PARTITION,
      targetSession: session.fromPartition(DESKTOP_WEBVIEW_PARTITION),
    },
    {
      label: DESKTOP_WEBVIEW_OVERLAY_PARTITION,
      targetSession: session.fromPartition(DESKTOP_WEBVIEW_OVERLAY_PARTITION),
    },
    ...webContents
      .getAllWebContents()
      .filter((contents) => !contents.isDestroyed())
      .map((contents) => ({
        label: `webContents:${contents.id}:${contents.getType()}`,
        targetSession: contents.session,
      })),
  ]);

  for (const entry of entries) {
    installDesktopNetworkThrottleDiagnosticsForSession(
      entry.targetSession,
      entry.label,
    );
  }
  logger.info(
    `[desktop-network-throttle-diagnostic] apply-known-sessions sessions=${entries
      .map((entry) => entry.label)
      .join(
        ',',
      )} webContents=${webContents.getAllWebContents().length} ${getDiagnosticThrottleStateText(
      config,
    )}`,
  );

  const closeConnectionTasks: Array<Promise<void>> = [];
  for (const entry of entries) {
    const appliedSession = applyDesktopNetworkThrottleToSession(
      entry.targetSession,
      entry.label,
      config,
      options?.throwOnFailure,
    );
    if (options?.closeConnections && appliedSession) {
      closeConnectionTasks.push(closeSessionConnections(appliedSession));
    }
  }

  const debuggerTasks = webContents
    .getAllWebContents()
    .filter((contents) => !contents.isDestroyed())
    .map((contents) =>
      applyDesktopNetworkThrottleToWebContentsDebugger({
        label: 'webContents',
        contents,
        config,
      }),
    );

  await Promise.all([...closeConnectionTasks, ...debuggerTasks]);
}

export function applyDesktopNetworkThrottleToWebContents(
  contents: WebContents,
): void {
  if (contents.isDestroyed()) {
    return;
  }
  const config = getRuntimeNetworkThrottleConfig();
  installDesktopNetworkThrottleDiagnosticsForSession(
    contents.session,
    `webContents:${contents.id}:${contents.getType()}`,
  );
  logger.info(
    `[desktop-network-throttle-diagnostic] apply-webContents webContents=${contents.id}:${contents.getType()} url=${getSanitizedDiagnosticUrl(contents.getURL())} ${getDiagnosticThrottleStateText(
      config,
    )}`,
  );
  applyDesktopNetworkThrottleToSession(
    contents.session,
    `webContents:${contents.id}:${contents.getType()}`,
    config,
  );
  void applyDesktopNetworkThrottleToWebContentsDebugger({
    label: 'webContents',
    contents,
    config,
  });
}

export function getDesktopNetworkThrottleConfig(): IDesktopStoreNetworkThrottle {
  return getRuntimeNetworkThrottleConfig();
}

export async function setDesktopNetworkThrottleConfig(
  config: IDesktopStoreNetworkThrottle,
): Promise<IDesktopStoreNetworkThrottle> {
  const normalizedConfig = applyDeveloperModeGateToNetworkThrottleConfig(
    normalizeDesktopNetworkThrottleConfig(config),
  );
  const envConfig = getDesktopNetworkThrottleEnvConfig();
  if (envConfig) {
    const envOverrideConfig = normalizeDesktopNetworkThrottleConfig(envConfig);
    await applyDesktopNetworkThrottleToKnownSessions({
      closeConnections: true,
      config: envOverrideConfig,
      throwOnFailure: true,
    });
    logger.info(
      '[desktop-network-throttle] ignored runtime setter because ONEKEY_DESKTOP_NETWORK_THROTTLE is set',
    );
    return envOverrideConfig;
  }

  const previousConfig = getRuntimeNetworkThrottleConfig();
  try {
    await applyDesktopNetworkThrottleToKnownSessions({
      closeConnections: true,
      config: normalizedConfig,
      throwOnFailure: true,
    });
    store.setNetworkThrottle(normalizedConfig);
    runtimeNetworkThrottleConfig = normalizedConfig;
  } catch (error) {
    logger.warn(
      '[desktop-network-throttle] failed to commit config, rolling back',
      error,
    );
    await applyDesktopNetworkThrottleToKnownSessions({
      closeConnections: true,
      config: previousConfig,
    });
    runtimeNetworkThrottleConfig = previousConfig;
    throw error;
  }
  return normalizedConfig;
}
