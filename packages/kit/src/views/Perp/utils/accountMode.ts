import { EHyperLiquidAbstractionMode } from '@onekeyhq/shared/types/hyperliquid';

export function isHyperLiquidUnifiedAccountMode(
  modeData:
    | {
        accountAddress?: string | null;
        mode?: EHyperLiquidAbstractionMode;
      }
    | undefined,
  accountAddress?: string | null,
): boolean {
  if (
    modeData?.accountAddress &&
    accountAddress &&
    modeData.accountAddress.toLowerCase() !== accountAddress.toLowerCase()
  ) {
    return false;
  }

  return (
    modeData?.mode === EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT ||
    modeData?.mode === EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN
  );
}
