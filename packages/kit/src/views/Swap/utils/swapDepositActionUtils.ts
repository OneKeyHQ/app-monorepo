import BigNumber from 'bignumber.js';

// '' or undefined means the balance has not loaded and a non-numeric string is
// not a number; only a finite zero counts. Shared by the Swap From row, the
// Stocks Pay row and the action-button verdict so "zero" means one thing.
export function isSwapBalanceLoadedZero(balance?: string): boolean {
  if (!balance) return false;
  const balanceBN = new BigNumber(balance);
  return balanceBN.isFinite() && balanceBN.isZero();
}

export interface IShouldOfferSwapDepositActionParams {
  // From-token balance display string; '' (or undefined) until it has loaded.
  // A same-token refresh keeps the last value, so an in-flight fetch never
  // flips the verdict. Swap callers pass it through resolveVerifiedSwapBalance
  // first so a fallback figure, or one belonging to another token or account,
  // reads as not loaded.
  balance: string | undefined;
  hasFromToken: boolean;
  hasToToken: boolean;
  hasFromAddress: boolean;
  noProviderSupportsTrade: boolean;
  noConnectWallet?: boolean;
  isStockBalanceUnavailable?: boolean;
}

// The action button turns into "Deposit to Trade" as soon as the pay token
// balance is a loaded zero, before any amount is typed: nothing else on the
// page can help there, and the deposit entry needs no quote (OK-63470). A
// partial balance keeps the disabled "insufficient balance" label because
// editing the amount is the cheaper fix; the Top up chip covers deposits.
export function shouldOfferSwapDepositAction({
  balance,
  hasFromToken,
  hasToToken,
  hasFromAddress,
  noProviderSupportsTrade,
  noConnectWallet = false,
  isStockBalanceUnavailable = false,
}: IShouldOfferSwapDepositActionParams): boolean {
  if (!hasFromToken || !hasToToken || !hasFromAddress) return false;
  if (noConnectWallet || noProviderSupportsTrade || isStockBalanceUnavailable) {
    return false;
  }
  return isSwapBalanceLoadedZero(balance);
}
