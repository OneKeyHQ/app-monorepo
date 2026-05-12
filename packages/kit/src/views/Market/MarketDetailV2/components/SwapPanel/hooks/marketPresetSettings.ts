import BigNumber from 'bignumber.js';

import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import {
  type IMarketPresetCustomPriorityFeeRange,
  MARKET_PRESET_CUSTOM_PRIORITY_FEE_MIN_VALUE,
  isValidMarketPresetCustomPriorityFeeValue,
  normalizeMarketPresetCustomPriorityFeeRange,
} from '@onekeyhq/shared/src/utils/marketPresetFeeUtils';
import {
  swapSlippageMaxValue,
  swapSlippageWillAheadMinValue,
  swapSlippageWillFailMinValue,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  ESwapNetworkFeeLevel,
  ESwapSlippageCustomStatus,
  ESwapSlippageSegmentKey,
  type ISwapProSpeedConfig,
} from '@onekeyhq/shared/types/swap/types';

export enum EMarketPresetKey {
  AUTO = 'auto',
  P1 = 'p1',
  P2 = 'p2',
  P3 = 'p3',
}

export enum EMarketPresetTradeSide {
  BUY = 'buy',
  SELL = 'sell',
}

export enum EMarketPresetPriorityFeeType {
  AUTO = 'auto',
  MARKET = 'market',
  FAST = 'fast',
  CUSTOM = 'custom',
}

export type IMarketPresetItem = {
  key: EMarketPresetKey;
  // Static technical label for P1/P2/P3. AUTO has no static label and is
  // resolved to a translated string at the UI layer (see `getMarketPresetLabel`
  // in MarketPresetSelector). Never render this directly — always go through
  // the resolver so AUTO picks up `ETranslations.global_auto`.
  label?: string;
  defaults?: Partial<
    Record<EMarketPresetTradeSide, IMarketPresetDirectionSettings>
  >;
};

export type IMarketPresetSlippageSettings = {
  key: ESwapSlippageSegmentKey;
  value?: number;
};

export type IMarketPresetPriorityFeeSettings = {
  type: EMarketPresetPriorityFeeType;
  customValue?: string;
};

export type IMarketPresetPriorityFeeOverride = {
  customValue: string;
  customRange?: IMarketPresetCustomPriorityFeeRange;
};

export type IMarketPresetDirectionSettings = {
  slippage: IMarketPresetSlippageSettings;
  priorityFee: IMarketPresetPriorityFeeSettings;
};

export type IMarketPresetSavedSettings = {
  selectedPresetKey?: EMarketPresetKey;
  presets?: Partial<
    Record<
      EMarketPresetKey,
      Partial<Record<EMarketPresetTradeSide, IMarketPresetDirectionSettings>>
    >
  >;
};

export enum EMarketPresetSlippageWarningType {
  WILL_FAIL = 'willFail',
  WILL_AHEAD = 'willAhead',
}

export type IMarketPresetConfig = {
  enabled: boolean;
  networkId: string;
  defaultPresetKey: EMarketPresetKey;
  presets: IMarketPresetItem[];
  slippage: {
    editable: boolean;
  };
  priorityFee: {
    editable: boolean;
    supportedTypes: EMarketPresetPriorityFeeType[];
    customUnit?: string;
    customRange: IMarketPresetCustomPriorityFeeRange;
  };
};

type IMarketPresetRemoteConfig = {
  enabled?: boolean;
  customPriorityFeeRange?: IMarketPresetCustomPriorityFeeRange;
};

type IMarketPresetSpeedConfig = ISwapProSpeedConfig & {
  marketPresetConfig?: IMarketPresetRemoteConfig & {
    customPriorityFeeMin?: IMarketPresetCustomPriorityFeeRange['min'];
    customPriorityFeeMax?: IMarketPresetCustomPriorityFeeRange['max'];
  };
};

const MARKET_PRESET_ITEMS: IMarketPresetItem[] = [
  // AUTO label intentionally omitted — resolved via `getMarketPresetLabel`
  // at the UI consumption layer to honour i18n.
  { key: EMarketPresetKey.AUTO },
  { key: EMarketPresetKey.P1, label: 'P1' },
  { key: EMarketPresetKey.P2, label: 'P2' },
  { key: EMarketPresetKey.P3, label: 'P3' },
];

