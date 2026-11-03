import {
  BALANCE_FLEX_WITHOUT_REWARDS,
  POSITION_COLUMN_WIDTH,
  USD_FLEX_WITHOUT_REWARDS,
} from '@onekeyhq/kit/src/views/Home/components/DeFiListBlock/ProtocolUnifiedTable';

/**
 * The columns of My portfolio's wide tables, the detail pages' holding
 * tables and the Rewards tables (demo 11-03, the product owner's pick): a
 * row's button sits at the end of the first column, beside the name, the
 * column widening where the table has buttons; no column is kept for rows
 * without one, and the values end under the total of the line above
 */

// The rows' own inset, the wallet table's ($2)
const ROW_INSET = 8;
// The first column with a button at its end, wide enough for "Sell Early"
// beside a long symbol (PT-stk-ePendle)
const FIRST_COLUMN_WITH_ACTIONS_WIDTH = 340;
// Kept after a row's button, on top of the column gap, so a filled button
// doesn't sit against the amount beside it
const ACTION_END_GAP = 12;

/**
 * The room the chevron after a total takes on the line above a table (the
 * icon, $5, and its gap, $1): a table under such a line keeps it free, so
 * its values end under that total
 */
export const TOTAL_CHEVRON_SLOT = 24;

type IColumnProps = {
  width?: number;
  flex?: number;
  flexBasis?: number;
  flexShrink?: number;
  minWidth?: number;
  pr?: number;
  ai?: 'flex-start' | 'flex-end';
};

export type IPositionTableColumns = {
  /** the strip's and the rows' insets */
  inset: { pl: number; pr: number };
  /** the token and its name, the row's button at its end */
  first: IColumnProps;
  second: IColumnProps;
  /** the value, right-aligned */
  value: IColumnProps;
};

export function positionTableColumns({
  hasActions,
  endInset = ROW_INSET,
}: {
  /** whether any row of the table has a button or a Pending badge */
  hasActions: boolean;
  /** the room kept at the right: TOTAL_CHEVRON_SLOT under a total */
  endInset?: number;
}): IPositionTableColumns {
  return {
    inset: { pl: ROW_INSET, pr: Math.max(endInset, ROW_INSET) },
    first: hasActions
      ? {
          width: FIRST_COLUMN_WITH_ACTIONS_WIDTH + ACTION_END_GAP,
          pr: ACTION_END_GAP,
          flexShrink: 0,
          minWidth: 0,
        }
      : { width: POSITION_COLUMN_WIDTH, flexShrink: 0, minWidth: 0 },
    second: {
      flex: BALANCE_FLEX_WITHOUT_REWARDS,
      flexBasis: 0,
      minWidth: 0,
    },
    value: {
      flex: USD_FLEX_WITHOUT_REWARDS,
      flexBasis: 0,
      minWidth: 0,
      ai: 'flex-end',
    },
  };
}
