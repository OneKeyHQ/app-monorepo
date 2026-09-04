import bulkSendUtils from '@onekeyhq/shared/src/utils/bulkSendUtils';
import type {
  EBulkSendMode,
  IBulkSendAddressesInputSeed,
  IBulkSendAddressesInputSeedParams,
  IBulkSendAddressesInputSeedSender,
} from '@onekeyhq/shared/types/bulkSend';
import type { IToken } from '@onekeyhq/shared/types/token';

import type { ITokenDetailsState } from './components/Context';

export type IBulkSendHomeSeedAccount = {
  accountId: string | undefined;
  indexedAccountId: string | undefined;
  networkId: string | undefined;
};

/**
 * Route params win per field; anything the entry point did not pass comes
 * from the home account snapshot (see homeAccountSeedUtils for why that
 * snapshot only refreshes on identity changes).
 */
export function buildBulkSendSeedSource({
  routeParams,
  homeSeedAccount,
  bulkSendMode,
}: {
  routeParams: {
    networkId?: string;
    accountId?: string;
    indexedAccountId?: string;
    tokenInfo?: IToken;
  };
  homeSeedAccount: IBulkSendHomeSeedAccount;
  bulkSendMode: EBulkSendMode;
}): IBulkSendAddressesInputSeedParams {
  return {
    networkId: routeParams.networkId || homeSeedAccount.networkId,
    accountId: routeParams.accountId || homeSeedAccount.accountId,
    indexedAccountId:
      routeParams.indexedAccountId || homeSeedAccount.indexedAccountId,
    tokenInfo: routeParams.tokenInfo,
    bulkSendMode,
  };
}

export function buildBulkSendSeedTokenKey(tokenInfo: IToken | undefined) {
  if (!tokenInfo) {
    return '';
  }
  return `${tokenInfo.networkId ?? ''}:${tokenInfo.address}`;
}

function isSameToken(a: IToken | undefined, b: IToken | undefined) {
  if (!a || !b) {
    return a === b;
  }
  return (
    (a.networkId ?? '') === (b.networkId ?? '') &&
    a.address === b.address &&
    a.symbol === b.symbol &&
    a.decimals === b.decimals &&
    Boolean(a.isNative) === Boolean(b.isNative) &&
    (a.logoURI ?? '') === (b.logoURI ?? '') &&
    (a.networkName ?? '') === (b.networkName ?? '')
  );
}

/**
 * Value comparison for a revalidated seed so an identical snapshot does not
 * re-apply state (which would reset the balance/token-details flow).
 */
export function isBulkSendSeedEqual(
  a: IBulkSendAddressesInputSeed | undefined,
  b: IBulkSendAddressesInputSeed | undefined,
): boolean {
  if (!a || !b) {
    return a === b;
  }
  return (
    (a.accountId ?? '') === (b.accountId ?? '') &&
    (a.indexedAccountId ?? '') === (b.indexedAccountId ?? '') &&
    (a.networkId ?? '') === (b.networkId ?? '') &&
    a.isSupportedNetwork === b.isSupportedNetwork &&
    isSameToken(a.token, b.token) &&
    (a.network?.id ?? '') === (b.network?.id ?? '') &&
    (a.network?.name ?? '') === (b.network?.name ?? '') &&
    (a.network?.logoURI ?? '') === (b.network?.logoURI ?? '') &&
    (a.sender?.address ?? '') === (b.sender?.address ?? '') &&
    (a.sender?.accountName ?? '') === (b.sender?.accountName ?? '') &&
    (a.sender?.walletName ?? '') === (b.sender?.walletName ?? '')
  );
}

/** Same "wallet / account" format the sender validator produces. */
export function buildSeededSenderBadgeLabel(
  sender: IBulkSendAddressesInputSeedSender | undefined,
): string | undefined {
  if (!sender?.walletName || !sender.accountName) {
    return undefined;
  }
  return `${sender.walletName} / ${sender.accountName}`;
}

