import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

// Pro keeps the pay-token balance on the token object and stamps it with the
// account it was fetched for. Only a balance carrying the current account
// counts as loaded; a fresh token pick or an account switch leaves it unknown
// until the next sync lands, so a stale figure never triggers the deposit
// entry (OK-63470). An in-flight refresh keeps the stamped value, so the
// verdict holds steady while it reloads.
export function getSwapProLoadedInputBalance({
  inputToken,
  accountAddress,
}: {
  inputToken?: Pick<ISwapToken, 'balanceParsed' | 'accountAddress'>;
  accountAddress?: string;
}): string | undefined {
  if (!inputToken || !accountAddress) return undefined;
  if (inputToken.accountAddress !== accountAddress) return undefined;
  return inputToken.balanceParsed;
}
