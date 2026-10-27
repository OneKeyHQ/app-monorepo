/* cspell:ignore Infini */
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

export function resolvePrimeInfiniPaymentAsset<
  TAsset extends { key: string; networkId: string },
>({
  assets,
  selectedAssetKey,
  pendingAssetKey,
  preferredNetworkId,
}: {
  assets: TAsset[];
  selectedAssetKey: string;
  pendingAssetKey?: string;
  preferredNetworkId?: string;
}): TAsset | undefined {
  const normalizedPreferredNetworkId = preferredNetworkId?.trim();
  return (
    assets.find((asset) => asset.key === selectedAssetKey) ??
    assets.find((asset) => asset.key === pendingAssetKey) ??
    assets.find((asset) => asset.networkId === normalizedPreferredNetworkId) ??
    assets.find((asset) => asset.networkId === getNetworkIdsMap().eth) ??
    assets[0]
  );
}

export function resolvePrimeInfiniPaymentPinnedAssetKey({
  selectedAssetKey,
  pendingAssetKey,
}: {
  selectedAssetKey: string;
  pendingAssetKey?: string;
}) {
  return selectedAssetKey || pendingAssetKey || '';
}

export function isPrimeInfiniPaymentAccountSyncReady({
  syncedNetworkId,
  selectedNetworkId,
}: {
  syncedNetworkId: string;
  selectedNetworkId: string;
}) {
  return Boolean(
    syncedNetworkId && syncedNetworkId.trim() === selectedNetworkId.trim(),
  );
}

export function resolvePrimeInfiniAccountSelectionPress({
  canChangeAccountSelection,
  hasWallet,
}: {
  canChangeAccountSelection: boolean;
  hasWallet: boolean;
}): 'disabled' | 'onboarding' | 'accountSelector' {
  if (!canChangeAccountSelection) {
    return 'disabled';
  }
  return hasWallet ? 'accountSelector' : 'onboarding';
}

export function resolvePrimeInfiniPaymentDisplaySnapshot<
  TSelectionSnapshot,
  TPayment,
>({
  selectionSnapshot,
  lastReadySelectionSnapshot,
  isSelectionReady = true,
  payment,
  isPaymentCurrent,
}: {
  selectionSnapshot: TSelectionSnapshot;
  lastReadySelectionSnapshot?: TSelectionSnapshot;
  isSelectionReady?: boolean;
  payment: TPayment | undefined;
  isPaymentCurrent: boolean;
}) {
  return {
    selectionSnapshot:
      isSelectionReady || !lastReadySelectionSnapshot
        ? selectionSnapshot
        : lastReadySelectionSnapshot,
    payment: isPaymentCurrent ? payment : undefined,
  };
}

export function shouldShowPrimeInfiniPaymentButtonSkeleton({
  hasPaymentAccount,
  hasCurrentPayment,
  isOptionsRefreshing,
  isBalanceLoading,
  accountSyncReady,
  accountSyncFailed,
}: {
  hasPaymentAccount: boolean;
  hasCurrentPayment: boolean;
  isOptionsRefreshing: boolean;
  isBalanceLoading: boolean;
  accountSyncReady: boolean;
  accountSyncFailed: boolean;
}) {
  return (
    isOptionsRefreshing ||
    (!accountSyncReady && !accountSyncFailed) ||
    (hasPaymentAccount &&
      !accountSyncFailed &&
      (!hasCurrentPayment || isBalanceLoading))
  );
}

export function shouldShowPrimeInfiniExternalCheckoutLink({
  canUseExternalCheckout,
  isOptionsRefreshing,
}: {
  canUseExternalCheckout: boolean;
  isOptionsRefreshing: boolean;
}) {
  return canUseExternalCheckout && !isOptionsRefreshing;
}