export function computeBulkSendNextDisabled({
  isFormValid,
  isFormValidating,
  isInitializing,
  isSenderFieldMounted,
  isOneToMany,
  tokenDetailsState,
  hasTokenDetail,
}: {
  isFormValid: boolean;
  isFormValidating: boolean;
  isInitializing: boolean;
  isSenderFieldMounted: boolean;
  isOneToMany: boolean;
  tokenDetailsState: ITokenDetailsState;
  hasTokenDetail: boolean;
}): boolean {
  // The seed and the sender field are explicit gates: react-hook-form
  // reports `isValid=true` while no field is registered, which is exactly
  // the cold-start window where the form subtree has not mounted yet.
  if (isInitializing || !isSenderFieldMounted) {
    return true;
  }
  const baseDisabled = !isFormValid || isFormValidating;
  if (isOneToMany) {
    const isTokenLoading =
      !tokenDetailsState.initialized ||
      (tokenDetailsState.isRefreshing && !hasTokenDetail);
    return baseDisabled || isTokenLoading;
  }
  return baseDisabled;
}

/**
 * Seed used when the background lookup rejects (bridge / db failure). It
 * echoes the request so the page leaves its initializing gate and mounts the
 * form; every derived field is left for the user to pick. Callers must not
 * persist it as an SWR snapshot, so the next entry retries the lookup.
 */
export function buildBulkSendFallbackSeed(
  source: IBulkSendAddressesInputSeedParams,
): IBulkSendAddressesInputSeed {
  const { fixedNetworkId, isSupported } =
    bulkSendUtils.fixBulkSendSupportedNetworkId({
      networkId: source.networkId ?? '',
      bulkSendMode: source.bulkSendMode,
    });
  return {
    // The source account is only valid on its own network; once the network
    // had to be corrected it cannot seed lookups there (see ServiceBulkSend).
    accountId: isSupported ? source.accountId || undefined : undefined,
    indexedAccountId: source.indexedAccountId || undefined,
    networkId: fixedNetworkId || undefined,
    isSupportedNetwork: isSupported,
    token: source.tokenInfo,
  };
}

export type IBulkSendSeedApplyPlan =
  | { action: 'skip' }
  | { action: 'record' }
  | { action: 'apply'; keepUserToken: boolean };

/**
 * Decides what a (re)validated seed may write. The seed only provides the
 * page's initial selection: once the user picked another sender / network on
 * the page, a later seed for a different account (a revalidated snapshot
 * whose metadata changed, or a re-keyed request after a mode switch) is
 * recorded but must not overwrite that choice. A degraded seed (request
 * fallback, or a lookup that lost the account) may only mount an empty page;
 * over an already applied seed it is recorded, never applied. A seed for the
 * selection the user is on may refresh it, keeping an asset the user picked
 * explicitly; a seed that moves the account / network always brings its own
 * token so token and network never come from different applies.
 */
export function resolveBulkSendSeedApplyPlan({
  seed,
  seedKey,
  appliedSeed,
  selectedAccountId,
  selectedNetworkId,
  hasUserSelectedAsset,
  isDegradedSeed,
}: {
  seed: IBulkSendAddressesInputSeed | undefined;
  seedKey: string;
  appliedSeed: { key: string; seed: IBulkSendAddressesInputSeed } | undefined;
  selectedAccountId: string | undefined;
  selectedNetworkId: string | undefined;
  hasUserSelectedAsset: boolean;
  isDegradedSeed: boolean;
}): IBulkSendSeedApplyPlan {
  if (!seed) {
    return { action: 'skip' };
  }
  if (
    appliedSeed?.key === seedKey &&
    isBulkSendSeedEqual(appliedSeed.seed, seed)
  ) {
    return { action: 'skip' };
  }
  if (
    appliedSeed !== undefined &&
    (isDegradedSeed || (!seed.accountId && Boolean(appliedSeed.seed.accountId)))
  ) {
    return { action: 'record' };
  }
  const hasUserChangedSelection =
    appliedSeed !== undefined &&
    ((selectedAccountId ?? '') !== (appliedSeed.seed.accountId ?? '') ||
      (selectedNetworkId ?? '') !== (appliedSeed.seed.networkId ?? ''));
  const isSeedForCurrentSelection =
    (seed.accountId ?? '') === (selectedAccountId ?? '') &&
    (seed.networkId ?? '') === (selectedNetworkId ?? '');
  if (hasUserChangedSelection && !isSeedForCurrentSelection) {
    return { action: 'record' };
  }
  return {
    action: 'apply',
    keepUserToken: hasUserSelectedAsset && isSeedForCurrentSelection,
  };
}
