import type { IDeriveTypesCollapseState } from '@onekeyhq/kit-bg/src/services/ServiceToken';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import deriveTypeCollapseUtils from '@onekeyhq/shared/src/utils/deriveTypeCollapseUtils';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { usePromiseResult } from './usePromiseResult';

const NOT_COLLAPSED: IDeriveTypesCollapseState = { collapsed: false };

// Answered locally, without a background round trip. Imported and watching
// accounts have a single address type and never collapse.
export function canDeriveTypesCollapse({
  networkId,
  walletId,
}: {
  networkId: string | undefined;
  walletId: string | undefined;
}): boolean {
  return (
    deriveTypeCollapseUtils.isDeriveTypeCollapseSupportedNetwork({
      networkId,
    }) && !accountUtils.isOthersWallet({ walletId: walletId ?? '' })
  );
}

// Whether the account shows only its default address type on this network.
// Decided once per account: a page keeps the answer it opened with unless it
// opts into `revalidateOnFocus` or bumps `revision`.
export function useDeriveTypesCollapseState({
  networkId,
  walletId,
  indexedAccountId,
  activeDeriveType,
  enabled = true,
  revalidateOnFocus,
  revision = 0,
}: {
  networkId: string | undefined;
  walletId: string | undefined;
  indexedAccountId: string | undefined;
  // The address type the caller currently shows, if it tracks one.
  activeDeriveType?: IAccountDeriveTypes;
  enabled?: boolean;
  revalidateOnFocus?: boolean;
  // Bumped after the default address type changed: the previous answer is
  // dropped (not ready again) instead of kept, so nothing renders from it.
  revision?: number;
}) {
  const isApplicable =
    enabled && canDeriveTypesCollapse({ networkId, walletId });
  // The account may still be loading on the caller's side.
  const queryKey =
    isApplicable && networkId && indexedAccountId
      ? `${networkId}__${indexedAccountId}__${revision}`
      : undefined;

  const { result } = usePromiseResult(
    async () => {
      if (!queryKey || !networkId) {
        return undefined;
      }
      try {
        const state =
          await backgroundApiProxy.serviceToken.getDeriveTypesCollapseState({
            networkId,
            indexedAccountId,
          });
        return { queryKey, state };
      } catch (_error) {
        // A failed round trip to the background must not leave the page
        // waiting forever: fall back to showing every address type.
        return { queryKey, state: NOT_COLLAPSED };
      }
    },
    [queryKey, networkId, indexedAccountId],
    { revalidateOnFocus },
  );

  // An answer for another account is not an answer: stay not ready until this
  // account's own arrives. A revalidation keeps the previous answer meanwhile,
  // so nothing flickers.
  let state: IDeriveTypesCollapseState | undefined;
  if (!isApplicable) {
    state = NOT_COLLAPSED;
  } else if (queryKey && result?.queryKey === queryKey) {
    state = result.state;
  }
  const defaultNetworkAccount = state?.collapsed
    ? state.defaultNetworkAccount
    : undefined;

  return {
    isReady: !!state,
    collapsed: !!defaultNetworkAccount,
    defaultNetworkAccount,
    // Address type UI is held back until the answer arrives instead of being
    // flashed. A type other than the default one stays visible even when
    // collapsed: it only happens on stale balances, and the user must see what
    // is in use.
    isAddressTypeHidden:
      !state ||
      (!!defaultNetworkAccount &&
        (!activeDeriveType ||
          activeDeriveType === defaultNetworkAccount.deriveType)),
  };
}
