import { useCallback } from 'react';

import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

export type ISwapProPositionsRequestGeneration = {
  ownerKey: string;
  requestId: number;
};

export type ISwapProPositionsOwnerRequestScope = {
  baselineRequestId: number;
  ownerKey: string;
  sessionId: number;
};

export function resolveSwapProPositionsAccountIdentity({
  activeAccount,
  selectedAccount,
}: {
  activeAccount?: {
    ready?: boolean;
    indexedAccount?: { id?: string };
    account?: { id?: string };
    dbAccount?: { id?: string };
  };
  selectedAccount: {
    indexedAccountId?: string;
    othersWalletAccountId?: string;
  };
}) {
  let indexedAccountId: string | undefined;
  let otherWalletTypeAccountId: string | undefined;
  if (selectedAccount.indexedAccountId) {
    indexedAccountId = selectedAccount.indexedAccountId;
  } else if (selectedAccount.othersWalletAccountId) {
    otherWalletTypeAccountId = selectedAccount.othersWalletAccountId;
  } else if (activeAccount?.indexedAccount?.id) {
    indexedAccountId = activeAccount.indexedAccount.id;
  } else {
    otherWalletTypeAccountId =
      activeAccount?.account?.id ?? activeAccount?.dbAccount?.id;
  }

  return {
    accountId: indexedAccountId ?? otherWalletTypeAccountId,
    identityReady: Boolean(
      selectedAccount.indexedAccountId ||
      selectedAccount.othersWalletAccountId ||
      activeAccount?.ready,
    ),
    indexedAccountId,
    otherWalletTypeAccountId,
  };
}

export function buildSwapProPositionsNetworkIdsKey(
  networkList: { networkId: string }[],
) {
  return networkList
    .map((item) => item.networkId)
    .filter(Boolean)
    .toSorted()
    .join(',');
}

export function isSwapProPositionsSourceUnavailable({
  accountId,
  identityReady,
}: {
  accountId?: string;
  identityReady: boolean;
}) {
  return identityReady && !accountId;
}

export function advanceSwapProPositionsOwnerRequestScope({
  currentRequestId,
  currentScope,
  ownerKey,
}: {
  currentRequestId: number;
  currentScope: ISwapProPositionsOwnerRequestScope;
  ownerKey: string;
}): ISwapProPositionsOwnerRequestScope {
  if (currentScope.ownerKey === ownerKey) {
    return currentScope;
  }
  return {
    baselineRequestId: currentRequestId,
    ownerKey,
    sessionId: currentScope.sessionId + 1,
  };
}

export function isSwapProPositionsOwnerRequestScopeSettled({
  currentScope,
  settledScope,
}: {
  currentScope: ISwapProPositionsOwnerRequestScope;
  settledScope?: ISwapProPositionsOwnerRequestScope;
}) {
  return Boolean(
    currentScope.ownerKey &&
    settledScope?.ownerKey === currentScope.ownerKey &&
    settledScope.sessionId === currentScope.sessionId,
  );
}

export function hasSwapProPositionsOwnerRequestSettledSince({
  baselineRequestId,
  currentRequestState,
  ownerKey,
}: {
  baselineRequestId: number;
  currentRequestState: {
    ownerKey: string;
    requestId: number;
    status: 'idle' | 'loading' | 'settled' | 'error';
  };
  ownerKey: string;
}) {
  return Boolean(
    ownerKey &&
    currentRequestState.ownerKey === ownerKey &&
    currentRequestState.requestId > baselineRequestId &&
    (currentRequestState.status === 'settled' ||
      currentRequestState.status === 'error'),
  );
}

export function isSwapProPositionsRequestGenerationCurrent({
  current,
  expectedOwnerKey,
  expectedRequestId,
}: {
  current: { ownerKey: string; requestId: number };
  expectedOwnerKey: string;
  expectedRequestId: number;
}) {
  return (
    Boolean(expectedOwnerKey) &&
    current.ownerKey === expectedOwnerKey &&
    current.requestId === expectedRequestId
  );
}

export function useSwapProPositionsGenerationGuardedCallback<TPayload>({
  currentRequestStateRef,
  onCurrentGenerationEvent,
  ownerKey,
}: {
  currentRequestStateRef: {
    current: ISwapProPositionsRequestGeneration;
  };
  onCurrentGenerationEvent: (
    payload: TPayload,
    generation: ISwapProPositionsRequestGeneration,
  ) => Promise<void> | void;
  ownerKey: string;
}) {
  return useCallback(
    (payload: TPayload) => {
      const currentRequestState = currentRequestStateRef.current;
      if (
        !isSwapProPositionsRequestGenerationCurrent({
          current: currentRequestState,
          expectedOwnerKey: ownerKey,
          expectedRequestId: currentRequestState.requestId,
        })
      ) {
        return undefined;
      }
      return onCurrentGenerationEvent(payload, {
        ownerKey,
        requestId: currentRequestState.requestId,
      });
    },
    [currentRequestStateRef, onCurrentGenerationEvent, ownerKey],
  );
}

export function mergeSwapProPositionTokenDetails(
  tokens: ISwapToken[],
  tokenDetails: ISwapToken[],
) {
  const updatedTokens = [...tokens];
  for (const tokenDetail of tokenDetails) {
    const existingIndex = updatedTokens.findIndex((token) =>
      equalTokenNoCaseSensitive({ token1: token, token2: tokenDetail }),
    );
    const nextToken = {
      ...tokenDetail,
      balanceParsed: tokenDetail.balanceParsed ?? '',
      fiatValue: tokenDetail.fiatValue ?? '',
      price: tokenDetail.price ?? '',
    } as ISwapToken;
    if (existingIndex === -1) {
      updatedTokens.push(nextToken);
    } else {
      updatedTokens[existingIndex] = {
        ...updatedTokens[existingIndex],
        balanceParsed: nextToken.balanceParsed,
        fiatValue: nextToken.fiatValue,
        price: nextToken.price,
      };
    }
  }
  return updatedTokens;
}
