import { useCallback, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import {
  EMarketPresetKey,
  EMarketPresetTradeSide,
  type IMarketPresetConfig,
  type IMarketPresetDirectionSettings,
  type IMarketPresetItem,
  type IMarketPresetSavedSettings,
  fetchMarketPresetConfig,
  getMarketPresetCustomizedMap,
  getMarketPresetItem,
  getMarketPresetNetworkFeeLevel,
  getMarketPresetPriorityFeeOverride,
  getMarketPresetPriorityFeeUnit,
  getMarketPresetSavedDirectionSettings,
  getMarketPresetSlippageValue,
  normalizeMarketPresetSavedSettings,
  resolveMarketPresetDirectionSettings,
} from './marketPresetSettings';

export type IMarketPresetSettingsState = {
  config?: IMarketPresetConfig;
  enabled: boolean;
  isLoading: boolean;
  presets: IMarketPresetItem[];
  presetCustomizedMap: Partial<Record<EMarketPresetKey, boolean>>;
  priorityFeeUnit: string;
  savedSettings?: IMarketPresetSavedSettings;
  selectedPresetKey: EMarketPresetKey;
  selectedPreset?: IMarketPresetItem;
  selectedDirectionSettings: IMarketPresetDirectionSettings;
  selectedNetworkFeeLevel: ReturnType<typeof getMarketPresetNetworkFeeLevel>;
  selectedSlippageValue: number;
  defaultSlippageValue: number;
  tradeSide: EMarketPresetTradeSide;
  onPresetChange: (presetKey: EMarketPresetKey) => void;
  onSavePresetDirectionSettings: ({
    presetKey,
    tradeSide,
    settings,
  }: {
    presetKey: EMarketPresetKey;
    tradeSide: EMarketPresetTradeSide;
    settings: IMarketPresetDirectionSettings;
  }) => Promise<void>;
  onResetPresetDirectionSettings: ({
    presetKey,
    tradeSide,
  }: {
    presetKey: EMarketPresetKey;
    tradeSide: EMarketPresetTradeSide;
  }) => Promise<void>;
  getDirectionSettings: ({
    presetKey,
    tradeSide,
  }: {
    presetKey: EMarketPresetKey;
    tradeSide: EMarketPresetTradeSide;
  }) => IMarketPresetDirectionSettings;
  getSavedDirectionSettings: ({
    presetKey,
    tradeSide,
  }: {
    presetKey: EMarketPresetKey;
    tradeSide: EMarketPresetTradeSide;
  }) => IMarketPresetDirectionSettings | undefined;
  selectedPriorityFeeOverride: ReturnType<
    typeof getMarketPresetPriorityFeeOverride
  >;
};

export function useMarketPresetSettings({
  networkId,
  defaultSlippage = 0.5,
  tradeSide = EMarketPresetTradeSide.BUY,
}: {
  networkId?: string;
  defaultSlippage?: number;
  tradeSide?: EMarketPresetTradeSide;
}): IMarketPresetSettingsState {
  const selectedPresetRequestIdRef = useRef(0);
  const { result: config, isLoading: configLoading } = usePromiseResult(
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

  const {
    result: rawSavedSettings,
    isLoading: savedSettingsLoading,
    setResult: setSavedSettings,
    run: reloadSavedSettings,
  } = usePromiseResult<IMarketPresetSavedSettings | undefined>(
    async () => {
      if (!networkId) {
        return undefined;
      }

      return backgroundApiProxy.simpleDb.marketPresetSettings.getSettings({
        networkId,
      }) as Promise<IMarketPresetSavedSettings | undefined>;
    },
    [networkId],
    {
      watchLoading: true,
      revalidateOnFocus: true,
    },
  );

  const savedSettings = useMemo(
    () =>
      normalizeMarketPresetSavedSettings({
        config,
        savedSettings: rawSavedSettings,
      }),
    [config, rawSavedSettings],
  );

  const selectedPresetKey =
    savedSettings?.selectedPresetKey ??
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

  const getDirectionSettings = useCallback(
    ({
      presetKey,
      tradeSide: nextTradeSide,
    }: {
      presetKey: EMarketPresetKey;
      tradeSide: EMarketPresetTradeSide;
    }) =>
      resolveMarketPresetDirectionSettings({
        config,
        savedSettings,
        presetKey,
        tradeSide: nextTradeSide,
      }),
    [config, savedSettings],
  );

  const getSavedDirectionSettings = useCallback(
    ({
      presetKey,
      tradeSide: nextTradeSide,
    }: {
      presetKey: EMarketPresetKey;
      tradeSide: EMarketPresetTradeSide;
    }) =>
      getMarketPresetSavedDirectionSettings({
        savedSettings,
        presetKey,
        tradeSide: nextTradeSide,
      }),
    [savedSettings],
  );

  const selectedDirectionSettings = useMemo(
    () =>
      getDirectionSettings({
        presetKey: selectedPreset?.key ?? selectedPresetKey,
        tradeSide,
      }),
    [getDirectionSettings, selectedPreset?.key, selectedPresetKey, tradeSide],
  );

  const onPresetChange = useCallback(
    (presetKey: EMarketPresetKey) => {
      if (!networkId) {
        return;
      }

      setSavedSettings((prev) => ({
        ...prev,
        selectedPresetKey: presetKey,
      }));
      const requestId = selectedPresetRequestIdRef.current + 1;
      selectedPresetRequestIdRef.current = requestId;
      void (async () => {
        try {
          await backgroundApiProxy.simpleDb.marketPresetSettings.setSelectedPresetKey(
            {
              networkId,
              presetKey,
            },
          );
        } finally {
          if (selectedPresetRequestIdRef.current === requestId) {
            await reloadSavedSettings({ alwaysSetState: true });
          }
        }
      })();
    },
    [networkId, reloadSavedSettings, setSavedSettings],
  );

  const onSavePresetDirectionSettings = useCallback(
    async ({
      presetKey,
      tradeSide: nextTradeSide,
      settings,
    }: {
      presetKey: EMarketPresetKey;
      tradeSide: EMarketPresetTradeSide;
      settings: IMarketPresetDirectionSettings;
    }) => {
      if (!networkId) {
        return;
      }

      setSavedSettings((prev) => ({
        ...prev,
        presets: {
          ...prev?.presets,
          [presetKey]: {
            ...prev?.presets?.[presetKey],
            [nextTradeSide]: settings,
          },
        },
      }));

      await backgroundApiProxy.simpleDb.marketPresetSettings.setPresetDirectionSettings(
        {
          networkId,
          presetKey,
          tradeSide: nextTradeSide,
          settings,
        },
      );
      await reloadSavedSettings({ alwaysSetState: true });
    },
    [networkId, reloadSavedSettings, setSavedSettings],
  );

  const onResetPresetDirectionSettings = useCallback(
    async ({
      presetKey,
      tradeSide: nextTradeSide,
    }: {
      presetKey: EMarketPresetKey;
      tradeSide: EMarketPresetTradeSide;
    }) => {
      if (!networkId) {
        return;
      }

      setSavedSettings((prev) => {
        const presetSettings = { ...prev?.presets?.[presetKey] };
        delete presetSettings[nextTradeSide];
        return {
          ...prev,
          presets: {
            ...prev?.presets,
            [presetKey]: presetSettings,
          },
        };
      });

      await backgroundApiProxy.simpleDb.marketPresetSettings.resetPresetDirectionSettings(
        {
          networkId,
          presetKey,
          tradeSide: nextTradeSide,
        },
      );
      await reloadSavedSettings({ alwaysSetState: true });
    },
    [networkId, reloadSavedSettings, setSavedSettings],
  );

  const presetCustomizedMap = useMemo(
    () => getMarketPresetCustomizedMap(savedSettings),
    [savedSettings],
  );

  return {
    config,
    enabled: !!config?.enabled,
    isLoading: !!configLoading || !!savedSettingsLoading,
    presets: config?.presets ?? [],
    presetCustomizedMap,
    priorityFeeUnit: getMarketPresetPriorityFeeUnit(config),
    savedSettings,
    selectedPresetKey,
    selectedPreset,
    selectedDirectionSettings,
    selectedNetworkFeeLevel: getMarketPresetNetworkFeeLevel(
      selectedDirectionSettings,
    ),
    selectedPriorityFeeOverride: getMarketPresetPriorityFeeOverride(
      selectedDirectionSettings,
    ),
    selectedSlippageValue: getMarketPresetSlippageValue({
      settings: selectedDirectionSettings,
      defaultSlippage,
    }),
    defaultSlippageValue: defaultSlippage,
    tradeSide,
    onPresetChange,
    onSavePresetDirectionSettings,
    onResetPresetDirectionSettings,
    getDirectionSettings,
    getSavedDirectionSettings,
  };
}
