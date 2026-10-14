import type { IStakeEarnDetail } from '@onekeyhq/shared/types/staking';

export type IHoldingInvestmentCell = NonNullable<
  NonNullable<IStakeEarnDetail['mobilePortfolio']>['summary']
>['items'][number];

/**
 * The My investment cells the detail page keeps beside Balance and 24h
 * earnings when its Portfolio tab draws the holding's card (product 10-14):
 * the cells the server made for the phone, which carry a tooltip (Spark's
 * effective deposits and effective APY), minus the effective deposits, which
 * the deposit row now shows under itself. Its cell and the row are worded
 * from the same label, so the title tells them apart. The APY cell repeats
 * the headline and the 24h earnings are computed from the holding, so the
 * wide layout's cells, which come without a tooltip, are left out.
 */
export function pickHoldingInvestmentCells(
  cells: IHoldingInvestmentCell[] | undefined,
  effectiveDepositLabel: string | undefined,
): IHoldingInvestmentCell[] {
  return (cells ?? []).filter(
    (cell) =>
      Boolean(cell.tooltip) &&
      (!effectiveDepositLabel || cell.title?.text !== effectiveDepositLabel),
  );
}
