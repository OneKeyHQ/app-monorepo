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

const appliedStateBySession = new WeakMap<Session, string>();
const appliedStateByWebContentsDebugger = new WeakMap<WebContents, string>();
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
