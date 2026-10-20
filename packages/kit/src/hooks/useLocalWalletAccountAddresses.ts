import { useEffect, useState } from 'react';

import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import type { IPrivacyChainAccountAddresses } from '@onekeyhq/shared/src/utils/privacyChainDisplayUtils';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

type ILocalWalletAccountAddresses = IPrivacyChainAccountAddresses | null;

// One request per (network, account), shared by every history row; failed
// reads are not kept, and enabling or pausing an account drops its entry.
const settledAddresses = new Map<string, ILocalWalletAccountAddresses>();
const pendingAddresses = new Map<
  string,
  Promise<ILocalWalletAccountAddresses | undefined>
>();
const invalidationListeners = new Set<(key: string) => void>();

const addressesKey = (networkId: string, accountId: string) =>
  `${networkId}:${accountId}`;

appEventBus.on(
  EAppEventBusNames.LocalWalletAccountsChanged,
  ({ networkId, accountIds }) => {
    for (const accountId of accountIds) {
      const key = addressesKey(networkId, accountId);
      settledAddresses.delete(key);
      pendingAddresses.delete(key);
      invalidationListeners.forEach((listener) => listener(key));
    }
  },
);

// Resolves undefined when the read failed.
export function loadLocalWalletAccountAddresses({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}): Promise<ILocalWalletAccountAddresses | undefined> {
  const key = addressesKey(networkId, accountId);
  if (settledAddresses.has(key)) {
    return Promise.resolve(settledAddresses.get(key) ?? null);
  }
  const pending = pendingAddresses.get(key);
  if (pending) return pending;
  const request = backgroundApiProxy.servicePrivacyChain
    .getLocalWalletAccountAddresses({ networkId, accountId })
    .then(
      (addresses) => {
        // A result started before an invalidation is not kept.
        if (pendingAddresses.get(key) === request) {
          settledAddresses.set(key, addresses ?? null);
        }
        return addresses ?? null;
      },
      () => undefined,
    )
    .finally(() => {
      if (pendingAddresses.get(key) === request) pendingAddresses.delete(key);
    });
  pendingAddresses.set(key, request);
  return request;
}

// The account's addresses from the same source as the Receive and token
// details pages, so history shows this account's side identically. Disabled,
// it neither requests nor re-renders.
export function useLocalWalletAccountAddresses({
  accountId,
  networkId,
  enabled,
}: {
  accountId?: string;
  networkId?: string;
  enabled: boolean;
}): IPrivacyChainAccountAddresses | null | undefined {
  const [state, setState] = useState<{
    key: string;
    addresses: ILocalWalletAccountAddresses;
  }>();
  const [revision, setRevision] = useState(0);
  const key = addressesKey(networkId ?? '', accountId ?? '');
  useEffect(() => {
    if (!enabled || !accountId || !networkId) return;
    let alive = true;
    const onInvalidate = (changedKey: string) => {
      if (changedKey !== key) return;
      setState(undefined);
      setRevision((value) => value + 1);
    };
    invalidationListeners.add(onInvalidate);
    void loadLocalWalletAccountAddresses({ networkId, accountId }).then(
      (addresses) => {
        if (alive && addresses !== undefined) setState({ key, addresses });
      },
    );
    return () => {
      alive = false;
      invalidationListeners.delete(onInvalidate);
    };
  }, [enabled, accountId, networkId, key, revision]);
  if (!enabled) return undefined;
  // Reuse a result another row already loaded, so the row renders it at once.
  return state?.key === key ? state.addresses : settledAddresses.get(key);
}