const DEFAULT_MARKET_PRESET_DIRECTION_SETTINGS: IMarketPresetDirectionSettings =
  {
    slippage: {
      key: ESwapSlippageSegmentKey.AUTO,
    },
    priorityFee: {
      type: EMarketPresetPriorityFeeType.MARKET,
    },
  };

const DEFAULT_MARKET_PRESET_EDITABLE_DIRECTION_SETTINGS: IMarketPresetDirectionSettings =
  {
    slippage: {
      key: ESwapSlippageSegmentKey.CUSTOM,
      value: 1,
    },
    priorityFee: {
      type: EMarketPresetPriorityFeeType.CUSTOM,
      customValue: '',
    },
  };

const MARKET_PRESET_EVM_NETWORK_IDS = new Set([
  presetNetworksMap.eth.id,
  presetNetworksMap.bsc.id,
  presetNetworksMap.polygon.id,
  presetNetworksMap.arbitrum.id,
  presetNetworksMap.optimism.id,
  presetNetworksMap.base.id,
  presetNetworksMap.avalanche.id,
  presetNetworksMap.okb.id,
]);

const MARKET_PRESET_PRIORITY_READONLY_NETWORK_IDS = new Set([
  presetNetworksMap.sui.id,
  presetNetworksMap.tron.id,
  presetNetworksMap.aptos.id,
]);

const MARKET_PRESET_SOL_NETWORK_IDS = new Set([presetNetworksMap.sol.id]);

const MARKET_PRESET_FALLBACK_DISABLED_NETWORK_IDS = new Set([
  presetNetworksMap.sui.id,
]);

const MARKET_PRESET_CUSTOM_PRIORITY_FEE_RANGE_BY_NETWORK_ID: Partial<
  Record<string, IMarketPresetCustomPriorityFeeRange>
> = {
  [presetNetworksMap.sol.id]: {
    min: '0',
    max: '2',
  },
  [presetNetworksMap.eth.id]: {
    min: '0',
    max: '4000',
  },
  [presetNetworksMap.bsc.id]: {
    min: '0',
    max: '4000',
  },
  [presetNetworksMap.base.id]: {
    min: '0',
    max: '250',
  },
  [presetNetworksMap.okb.id]: {
    min: '0',
    max: '100',
  },
};

function getMarketPresetCustomPriorityFeeRange({
  networkId,
  customRange,
}: {
  networkId: string;
  customRange?: IMarketPresetCustomPriorityFeeRange;
}) {
  const fallbackRange =
    MARKET_PRESET_CUSTOM_PRIORITY_FEE_RANGE_BY_NETWORK_ID[networkId];
  const minCandidate = customRange?.min ?? fallbackRange?.min;
  const minBN = new BigNumber(minCandidate ?? Number.NaN);
  const min = minBN.isFinite() ? minCandidate : fallbackRange?.min;
  const maxCandidate = customRange?.max ?? fallbackRange?.max;
  const maxBN = new BigNumber(maxCandidate ?? Number.NaN);
  const minCompareBN = new BigNumber(
    min ?? MARKET_PRESET_CUSTOM_PRIORITY_FEE_MIN_VALUE,
  );
  const max =
    maxBN.isFinite() && maxBN.gt(minCompareBN)
      ? maxCandidate
      : fallbackRange?.max;

  return {
    min,
    max,
  };
}

function buildPresetConfig({
  networkId,
  enabled = true,
  slippageEditable = true,
  priorityFeeEditable,
  priorityFeeSupportedTypes,
  customUnit,
  customRange,
}: {
  networkId: string;
  enabled?: boolean;
  slippageEditable?: boolean;
  priorityFeeEditable: boolean;
  priorityFeeSupportedTypes?: EMarketPresetPriorityFeeType[];
  customUnit?: string;
  customRange?: IMarketPresetCustomPriorityFeeRange;
}): IMarketPresetConfig {
  return {
    enabled,
    networkId,
    defaultPresetKey: EMarketPresetKey.AUTO,
    presets: MARKET_PRESET_ITEMS,
    slippage: {
      editable: slippageEditable,
    },
    priorityFee: {
      editable: priorityFeeEditable,
      supportedTypes:
        priorityFeeSupportedTypes ??
        (priorityFeeEditable
          ? [
              EMarketPresetPriorityFeeType.MARKET,
              EMarketPresetPriorityFeeType.FAST,
              EMarketPresetPriorityFeeType.CUSTOM,
            ]
          : [EMarketPresetPriorityFeeType.AUTO]),
      customUnit,
      customRange: normalizeMarketPresetCustomPriorityFeeRange(
        getMarketPresetCustomPriorityFeeRange({
          networkId,
          customRange,
        }),
      ),
    },
  };
}

