import { useCallback, useMemo, useState } from 'react';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import {
  EMarketPresetKey,
  type IMarketPresetItem,
  fetchMarketPresetConfig,
  getMarketPresetItem,
  getMarketPresetNetworkFeeLevel,
  getMarketPresetSlippageValue,
} from './marketPresetSettings';

export type IMarketPresetSettingsState = {
  enabled: boolean;
  isLoading: boolean;
  presets: IMarketPresetItem[];
  selectedPresetKey: EMarketPresetKey;
  selectedPreset?: IMarketPresetItem;
  selectedNetworkFeeLevel: ReturnType<typeof getMarketPresetNetworkFeeLevel>;
  selectedSlippageValue: number;
  onPresetChange: (presetKey: EMarketPresetKey) => void;
};

export function useMarketPresetSettings({
  networkId,
  defaultSlippage = 0.5,
}: {
  networkId?: string;
  defaultSlippage?: number;
}): IMarketPresetSettingsState {
  const [selectedPresetByNetwork, setSelectedPresetByNetwork] = useState<
    Partial<Record<string, EMarketPresetKey>>
  >({});

  const { result: config, isLoading } = usePromiseResult(
    async () => {
      if (!networkId) {
        return undefined;
      }

      return fetchMarketPresetConfig({ networkId });
    },
    [networkId],
    {
      watchLoading: true,
    },
  );

  const selectedPresetKey =
    (networkId ? selectedPresetByNetwork[networkId] : undefined) ??
    config?.defaultPresetKey ??
    EMarketPresetKey.AUTO;

  const selectedPreset = useMemo(
    () =>
      getMarketPresetItem({
        config,
        presetKey: selectedPresetKey,
      }),
    [config, selectedPresetKey],
  );

  const onPresetChange = useCallback(
    (presetKey: EMarketPresetKey) => {
      if (!networkId) {
        return;
      }

      setSelectedPresetByNetwork((prev) => ({
        ...prev,
        [networkId]: presetKey,
      }));
    },
    [networkId],
  );

  return {
    enabled: !!config?.enabled,
    isLoading: !!isLoading,
    presets: config?.presets ?? [],
    selectedPresetKey,
    selectedPreset,
    selectedNetworkFeeLevel: getMarketPresetNetworkFeeLevel(selectedPreset),
    selectedSlippageValue: getMarketPresetSlippageValue({
      preset: selectedPreset,
      defaultSlippage,
    }),
    onPresetChange,
  };
}
