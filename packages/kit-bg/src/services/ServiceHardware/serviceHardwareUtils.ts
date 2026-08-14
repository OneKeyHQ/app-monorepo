import { EDeviceType } from '@onekeyfe/hd-shared';

import { stringifyFunc } from '@onekeyhq/shared/src/logger/stringifyFunc';
import loggerUtils from '@onekeyhq/shared/src/logger/utils';
import { isProtocolV2ProductType } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';

import { getGatedFirmwareUpdateDevSetting } from '../../states/jotai/atoms/devSettings';

/**
 * Write hardware debug evidence through the platform log transport
 * (file-backed on desktop/native) so it survives without an attached
 * DevTools console. Gated behind developer mode + the existing
 * 'showDeviceDebugLogs' dev setting (default off), so normal builds keep
 * console-only behavior and exported logs stay unchanged.
 */
function deviceDebugFileLog(prefix: string, ...args: any[]) {
  void (async () => {
    try {
      const enabled = await getGatedFirmwareUpdateDevSetting(
        'showDeviceDebugLogs',
      );
      if (!enabled) {
        return;
      }
      loggerUtils.consoleFunc(`${prefix} : ${stringifyFunc(...args)}`);
    } catch {
      // Logging must never throw.
    }
  })();
}

function hardwareLog(name: string, ...args: any[]) {
  console.log(`ServiceHardwareLog@${name}`, ...args);
  deviceDebugFileLog(`ServiceHardwareLog@${name}`, ...args);
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
  deviceDebugFileLog,
  getHomeScreenServerDeviceType,
  getPro2HomeScreenSizeFallback,
  getPro2NftSizeFallback,
  hardwareLog,
};
