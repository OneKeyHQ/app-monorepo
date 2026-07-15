import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  ESwapDirectionType,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

export type ISwapTokenDetailRequestIdentity = {
  key: string;
  revision: number;
};

export type ISwapTokenDetailRequestState = Partial<
  Record<ESwapDirectionType, ISwapTokenDetailRequestIdentity>
>;

export function buildSwapTokenDetailRequestKey({
  accountAddress,
  accountId,
  dbAccountId,
  deriveType,
  direction,
  indexedAccountId,
  resolvedNetworkId,
  targetAccountAddress,
  targetAccountId,
  targetAddressInfoReady,
  targetDbAccountId,
  targetDeriveType,
  targetIndexedAccountId,
  targetNetworkId,
  targetWalletId,
  token,
  walletId,
}: {
  direction: ESwapDirectionType;
  token?: ISwapToken;
  walletId?: string;
  indexedAccountId?: string;
  accountId?: string;
  dbAccountId?: string;
  deriveType?: string;
  accountAddress?: string;
  resolvedNetworkId?: string;
  targetWalletId?: string;
  targetIndexedAccountId?: string;
  targetAccountId?: string;
  targetDbAccountId?: string;
  targetDeriveType?: string;
  targetAccountAddress?: string;
  targetNetworkId?: string;
  targetAddressInfoReady?: boolean;
}) {
  return stableStringify({
    direction,
    token: token
      ? {
          networkId: token.networkId,
          contractAddress: token.contractAddress,
        }
      : undefined,
    owner: {
      walletId,
      indexedAccountId,
      accountId,
      dbAccountId,
      deriveType,
      accountAddress,
      resolvedNetworkId,
    },
    targetOwner: {
      walletId: targetWalletId,
      indexedAccountId: targetIndexedAccountId,
      accountId: targetAccountId,
      dbAccountId: targetDbAccountId,
      deriveType: targetDeriveType,
      accountAddress: targetAccountAddress,
      networkId: targetNetworkId,
      isAddressInfoReady: targetAddressInfoReady,
    },
  });
}

export function startSwapTokenDetailRequest({
  direction,
  key,
  state,
}: {
  direction: ESwapDirectionType;
  key: string;
  state: ISwapTokenDetailRequestState;
}) {
  const previous = state[direction];
  const identity: ISwapTokenDetailRequestIdentity = {
    key,
    revision: (previous?.revision ?? 0) + 1,
  };
  return {
    identity,
    isSameResource: previous?.key === key,
    state: {
      ...state,
      [direction]: identity,
    },
  };
}

export function isCurrentSwapTokenDetailRequest({
  direction,
  identity,
  state,
}: {
  direction: ESwapDirectionType;
  identity: ISwapTokenDetailRequestIdentity;
  state: ISwapTokenDetailRequestState;
}) {
  const current = state[direction];
  return (
    current?.key === identity.key && current.revision === identity.revision
  );
}

export function isSwapTokenDetailRequestKeyCurrent({
  direction,
  key,
  state,
}: {
  direction: ESwapDirectionType;
  key: string;
  state: ISwapTokenDetailRequestState;
}) {
  return state[direction]?.key === key;
}

export function isSwapTokenDetailBalanceVisible({
  direction,
  initialSelectedTokensSynced,
  isCurrentDisplayToken,
  key,
  state,
}: {
  direction: ESwapDirectionType;
  initialSelectedTokensSynced: boolean;
  isCurrentDisplayToken: boolean;
  key: string;
  state: ISwapTokenDetailRequestState;
}) {
  return Boolean(
    initialSelectedTokensSynced &&
    isCurrentDisplayToken &&
    isSwapTokenDetailRequestKeyCurrent({ direction, key, state }),
  );
}
