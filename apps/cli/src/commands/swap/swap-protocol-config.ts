import { ESwapCrossChainStatus } from '@onekeyhq/shared/types/swap/types';

export interface IProtocolConfig {
  protocol: 'Swap' | 'Bridge';
  statusPollIntervalMs: number;
  statusMaxPollAttempts: number;
  pendingExpiryMs: number;
  progressStages: string[];
  finalStates: Set<string>;
  mapApiState: (state: string) => {
    label: string;
    stage: number;
    total: number;
    isFinal: boolean;
  };
}

export const SWAP_CONFIG: IProtocolConfig = {
  protocol: 'Swap',
  statusPollIntervalMs: 3000,
  statusMaxPollAttempts: 10,
  pendingExpiryMs: 5 * 60_000,
  progressStages: ['pending'],
  finalStates: new Set(['success', 'failed', 'canceled']),
  mapApiState: (state: string) => {
    const isFinal =
      state === 'success' || state === 'failed' || state === 'canceled';
    const labelMap: Record<string, string> = {
      success: 'Completed',
      failed: 'Failed',
      canceled: 'Canceled',
      pending: 'Pending...',
    };
    return {
      label: labelMap[state] ?? `Unknown (${state})`,
      stage: 1,
      total: 1,
      isFinal,
    };
  },
};

const BRIDGE_STATE_MAP: Record<
  string,
  { label: string; stage: number; isFinal: boolean }
> = {
  [ESwapCrossChainStatus.FROM_PENDING]: {
    label: 'Source chain tx pending...',
    stage: 1,
    isFinal: false,
  },
  [ESwapCrossChainStatus.FROM_SUCCESS]: {
    label: 'Source chain tx confirmed',
    stage: 1,
    isFinal: false,
  },
  [ESwapCrossChainStatus.FROM_FAILED]: {
    label: 'Source chain tx failed',
    stage: 1,
    isFinal: true,
  },
  [ESwapCrossChainStatus.BRIDGE_PENDING]: {
    label: 'Bridge transfer in progress...',
    stage: 2,
    isFinal: false,
  },
  [ESwapCrossChainStatus.BRIDGE_SUCCESS]: {
    label: 'Bridge transfer completed',
    stage: 2,
    isFinal: false,
  },
  [ESwapCrossChainStatus.BRIDGE_FAILED]: {
    label: 'Bridge transfer failed',
    stage: 2,
    isFinal: true,
  },
  [ESwapCrossChainStatus.TO_PENDING]: {
    label: 'Destination chain tx pending...',
    stage: 3,
    isFinal: false,
  },
  [ESwapCrossChainStatus.TO_SUCCESS]: {
    label: 'Completed',
    stage: 3,
    isFinal: true,
  },
  [ESwapCrossChainStatus.TO_FAILED]: {
    label: 'Destination chain tx failed',
    stage: 3,
    isFinal: true,
  },
  [ESwapCrossChainStatus.REFUNDING]: {
    label: 'Refund in progress...',
    stage: 0,
    isFinal: false,
  },
  [ESwapCrossChainStatus.REFUNDED]: {
    label: 'Refunded',
    stage: 0,
    isFinal: true,
  },
  [ESwapCrossChainStatus.REFUND_FAILED]: {
    label: 'Refund failed',
    stage: 0,
    isFinal: true,
  },
  [ESwapCrossChainStatus.EXPIRED]: {
    label: 'Expired',
    stage: 0,
    isFinal: true,
  },
  [ESwapCrossChainStatus.PROVIDER_ERROR]: {
    label: 'Provider error',
    stage: 0,
    isFinal: true,
  },
};

export const BRIDGE_CONFIG: IProtocolConfig = {
  protocol: 'Bridge',
  statusPollIntervalMs: 10_000,
  statusMaxPollAttempts: 60,
  pendingExpiryMs: 30 * 60_000,
  progressStages: ['from', 'bridge', 'to'],
  finalStates: new Set([
    ESwapCrossChainStatus.FROM_FAILED,
    ESwapCrossChainStatus.BRIDGE_FAILED,
    ESwapCrossChainStatus.TO_FAILED,
    ESwapCrossChainStatus.TO_SUCCESS,
    ESwapCrossChainStatus.REFUNDED,
    ESwapCrossChainStatus.REFUND_FAILED,
    ESwapCrossChainStatus.EXPIRED,
    ESwapCrossChainStatus.PROVIDER_ERROR,
  ]),
  mapApiState: (state: string) => {
    const entry = BRIDGE_STATE_MAP[state];
    if (entry) {
      return { ...entry, total: 3 };
    }
    return { label: `Unknown (${state})`, stage: 0, total: 3, isFinal: false };
  },
};

export function getProtocolConfig(
  fromNetworkId: string,
  toNetworkId: string,
): IProtocolConfig {
  return fromNetworkId === toNetworkId ? SWAP_CONFIG : BRIDGE_CONFIG;
}