function getMarketPresetRemoteConfig(
  speedConfig?: ISwapProSpeedConfig,
): IMarketPresetRemoteConfig | undefined {
  const nestedConfig = (speedConfig as IMarketPresetSpeedConfig | undefined)
    ?.marketPresetConfig;
  const enabled = nestedConfig?.enabled;
  const customPriorityFeeMin =
    nestedConfig?.customPriorityFeeRange?.min ??
    nestedConfig?.customPriorityFeeMin;
  const customPriorityFeeMax =
    nestedConfig?.customPriorityFeeRange?.max ??
    nestedConfig?.customPriorityFeeMax;

  if (
    enabled === undefined &&
    customPriorityFeeMin === undefined &&
    customPriorityFeeMax === undefined
  ) {
    return undefined;
  }

  return {
    enabled,
    customPriorityFeeRange: {
      min: customPriorityFeeMin,
      max: customPriorityFeeMax,
    },
  };
}

function buildPresetConfigFromRemote({
  networkId,
  remoteConfig,
}: {
  networkId: string;
  remoteConfig: IMarketPresetRemoteConfig;
}): IMarketPresetConfig | undefined {
  const customRange = remoteConfig.customPriorityFeeRange;

  if (
    remoteConfig.enabled === false ||
    (MARKET_PRESET_FALLBACK_DISABLED_NETWORK_IDS.has(networkId) &&
      remoteConfig.enabled !== true)
  ) {
    return buildPresetConfig({
      networkId,
      enabled: false,
      slippageEditable: false,
      priorityFeeEditable: false,
      customRange,
    });
  }

  if (
    networkId.startsWith('evm--') &&
    (remoteConfig.enabled === true ||
      MARKET_PRESET_EVM_NETWORK_IDS.has(networkId))
  ) {
    return buildPresetConfig({
      networkId,
      priorityFeeEditable: true,
      customUnit: 'Gwei',
      customRange,
    });
  }

  if (MARKET_PRESET_SOL_NETWORK_IDS.has(networkId)) {
    return buildPresetConfig({
      networkId,
      priorityFeeEditable: true,
      priorityFeeSupportedTypes: [
        EMarketPresetPriorityFeeType.MARKET,
        EMarketPresetPriorityFeeType.CUSTOM,
      ],
      customUnit: 'SOL',
      customRange,
    });
  }

  if (MARKET_PRESET_PRIORITY_READONLY_NETWORK_IDS.has(networkId)) {
    return buildPresetConfig({
      networkId,
      priorityFeeEditable: false,
      customRange,
    });
  }

  return undefined;
}

function getMarketPresetConfigFromSpeedConfig({
  networkId,
  speedConfig,
}: {
  networkId: string;
  speedConfig?: ISwapProSpeedConfig;
}) {
  const remoteConfig = getMarketPresetRemoteConfig(speedConfig);
  if (!remoteConfig) {
    return undefined;
  }

  return buildPresetConfigFromRemote({
    networkId,
    remoteConfig,
  });
}

async function fetchMarketPresetDashboardConfig({
  networkId,
}: {
  networkId: string;
}): Promise<IMarketPresetConfig | undefined> {
  if (MARKET_PRESET_FALLBACK_DISABLED_NETWORK_IDS.has(networkId)) {
    return buildPresetConfig({
      networkId,
      enabled: false,
      slippageEditable: false,
      priorityFeeEditable: false,
    });
  }

  if (MARKET_PRESET_EVM_NETWORK_IDS.has(networkId)) {
    return buildPresetConfig({
      networkId,
      priorityFeeEditable: true,
      customUnit: 'Gwei',
    });
  }

  if (MARKET_PRESET_SOL_NETWORK_IDS.has(networkId)) {
    return buildPresetConfig({
      networkId,
      priorityFeeEditable: true,
      priorityFeeSupportedTypes: [
        EMarketPresetPriorityFeeType.MARKET,
        EMarketPresetPriorityFeeType.CUSTOM,
      ],
      customUnit: 'SOL',
    });
  }

  if (MARKET_PRESET_PRIORITY_READONLY_NETWORK_IDS.has(networkId)) {
    return buildPresetConfig({
      networkId,
      priorityFeeEditable: false,
    });
  }

  return undefined;
}

