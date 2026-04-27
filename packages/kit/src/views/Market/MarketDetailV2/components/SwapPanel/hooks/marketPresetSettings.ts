import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import { ESwapNetworkFeeLevel } from '@onekeyhq/shared/types/swap/types';

export enum EMarketPresetKey {
  AUTO = 'auto',
  P1 = 'p1',
  P2 = 'p2',
  P3 = 'p3',
}

export enum EMarketPresetPriorityFeeType {
  MARKET = 'market',
  FAST = 'fast',
  CUSTOM = 'custom',
}

export type IMarketPresetItem = {
  key: EMarketPresetKey;
  label: string;
  slippage: {
    editable: boolean;
    value?: number;
  };
  priorityFee: {
    editable: boolean;
    type: EMarketPresetPriorityFeeType;
    networkFeeLevel?: ESwapNetworkFeeLevel;
  };
};

export type IMarketPresetConfig = {
  enabled: boolean;
  networkId: string;
  defaultPresetKey: EMarketPresetKey;
  presets: IMarketPresetItem[];
};

const DEFAULT_MARKET_PRESETS: IMarketPresetItem[] = [
  {
    key: EMarketPresetKey.AUTO,
    label: 'Auto',
    slippage: {
      editable: false,
    },
    priorityFee: {
      editable: false,
      type: EMarketPresetPriorityFeeType.MARKET,
      networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
    },
  },
  {
    key: EMarketPresetKey.P1,
    label: 'P1',
    slippage: {
      editable: true,
      value: 0.5,
    },
    priorityFee: {
      editable: true,
      type: EMarketPresetPriorityFeeType.MARKET,
      networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
    },
  },
  {
    key: EMarketPresetKey.P2,
    label: 'P2',
    slippage: {
      editable: true,
      value: 1,
    },
    priorityFee: {
      editable: true,
      type: EMarketPresetPriorityFeeType.FAST,
      networkFeeLevel: ESwapNetworkFeeLevel.HIGH,
    },
  },
  {
    key: EMarketPresetKey.P3,
    label: 'P3',
    slippage: {
      editable: true,
      value: 3,
    },
    priorityFee: {
      editable: true,
      type: EMarketPresetPriorityFeeType.FAST,
      networkFeeLevel: ESwapNetworkFeeLevel.HIGH,
    },
  },
];

const DASHBOARD_FALLBACK_NETWORK_IDS = new Set([
  presetNetworksMap.bsc.id,
  presetNetworksMap.eth.id,
  presetNetworksMap.base.id,
  presetNetworksMap.arbitrum.id,
]);

async function fetchMarketPresetDashboardConfig(_params: {
  networkId: string;
}): Promise<IMarketPresetConfig | undefined> {
  return undefined;
}

function buildFallbackMarketPresetConfig(
  networkId: string,
): IMarketPresetConfig | undefined {
  if (!DASHBOARD_FALLBACK_NETWORK_IDS.has(networkId)) {
    return undefined;
  }

  return {
    enabled: true,
    networkId,
    defaultPresetKey: EMarketPresetKey.AUTO,
    presets: DEFAULT_MARKET_PRESETS,
  };
}

export async function fetchMarketPresetConfig(params: {
  networkId: string;
}): Promise<IMarketPresetConfig | undefined> {
  const dashboardConfig = await fetchMarketPresetDashboardConfig(params);

  return dashboardConfig ?? buildFallbackMarketPresetConfig(params.networkId);
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

export function getMarketPresetSlippageValue({
  preset,
  defaultSlippage,
}: {
  preset?: IMarketPresetItem;
  defaultSlippage: number;
}) {
  return preset?.slippage.value ?? defaultSlippage;
}

export function getMarketPresetNetworkFeeLevel(preset?: IMarketPresetItem) {
  return preset?.priorityFee.networkFeeLevel ?? ESwapNetworkFeeLevel.MEDIUM;
}
