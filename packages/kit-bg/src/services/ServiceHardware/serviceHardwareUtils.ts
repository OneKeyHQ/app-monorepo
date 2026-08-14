import { EDeviceType } from '@onekeyfe/hd-shared';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { loggerConfig } from '@onekeyhq/shared/src/logger/loggerConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { isProtocolV2ProductType } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';

function hardwareLog(name: string, ...args: any[]) {
  try {
    defaultLogger.hardware.sdkLog.serviceEvent(
      name,
      args.length <= 1 ? args[0] : args,
    );
  } catch {
    // Logging must never break hardware flows.
  }
  // Keep the always-on dev console trace: the scene-gated transport above
  // mirrors to the console itself when enabled, so only fill the gap when
  // the hardware scene is off.
  if (platformEnv.isDev && !loggerConfig.shouldLog('hardware', 'sdkLog')) {
    console.log(`ServiceHardwareLog@${name}`, ...args);
  }
}

/**
 * Device identifiers (serial numbers, connect ids) must never enter
 * persisted logs in full; keep a short suffix for multi-device correlation.
 */
function maskLogIdentifier(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  return `***${value.slice(-4)}`;
}

function getHomeScreenServerDeviceType(deviceType: EDeviceType): EDeviceType {
  // TODO: Remove this compatibility mapping after Dashboard supports
  // deviceType=pro2 for wallet homescreen resources.
  return isProtocolV2ProductType(deviceType) ? EDeviceType.Pro : deviceType;
}

function getPro2HomeScreenSizeFallback({
  deviceType,
  thumbnail,
}: {
  deviceType: EDeviceType;
  thumbnail: boolean;
}): { width: number; height: number } | undefined {
  if (!isProtocolV2ProductType(deviceType)) return undefined;
  if (thumbnail) return undefined;
  return { width: 604, height: 1024 };
}

function getPro2NftSizeFallback({
  deviceType,
  thumbnail,
}: {
  deviceType: EDeviceType;
  thumbnail: boolean;
}): { width: number; height: number } | undefined {
  if (!isProtocolV2ProductType(deviceType)) return undefined;
  return thumbnail ? { width: 263, height: 263 } : { width: 540, height: 540 };
}

export default {
  getHomeScreenServerDeviceType,
  getPro2HomeScreenSizeFallback,
  getPro2NftSizeFallback,
  hardwareLog,
  maskLogIdentifier,
};