export async function fetchMarketPresetConfig(params: {
  networkId: string;
  speedConfig?: ISwapProSpeedConfig;
}): Promise<IMarketPresetConfig | undefined> {
  const speedConfigPreset = getMarketPresetConfigFromSpeedConfig(params);
  if (speedConfigPreset) {
    return speedConfigPreset;
  }

  return fetchMarketPresetDashboardConfig(params).catch(() => undefined);
}

export function getMarketPresetItem({
  config,
  presetKey,
}: {
  config?: IMarketPresetConfig;
  presetKey?: EMarketPresetKey;
}) {
  if (!config?.enabled) {
    return undefined;
  }

  return (
    config.presets.find((item) => item.key === presetKey) ??
    config.presets.find((item) => item.key === config.defaultPresetKey) ??
    config.presets[0]
  );
}

export function getMarketPresetDefaultDirectionSettings(): IMarketPresetDirectionSettings {
  return {
    slippage: {
      ...DEFAULT_MARKET_PRESET_DIRECTION_SETTINGS.slippage,
    },
    priorityFee: {
      ...DEFAULT_MARKET_PRESET_DIRECTION_SETTINGS.priorityFee,
    },
  };
}

export function getMarketPresetDefaultEditableDirectionSettings(): IMarketPresetDirectionSettings {
  return {
    slippage: {
      ...DEFAULT_MARKET_PRESET_EDITABLE_DIRECTION_SETTINGS.slippage,
    },
    priorityFee: {
      ...DEFAULT_MARKET_PRESET_EDITABLE_DIRECTION_SETTINGS.priorityFee,
    },
  };
}

export function getMarketPresetDefaultDirectionSettingsForPreset({
  config,
  presetKey,
}: {
  config?: IMarketPresetConfig;
  presetKey?: EMarketPresetKey;
}): IMarketPresetDirectionSettings {
  const defaultSettings = getMarketPresetDefaultDirectionSettings();

  if (!config?.enabled || presetKey === EMarketPresetKey.AUTO) {
    return defaultSettings;
  }

  return {
    slippage: defaultSettings.slippage,
    priorityFee: config.priorityFee.editable
      ? defaultSettings.priorityFee
      : {
          type: EMarketPresetPriorityFeeType.AUTO,
        },
  };
}

export function getMarketPresetDefaultEditableDirectionSettingsForPreset({
  config,
  presetKey,
}: {
  config?: IMarketPresetConfig;
  presetKey?: EMarketPresetKey;
}): IMarketPresetDirectionSettings {
  if (!config?.enabled || presetKey === EMarketPresetKey.AUTO) {
    return getMarketPresetDefaultDirectionSettings();
  }

  const defaultSettings = getMarketPresetDefaultDirectionSettings();
  const editableSettings = getMarketPresetDefaultEditableDirectionSettings();

  return {
    slippage: config.slippage.editable
      ? editableSettings.slippage
      : defaultSettings.slippage,
    priorityFee: config.priorityFee.editable
      ? editableSettings.priorityFee
      : {
          type: EMarketPresetPriorityFeeType.AUTO,
        },
  };
}

export function normalizeMarketPresetDirectionSettings(
  settings?: IMarketPresetDirectionSettings,
): IMarketPresetDirectionSettings {
  if (!settings) {
    return getMarketPresetDefaultDirectionSettings();
  }

  return {
    slippage: {
      key: settings.slippage?.key ?? ESwapSlippageSegmentKey.AUTO,
      value: settings.slippage?.value,
    },
    priorityFee: {
      type: settings.priorityFee?.type ?? EMarketPresetPriorityFeeType.MARKET,
      customValue: settings.priorityFee?.customValue,
    },
  };
}

