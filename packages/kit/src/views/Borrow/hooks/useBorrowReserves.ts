import { useCallback, useEffect, useSyncExternalStore } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  IBorrowReserveItem,
  IBorrowReserveRequestParams,
} from '@onekeyhq/shared/types/staking';

const inFlightReserves = new Map<string, Promise<IBorrowReserveItem>>();
let hasRegisteredAccountInvalidation = false;
let lastAccountInvalidationAt = 0;
let accountGeneration = 0;
const accountGenerationListeners = new Set<() => void>();

function hasText(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as { text?: unknown }).text === 'string',
  );
}

function hasPositionAmount(asset: Record<string, unknown>, key: string) {
  const amount = asset[key] as
    | { title?: unknown; description?: unknown }
    | undefined;
  return hasText(amount?.title) && hasText(amount?.description);
}

function hasAssetList(
  value: unknown,
  positionAmountKey?: 'suppliedAmount' | 'borrowedAmount',
): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const assets = (value as { assets?: unknown }).assets;
  return (
    Array.isArray(assets) &&
    assets.every((entry: unknown) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return false;
      }
      const asset = entry as Record<string, unknown>;
      const token = asset.token as { symbol?: unknown } | undefined;
      return (
        typeof asset.reserveAddress === 'string' &&
        token &&
        typeof token.symbol === 'string' &&
        (!positionAmountKey || hasPositionAmount(asset, positionAmountKey))
      );
    })
  );
}

// A successful HTTP response can still omit the payload. Zero balances and
// empty asset lists are valid; the sections needed to render the page are not
// optional in the reserves contract.
export function isBorrowReservesPayloadUsable(
  value: unknown,
): value is IBorrowReserveItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const data = value as Partial<IBorrowReserveItem>;
  return Boolean(
    data.overview &&
    hasText(data.overview.netWorth) &&
    hasText(data.overview.netApy) &&
    hasText(data.supplied?.suppliedBalance?.title) &&
    hasText(data.supplied?.suppliedApy?.title) &&
    hasText(data.borrowed?.borrowedBalance?.title) &&
    hasText(data.borrowed?.borrowedApy?.title) &&
    hasAssetList(data.supplied, 'suppliedAmount') &&
    hasAssetList(data.borrowed, 'borrowedAmount') &&
    hasAssetList(data.supply) &&
    hasAssetList(data.borrow),
  );
}

class BorrowReservesRequestSupersededError extends OneKeyLocalError {
  constructor() {
    super('Borrow reserves request superseded');
  }
}

export function isBorrowReservesRequestSuperseded(error: unknown) {
  return error instanceof BorrowReservesRequestSupersededError;
}

function subscribeAccountGeneration(listener: () => void) {
  accountGenerationListeners.add(listener);
  return () => accountGenerationListeners.delete(listener);
}

function getAccountGeneration() {
  return accountGeneration;
}

export function isBorrowReservesCacheReusable(updatedAt: number) {
  return updatedAt > lastAccountInvalidationAt;
}

// A response that settles in the same millisecond as an account mutation must
// still belong to the new generation. Keep its timestamp strictly after the
// invalidation boundary so the display cache does not reject a valid result.
export function getBorrowReservesCacheUpdatedAt() {
  return Math.max(Date.now(), lastAccountInvalidationAt + 1);
}

function registerAccountInvalidation() {
  if (hasRegisteredAccountInvalidation) {
    return;
  }
  hasRegisteredAccountInvalidation = true;
  const clearInFlightReserves = () => {
    inFlightReserves.clear();
    lastAccountInvalidationAt = Date.now();
    accountGeneration += 1;
    accountGenerationListeners.forEach((listener) => listener());
  };
  appEventBus.on(EAppEventBusNames.WalletClear, clearInFlightReserves);
  appEventBus.on(EAppEventBusNames.AccountRemove, clearInFlightReserves);
  appEventBus.on(EAppEventBusNames.AccountUpdate, clearInFlightReserves);
  appEventBus.on(
    EAppEventBusNames.GlobalDeriveTypeUpdate,
    clearInFlightReserves,
  );
  appEventBus.on(
    EAppEventBusNames.NetworkDeriveTypeChanged,
    clearInFlightReserves,
  );
}

function fetchBorrowReserves(
  params: IBorrowReserveRequestParams,
  options?: { forceNew?: boolean },
) {
  registerAccountInvalidation();
  const requestKey = JSON.stringify([
    params.provider,
    params.networkId,
    params.marketAddress,
    params.accountId ?? null,
  ]);
  const existingRequest = inFlightReserves.get(requestKey);
  if (existingRequest && !options?.forceNew) {
    return existingRequest;
  }
  const requestGeneration = accountGeneration;
  const request: Promise<IBorrowReserveItem> = Promise.resolve()
    .then(() => backgroundApiProxy.serviceStaking.getBorrowReserves(params))
    .then((data) => {
      if (
        requestGeneration !== accountGeneration ||
        inFlightReserves.get(requestKey) !== request
      ) {
        throw new BorrowReservesRequestSupersededError();
      }
      if (!isBorrowReservesPayloadUsable(data)) {
        throw new OneKeyLocalError('Invalid Borrow reserves response');
      }
      return data;
    });
  inFlightReserves.set(requestKey, request);
  const clearSettledRequest = () => {
    if (inFlightReserves.get(requestKey) === request) {
      inFlightReserves.delete(requestKey);
    }
  };
  void request.then(clearSettledRequest, clearSettledRequest);
  return request;
}

export const useBorrowReserves = () => {
  useEffect(registerAccountInvalidation, []);
  const accountRevision = useSyncExternalStore(
    subscribeAccountGeneration,
    getAccountGeneration,
  );
  const fetchReserves = useCallback(fetchBorrowReserves, []);

  return { fetchReserves, accountRevision };
};
