import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import { getSwapTokenIdentityKey } from '@onekeyhq/shared/src/utils/swapTokenIdentity';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

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
  addressInfoReady,
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
  addressInfoReady?: boolean;
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
    token: token ? getSwapTokenIdentityKey(token) : undefined,
    owner: {
      walletId,
      indexedAccountId,
      accountId,
      isAddressInfoReady: addressInfoReady,
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

export function isSwapTokenDetailAddressInfoReady({
  direction,
  addressInfoReady,
  targetAddressInfoReady,
}: {
  direction: ESwapDirectionType;
  addressInfoReady: boolean;
  targetAddressInfoReady?: boolean;
}) {
  return Boolean(
    addressInfoReady &&
    (direction !== ESwapDirectionType.TO || targetAddressInfoReady),
  );
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

function isSwapTokenDetailRequestKeyCurrent({
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
  addressInfoReady,
  direction,
  initialSelectedTokensSynced,
  isCurrentDisplayToken,
  key,
  state,
}: {
  addressInfoReady: boolean;
  direction: ESwapDirectionType;
  initialSelectedTokensSynced: boolean;
  isCurrentDisplayToken: boolean;
  key: string;
  state: ISwapTokenDetailRequestState;
}) {
  return Boolean(
    addressInfoReady &&
    initialSelectedTokensSynced &&
    isCurrentDisplayToken &&
    isSwapTokenDetailRequestKeyCurrent({ direction, key, state }),
  );
}
