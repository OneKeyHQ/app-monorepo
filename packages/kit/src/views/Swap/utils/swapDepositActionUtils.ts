import BigNumber from 'bignumber.js';

export interface IShouldOfferSwapDepositActionParams {
  // From-token balance display string; '' (or undefined) until it has loaded.
  // A same-token refresh keeps the last value, so an in-flight fetch never
  // flips the verdict.
  balance: string | undefined;
  // The last balance fetch failed; the stored '0.0' is a fallback, not a zero.
  hasBalanceError: boolean;
  hasFromToken: boolean;
  hasToToken: boolean;
  hasFromAddress: boolean;
  noConnectWallet: boolean;
  noProviderSupportsTrade: boolean;
  isStockBalanceUnavailable: boolean;
}

// The action button turns into "Deposit to Trade" as soon as the pay token
// balance is a loaded zero, before any amount is typed: nothing else on the
// page can help there, and the deposit entry needs no quote (OK-63470). A
// partial balance keeps the disabled "insufficient balance" label because
// editing the amount is the cheaper fix; the Top up chip covers deposits.
export function shouldOfferSwapDepositAction({
  balance,
  hasBalanceError,
  hasFromToken,
  hasToToken,
  hasFromAddress,
  noConnectWallet,
  noProviderSupportsTrade,
  isStockBalanceUnavailable,
}: IShouldOfferSwapDepositActionParams): boolean {
  if (!hasFromToken || !hasToToken || !hasFromAddress) return false;
  if (noConnectWallet || noProviderSupportsTrade || isStockBalanceUnavailable) {
    return false;
  }
  if (hasBalanceError || !balance) return false;
  const balanceBN = new BigNumber(balance);
  return balanceBN.isFinite() && balanceBN.isZero();
}