function getMarketPresetResolvedPriorityFeeSettings({
  config,
  settings,
}: {
  config?: IMarketPresetConfig;
  settings: IMarketPresetDirectionSettings;
}): IMarketPresetPriorityFeeSettings {
  if (!config?.priorityFee.editable) {
    return {
      type: EMarketPresetPriorityFeeType.AUTO,
    };
  }

  if (config.priorityFee.supportedTypes.includes(settings.priorityFee.type)) {
    return settings.priorityFee;
  }

  return getMarketPresetDefaultDirectionSettings().priorityFee;
}

export function getMarketPresetSavedDirectionSettings({
  savedSettings,
  presetKey,
  tradeSide,
}: {
  savedSettings?: IMarketPresetSavedSettings;
  presetKey?: EMarketPresetKey;
  tradeSide: EMarketPresetTradeSide;
}) {
  if (!presetKey || presetKey === EMarketPresetKey.AUTO) {
    return undefined;
  }

  return savedSettings?.presets?.[presetKey]?.[tradeSide];
}

export function resolveMarketPresetDirectionSettings({
  config,
  savedSettings,
  presetKey,
  tradeSide,
}: {
  config?: IMarketPresetConfig;
  savedSettings?: IMarketPresetSavedSettings;
  presetKey?: EMarketPresetKey;
  tradeSide: EMarketPresetTradeSide;
}) {
  const configDefaultSettings = config?.presets.find(
    (item) => item.key === presetKey,
  )?.defaults?.[tradeSide];

  const normalized = normalizeMarketPresetDirectionSettings(
    getMarketPresetSavedDirectionSettings({
      savedSettings,
      presetKey,
      tradeSide,
    }) ??
      configDefaultSettings ??
      getMarketPresetDefaultDirectionSettingsForPreset({
        config,
        presetKey,
      }),
  );

  return {
    slippage: config?.slippage.editable
      ? normalized.slippage
      : getMarketPresetDefaultDirectionSettings().slippage,
    priorityFee: getMarketPresetResolvedPriorityFeeSettings({
      config,
      settings: normalized,
    }),
  };
}

export function isMarketPresetDirectionCustomized(
  settings?: IMarketPresetDirectionSettings,
) {
  if (!settings) {
    return false;
  }

  const normalized = normalizeMarketPresetDirectionSettings(settings);
  return (
    normalized.slippage.key === ESwapSlippageSegmentKey.CUSTOM ||
    normalized.priorityFee.type === EMarketPresetPriorityFeeType.FAST ||
    normalized.priorityFee.type === EMarketPresetPriorityFeeType.CUSTOM
  );
}

export function getMarketPresetCustomizedMap(
  savedSettings?: IMarketPresetSavedSettings,
) {
  return MARKET_PRESET_ITEMS.reduce<Partial<Record<EMarketPresetKey, boolean>>>(
    (acc, preset) => {
      if (preset.key === EMarketPresetKey.AUTO) {
        acc[preset.key] = false;
        return acc;
      }

      acc[preset.key] =
        isMarketPresetDirectionCustomized(
          savedSettings?.presets?.[preset.key]?.[EMarketPresetTradeSide.BUY],
        ) ||
        isMarketPresetDirectionCustomized(
          savedSettings?.presets?.[preset.key]?.[EMarketPresetTradeSide.SELL],
        );
      return acc;
    },
    {},
  );
}

export function shouldShowMarketPresetReviewCustomNetworkFeeOption({
  enabled,
  selectedPriorityFeeOverride,
}: {
  enabled: boolean;
  selectedPriorityFeeOverride?: IMarketPresetPriorityFeeOverride;
}) {
  return enabled && !!selectedPriorityFeeOverride;
}

export function getMarketPresetSlippageValue({
  settings,
  defaultSlippage,
}: {
  settings?: IMarketPresetDirectionSettings;
  defaultSlippage: number;
}) {
  if (
    settings?.slippage.key === ESwapSlippageSegmentKey.CUSTOM &&
    settings.slippage.value !== undefined
  ) {
    return settings.slippage.value;
  }

  return defaultSlippage;
}

