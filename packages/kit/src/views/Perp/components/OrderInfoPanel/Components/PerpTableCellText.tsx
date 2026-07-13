import { SizableText, TABULAR_NUMS } from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';

/**
 * A NUMERIC data cell in the perps tables (positions / open orders / trades /
 * TWAP / account history / balances).
 *
 * Text is proportional by default app-wide. These cells are the opposite case:
 * small numbers stacked in a column that tick, so they need tabular (equal-width)
 * figures — otherwise a digit change reflows the cell and the column jitters.
 *
 * Use this for VALUES only. Column headers, coin symbols and other labels are
 * words, and stay proportional (plain `SizableText`).
 */
export function PerpTableCellText(props: ISizableTextProps) {
  return <SizableText fontVariant={TABULAR_NUMS} {...props} />;
}
