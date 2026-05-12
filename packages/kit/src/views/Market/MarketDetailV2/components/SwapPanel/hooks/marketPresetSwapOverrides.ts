import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  type ESwapNetworkFeeLevel,
  ESwapSlippageSegmentKey,
  type ISwapProSpeedConfig,
} from '@onekeyhq/shared/types/swap/types';

import {
  EMarketPresetKey,
  type EMarketPresetTradeSide,
  type IMarketPresetPriorityFeeOverride,
  type IMarketPresetSavedSettings,
  fetchMarketPresetConfig,
  getMarketPresetNetworkFeeLevel,
  getMarketPresetPriorityFeeOverride,
  isInvalidMarketPresetSlippageSettings,
  normalizeMarketPresetSavedSettings,
  resolveMarketPresetDirectionSettings,
} from './marketPresetSettings';

export type IMarketPresetSwapOverrides = {
  networkFeeLevel: ESwapNetworkFeeLevel;
  customPriorityFee?: IMarketPresetPriorityFeeOverride;
  // Only emitted when the preset explicitly chose a CUSTOM slippage with a
  // valid value. AUTO is intentionally omitted so the standard Swap fallback
  // (auto-suggested per quote) keeps owning slippage.
  slippage?: {
    key: ESwapSlippageSegmentKey;
    value: number;
  };
};

export async function loadMarketPresetSwapOverrides({
  networkId,
  speedConfig,
  speedConfigReady,
  tradeSide,
}: {
  networkId: string;
  speedConfig?: ISwapProSpeedConfig;
  speedConfigReady?: boolean;
  tradeSide: EMarketPresetTradeSide;
}): Promise<IMarketPresetSwapOverrides | undefined> {
  if (!networkId) {
    return undefined;
  }

  if (speedConfigReady === false) {
    return undefined;
  }

  try {
    const [speedSwapConfig, savedSettings] = await Promise.all([
      speedConfig
        ? Promise.resolve({ speedConfig })
        : backgroundApiProxy.serviceSwap
            .fetchSpeedSwapConfig({ networkId })
            .catch(() => undefined),
      backgroundApiProxy.simpleDb.marketPresetSettings.getSettings({
        networkId,
      }) as Promise<IMarketPresetSavedSettings | undefined>,
    ]);
    const config = await fetchMarketPresetConfig({
      networkId,
      speedConfig: speedSwapConfig?.speedConfig,
    });

    if (!config?.enabled) {
      return undefined;
    }

    const normalized = normalizeMarketPresetSavedSettings({
      config,
      savedSettings,
    });
    const presetKey =
      normalized?.selectedPresetKey ??
      config?.defaultPresetKey ??
      EMarketPresetKey.AUTO;
    const directionSettings = resolveMarketPresetDirectionSettings({
      config,
      savedSettings: normalized,
      presetKey,
      tradeSide,
    });

    const slippageValue = directionSettings.slippage?.value;
    const slippage =
      directionSettings.slippage?.key === ESwapSlippageSegmentKey.CUSTOM &&
      typeof slippageValue === 'number' &&
      Number.isFinite(slippageValue) &&
      !isInvalidMarketPresetSlippageSettings(directionSettings)
        ? {
            key: ESwapSlippageSegmentKey.CUSTOM,
            value: slippageValue,
          }
        : undefined;

    return {
      networkFeeLevel: getMarketPresetNetworkFeeLevel(
        directionSettings,
        config,
      ),
      customPriorityFee: getMarketPresetPriorityFeeOverride(
        directionSettings,
        config,
      ),
      slippage,
    };
  } catch (error) {
    // Falling back to defaults here is intentional (preset is non-critical),
    // but keep a minimal trace so SimpleDb / config drift is observable in
    // dev/staging instead of disappearing silently.
    console.error(
      '[marketPresetSwapOverrides] failed to load',
      { networkId, tradeSide },
      error,
    );
    return undefined;
  }
}