export function getMarketPresetNetworkFeeLevel(
  settings?: IMarketPresetDirectionSettings,
  config?: IMarketPresetConfig,
) {
  if (
    settings?.priorityFee.type === EMarketPresetPriorityFeeType.CUSTOM &&
    !isValidMarketPresetCustomValue(settings.priorityFee.customValue, config)
  ) {
    return ESwapNetworkFeeLevel.MEDIUM;
  }

  if (
    settings?.priorityFee.type === EMarketPresetPriorityFeeType.FAST ||
    settings?.priorityFee.type === EMarketPresetPriorityFeeType.CUSTOM
  ) {
    return ESwapNetworkFeeLevel.HIGH;
  }

  return ESwapNetworkFeeLevel.MEDIUM;
}

export function getMarketPresetPriorityFeeCustomRange(
  config?: IMarketPresetConfig,
) {
  return normalizeMarketPresetCustomPriorityFeeRange(
    config?.priorityFee.customRange,
  );
}

export function getMarketPresetPriorityFeeCustomPlaceholder(
  config?: IMarketPresetConfig,
) {
  const { min, max } = getMarketPresetPriorityFeeCustomRange(config);
  return `${min} ~ ${max}`;
}

export function isValidMarketPresetCustomValue(
  value?: string,
  config?: IMarketPresetConfig,
) {
  return isValidMarketPresetCustomPriorityFeeValue({
    value,
    range: getMarketPresetPriorityFeeCustomRange(config),
  });
}

export function isInvalidMarketPresetSlippageSettings(
  settings?: IMarketPresetDirectionSettings,
) {
  return (
    getMarketPresetSlippageCustomStatus(settings).status ===
    ESwapSlippageCustomStatus.ERROR
  );
}

export function getMarketPresetSlippageCustomStatus(
  settings?: IMarketPresetDirectionSettings,
): {
  status: ESwapSlippageCustomStatus;
  warningType?: EMarketPresetSlippageWarningType;
} {
  if (!settings) {
    return { status: ESwapSlippageCustomStatus.NORMAL };
  }

  if (settings.slippage.key !== ESwapSlippageSegmentKey.CUSTOM) {
    return { status: ESwapSlippageCustomStatus.NORMAL };
  }

  const slippageValueBN = new BigNumber(settings.slippage.value ?? Number.NaN);
  if (
    settings.slippage.value === undefined ||
    slippageValueBN.isNaN() ||
    slippageValueBN.isNegative() ||
    slippageValueBN.gt(swapSlippageMaxValue)
  ) {
    return { status: ESwapSlippageCustomStatus.ERROR };
  }

  if (slippageValueBN.lte(swapSlippageWillFailMinValue)) {
    return {
      status: ESwapSlippageCustomStatus.WRONG,
      warningType: EMarketPresetSlippageWarningType.WILL_FAIL,
    };
  }

  if (slippageValueBN.gt(swapSlippageWillAheadMinValue)) {
    return {
      status: ESwapSlippageCustomStatus.WRONG,
      warningType: EMarketPresetSlippageWarningType.WILL_AHEAD,
    };
  }

  return { status: ESwapSlippageCustomStatus.NORMAL };
}

export function isInvalidMarketPresetPriorityFeeSettings(
  settings?: IMarketPresetDirectionSettings,
  config?: IMarketPresetConfig,
) {
  if (!settings) {
    return false;
  }

  return (
    settings.priorityFee.type === EMarketPresetPriorityFeeType.CUSTOM &&
    !isValidMarketPresetCustomValue(settings.priorityFee.customValue, config)
  );
}

export function isInvalidMarketPresetDirectionSettings(
  settings?: IMarketPresetDirectionSettings,
  config?: IMarketPresetConfig,
) {
  return (
    isInvalidMarketPresetSlippageSettings(settings) ||
    isInvalidMarketPresetPriorityFeeSettings(settings, config)
  );
}

export function isMarketPresetConfirmDisabled({
  activePresetKey,
  currentSettingsInvalid,
  hasInvalidDirtySettings,
}: {
  activePresetKey: EMarketPresetKey;
  currentSettingsInvalid: boolean;
  hasInvalidDirtySettings: boolean;
}) {
  if (activePresetKey === EMarketPresetKey.AUTO) {
    return false;
  }

  return currentSettingsInvalid || hasInvalidDirtySettings;
}

