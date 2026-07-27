/* cspell:ignore Infini */
export function resolvePrimeInfiniPaymentDisplaySnapshot<
  TSelectionSnapshot,
  TPayment,
>({
  selectionSnapshot,
  payment,
  isPaymentCurrent,
}: {
  selectionSnapshot: TSelectionSnapshot;
  payment: TPayment | undefined;
  isPaymentCurrent: boolean;
}) {
  return {
    selectionSnapshot,
    payment: isPaymentCurrent ? payment : undefined,
  };
}

export function shouldShowPrimeInfiniPaymentButtonSkeleton({
  hasCurrentPayment,
  isOptionsRefreshing,
  isBalanceLoading,
  accountSyncReady,
  accountSyncFailed,
}: {
  hasCurrentPayment: boolean;
  isOptionsRefreshing: boolean;
  isBalanceLoading: boolean;
  accountSyncReady: boolean;
  accountSyncFailed: boolean;
}) {
  return (
    !hasCurrentPayment ||
    isOptionsRefreshing ||
    isBalanceLoading ||
    (!accountSyncReady && !accountSyncFailed)
  );
}

export function shouldShowPrimeInfiniExternalCheckoutLink({
  canUseExternalCheckout,
  isPaymentButtonPreparing,
}: {
  canUseExternalCheckout: boolean;
  isPaymentButtonPreparing: boolean;
}) {
  return canUseExternalCheckout && !isPaymentButtonPreparing;
}
