import { EDevicePerformanceTier } from '@onekeyhq/shared/src/performance/devicePerformanceTier';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

type IPreloadEntry = { queue: ETabRoutes[]; intervalMs: number };

// Preload config per platform × tier
// high   → preload all key tabs
// medium → preload high-frequency tabs only
// low    → no preload, fully on-demand
const nativePreloadConfig: Record<string, IPreloadEntry> = {
  [EDevicePerformanceTier.high]: {
    queue: [ETabRoutes.Swap, ETabRoutes.Discovery, ETabRoutes.Perp],
    intervalMs: 2000,
  },
  [EDevicePerformanceTier.medium]: {
    queue: [ETabRoutes.Swap, ETabRoutes.Perp],
    intervalMs: 3000,
  },
};

const webPreloadConfig: Record<string, IPreloadEntry> = {
  [EDevicePerformanceTier.high]: {
    queue: [
      ETabRoutes.Swap,
      ETabRoutes.Discovery,
      ETabRoutes.Perp,
      ETabRoutes.DeviceManagement,
      ETabRoutes.ReferFriends,
    ],
    intervalMs: 2000,
  },
  [EDevicePerformanceTier.medium]: {
    queue: [ETabRoutes.Swap, ETabRoutes.Market, ETabRoutes.Discovery],
    intervalMs: 2500,
  },
};

// Ext popup/side panel hides the bottom tab bar, so Discovery/Perp/Device/
// ReferFriends tabs are unreachable there — preloading them only mounts dead
// screens in the popup runtime. Keep just Swap: it warms the SwapMainLand
// chunk shared with the Trade modal, the one reachable swap surface.
const extPopupPreloadConfig: Record<string, IPreloadEntry> = {
  [EDevicePerformanceTier.high]: {
    queue: [ETabRoutes.Swap],
    intervalMs: 1500,
  },
  [EDevicePerformanceTier.medium]: {
    queue: [ETabRoutes.Swap],
    intervalMs: 2500,
  },
};

function resolveWebPreloadConfig() {
  if (platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel) {
    return extPopupPreloadConfig;
  }
  return webPreloadConfig;
}

export const tabPreloadConfig = platformEnv.isNative
  ? nativePreloadConfig
  : resolveWebPreloadConfig();

export const defaultPreloadEntry: IPreloadEntry = {
  queue: [],
  intervalMs: 0,
};