export function getMarketPresetPriorityFeeOverride(
  settings?: IMarketPresetDirectionSettings,
  config?: IMarketPresetConfig,
): IMarketPresetPriorityFeeOverride | undefined {
  const customValue = settings?.priorityFee.customValue;
  if (
    settings?.priorityFee.type !== EMarketPresetPriorityFeeType.CUSTOM ||
    !customValue ||
    !isValidMarketPresetCustomValue(customValue, config)
  ) {
    return undefined;
  }

  return {
    customValue,
    customRange: getMarketPresetPriorityFeeCustomRange(config),
  };
}

export function getMarketPresetPriorityFeeUnit(config?: IMarketPresetConfig) {
  return config?.priorityFee.customUnit ?? '';
}

function isMarketPresetKey(value: unknown): value is EMarketPresetKey {
  return Object.values(EMarketPresetKey).includes(value as EMarketPresetKey);
}

function isMarketPresetTradeSide(
  value: unknown,
): value is EMarketPresetTradeSide {
  return Object.values(EMarketPresetTradeSide).includes(
    value as EMarketPresetTradeSide,
  );
}

function isMarketPresetPriorityFeeType(
  value: unknown,
): value is EMarketPresetPriorityFeeType {
  return Object.values(EMarketPresetPriorityFeeType).includes(
    value as EMarketPresetPriorityFeeType,
  );
}

function isSwapSlippageSegmentKey(
  value: unknown,
): value is ESwapSlippageSegmentKey {
  return Object.values(ESwapSlippageSegmentKey).includes(
    value as ESwapSlippageSegmentKey,
  );
}

export function normalizeMarketPresetSavedSettings({
  config,
  savedSettings,
}: {
  config?: IMarketPresetConfig;
  savedSettings?: IMarketPresetSavedSettings;
}): IMarketPresetSavedSettings | undefined {
  if (!savedSettings) {
    return undefined;
  }

  const presetKeys = new Set(
    (config?.presets ?? MARKET_PRESET_ITEMS).map((item) => item.key),
  );
  const priorityFeeTypes = new Set(
    config?.priorityFee.supportedTypes ?? [
      EMarketPresetPriorityFeeType.MARKET,
      EMarketPresetPriorityFeeType.FAST,
      EMarketPresetPriorityFeeType.CUSTOM,
    ],
  );
  const nextSettings: IMarketPresetSavedSettings = {};

  if (
    isMarketPresetKey(savedSettings.selectedPresetKey) &&
    presetKeys.has(savedSettings.selectedPresetKey)
  ) {
    nextSettings.selectedPresetKey = savedSettings.selectedPresetKey;
  }

  Object.entries(savedSettings.presets ?? {}).forEach(
    ([presetKey, presetSettings]) => {
      if (!isMarketPresetKey(presetKey) || !presetKeys.has(presetKey)) {
        return;
      }

      Object.entries(presetSettings ?? {}).forEach(
        ([tradeSide, directionSettings]) => {
          if (!isMarketPresetTradeSide(tradeSide)) {
            return;
          }

          const slippageKey = isSwapSlippageSegmentKey(
            directionSettings?.slippage?.key,
          )
            ? directionSettings.slippage.key
            : ESwapSlippageSegmentKey.AUTO;
          const priorityFeeType =
            isMarketPresetPriorityFeeType(
              directionSettings?.priorityFee?.type,
            ) && priorityFeeTypes.has(directionSettings.priorityFee.type)
              ? directionSettings.priorityFee.type
              : EMarketPresetPriorityFeeType.MARKET;

          nextSettings.presets = {
            ...nextSettings.presets,
            [presetKey]: {
              ...nextSettings.presets?.[presetKey],
              [tradeSide]: {
                slippage: {
                  key: slippageKey,
                  value:
                    typeof directionSettings?.slippage?.value === 'number' &&
                    Number.isFinite(directionSettings.slippage.value)
                      ? directionSettings.slippage.value
                      : undefined,
                },
                priorityFee: {
                  type: priorityFeeType,
                  customValue:
                    typeof directionSettings?.priorityFee?.customValue ===
                      'string' &&
                    isValidMarketPresetCustomValue(
                      directionSettings.priorityFee.customValue,
                      config,
                    )
                      ? directionSettings.priorityFee.customValue
                      : undefined,
                },
              },
            },
          };
        },
      );
    },
  );

  return nextSettings;
}
