import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { ETabPreloadMode } from './preloadPolicyResolver';

export type IPreloadEntry = { queue: ETabRoutes[]; intervalMs: number };

const nativePreloadConfig: Record<ETabPreloadMode, IPreloadEntry> = {
  [ETabPreloadMode.full]: {
    queue: [ETabRoutes.Swap, ETabRoutes.Discovery, ETabRoutes.Perp],
    intervalMs: 2000,
  },
  [ETabPreloadMode.light]: {
    queue: [ETabRoutes.Swap, ETabRoutes.Perp],
    intervalMs: 3000,
  },
  [ETabPreloadMode.disabled]: { queue: [], intervalMs: 0 },
};

const webPreloadConfig: Record<ETabPreloadMode, IPreloadEntry> = {
  [ETabPreloadMode.full]: {
    queue: [
      ETabRoutes.Swap,
      ETabRoutes.Discovery,
      ETabRoutes.Perp,
      ETabRoutes.DeviceManagement,
      ETabRoutes.ReferFriends,
    ],
    intervalMs: 2000,
  },
  [ETabPreloadMode.light]: {
    queue: [ETabRoutes.Swap, ETabRoutes.Market, ETabRoutes.Discovery],
    intervalMs: 2500,
  },
  [ETabPreloadMode.disabled]: { queue: [], intervalMs: 0 },
};

// Ext popup/side panel hides the bottom tab bar, so Discovery/Perp/Device/
// ReferFriends tabs are unreachable there — preloading them only mounts dead
// screens in the popup runtime. Keep just Swap: it warms the SwapMainLand
// chunk shared with the Trade modal, the one reachable swap surface.
const extPopupPreloadConfig: Record<ETabPreloadMode, IPreloadEntry> = {
  [ETabPreloadMode.full]: {
    queue: [ETabRoutes.Swap],
    intervalMs: 1500,
  },
  [ETabPreloadMode.light]: {
    queue: [ETabRoutes.Swap],
    intervalMs: 2500,
  },
  [ETabPreloadMode.disabled]: { queue: [], intervalMs: 0 },
};

function resolveWebPreloadConfig() {
  if (platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel) {
    return extPopupPreloadConfig;
  }
  return webPreloadConfig;
}

const tabPreloadConfig = platformEnv.isNative
  ? nativePreloadConfig
  : resolveWebPreloadConfig();

export function getTabPreloadEntry(mode: ETabPreloadMode): IPreloadEntry {
  return tabPreloadConfig[mode];
}
