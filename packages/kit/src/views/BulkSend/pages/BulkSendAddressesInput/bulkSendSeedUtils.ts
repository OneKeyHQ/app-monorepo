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
