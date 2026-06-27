import { type Session, type WebContents, session, webContents } from 'electron';
import logger from 'electron-log/main';

import { DESKTOP_WEBVIEW_OVERLAY_PARTITION } from '@onekeyhq/shared/src/consts/desktopWebviewPartitions';
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

let runtimeNetworkThrottleConfig: IDesktopStoreNetworkThrottle | undefined;

function normalizeDesktopNetworkThrottleConfig(
  config: Partial<IDesktopStoreNetworkThrottle> | undefined,
): IDesktopStoreNetworkThrottle {
  return {
    enabled: Boolean(config?.enabled),
    profile: config?.profile === 'slow4g' ? config.profile : 'slow4g',
  };
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
  runtimeNetworkThrottleConfig ??= normalizeDesktopNetworkThrottleConfig(
    getDesktopNetworkThrottleEnvConfig() ?? store.getNetworkThrottle(),
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

function applyDesktopNetworkThrottleToSession(
  targetSession: Session,
  label: string,
): void {
  const config = getRuntimeNetworkThrottleConfig();
  const stateKey = getSessionStateKey(config);
  const previousStateKey = appliedStateBySession.get(targetSession);
  if (previousStateKey === stateKey) {
    return;
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
  } catch (error) {
    logger.warn(
      `[desktop-network-throttle] failed to apply ${stateKey} to ${label}`,
      error,
    );
  }
}

function uniqueSessions(
  entries: Array<{ label: string; targetSession: Session }>,
): Array<{ label: string; targetSession: Session }> {
  const result: Array<{ label: string; targetSession: Session }> = [];
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

export function applyDesktopNetworkThrottleToKnownSessions(): void {
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
    applyDesktopNetworkThrottleToSession(entry.targetSession, entry.label);
  }
}

export function applyDesktopNetworkThrottleToWebContents(
  contents: WebContents,
): void {
  if (contents.isDestroyed()) {
    return;
  }
  applyDesktopNetworkThrottleToSession(
    contents.session,
    `webContents:${contents.id}:${contents.getType()}`,
  );
}

export function getDesktopNetworkThrottleConfig(): IDesktopStoreNetworkThrottle {
  return getRuntimeNetworkThrottleConfig();
}

export function setDesktopNetworkThrottleConfig(
  config: IDesktopStoreNetworkThrottle,
): IDesktopStoreNetworkThrottle {
  const normalizedConfig = normalizeDesktopNetworkThrottleConfig(config);
  runtimeNetworkThrottleConfig = normalizedConfig;
  store.setNetworkThrottle(normalizedConfig);
  applyDesktopNetworkThrottleToKnownSessions();
  return normalizedConfig;
}
