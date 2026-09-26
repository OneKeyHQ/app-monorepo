import { useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { classifyWorth } from './homeBalanceState';

import type { IWorthEvidence } from './homeBalanceState';

export interface IPersistedOwnerWorthParams {
  accountId: string | undefined;
  indexedAccountId: string | undefined;
  networkId: string | undefined;
  isAllNetworks: boolean | undefined;
}

function buildOwnerKey({
  accountId,
  indexedAccountId,
  networkId,
  isAllNetworks,
}: IPersistedOwnerWorthParams) {
  if (!accountId || !networkId) {
    return '';
  }
  return `${accountId}__${indexedAccountId ?? ''}__${networkId}__${
    isAllNetworks ? 'all' : 'single'
  }`;
}

async function loadPersistedOwnerWorth({
  accountId,
  indexedAccountId,
  networkId,
  isAllNetworks,
}: IPersistedOwnerWorthParams): Promise<IWorthEvidence> {
  if (!accountId || !networkId) {
    return undefined;
  }
  const { serviceAccountProfile } = backgroundApiProxy;
  if (isAllNetworks) {
    // Same aggregation the account selector row uses: every derive type of an
    // HD/HW indexed account summed per network, or the Others account itself.
    const result = indexedAccountId
      ? await serviceAccountProfile.getAllNetworkAccountsValueByIndexedAccount({
          indexedAccountId,
        })
      : await serviceAccountProfile.getAllNetworkAccountsValueByAccountId({
          accountId,
        });
    return classifyWorth(result?.value);
  }
  const [result] = await serviceAccountProfile.getAccountsValue({
    accounts: [{ accountId, networkId }],
  });
  return classifyWorth(result?.value);
}

// The header and the action row both subscribe for the same owner in the same
// commit; one storage read serves both.
const inFlightByOwner = new Map<string, Promise<IWorthEvidence>>();

/**
 * The owner's last persisted worth (`simpleDb.accountValue`, what the account
 * selector row shows), classified as evidence for `useHomeBalanceState`.
 * `undefined` until the read settles, when there is nothing persisted, or
 * whenever the value on hand belongs to a previous owner.
 */
export function usePersistedOwnerWorth(
  params: IPersistedOwnerWorthParams,
): IWorthEvidence {
  const { accountId, indexedAccountId, networkId, isAllNetworks } = params;
  const ownerKey = buildOwnerKey(params);
  const [loaded, setLoaded] = useState<{
    ownerKey: string;
    worth: IWorthEvidence;
  }>();

  useEffect(() => {
    if (!ownerKey) {
      return undefined;
    }
    let cancelled = false;
    let pending = inFlightByOwner.get(ownerKey);
    if (!pending) {
      pending = loadPersistedOwnerWorth({
        accountId,
        indexedAccountId,
        networkId,
        isAllNetworks,
      })
        .catch(() => undefined)
        .finally(() => {
          inFlightByOwner.delete(ownerKey);
        });
      inFlightByOwner.set(ownerKey, pending);
    }
    void pending.then((worth) => {
      if (!cancelled) {
        setLoaded({ ownerKey, worth });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ownerKey, accountId, indexedAccountId, networkId, isAllNetworks]);

  return loaded?.ownerKey === ownerKey ? loaded.worth : undefined;
}
