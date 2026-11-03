import {
  BALANCE_FLEX_WITHOUT_REWARDS,
  POSITION_COLUMN_WIDTH,
  USD_FLEX_WITHOUT_REWARDS,
} from '@onekeyhq/kit/src/views/Home/components/DeFiListBlock/ProtocolUnifiedTable';

/**
 * Where a position row's buttons go in My portfolio's wide tables, the
 * detail pages' holding tables and the Rewards tables. Two placements for
 * the product owner to compare (demo 11-03), picked by localStorage
 * `demoPositionActions` and read once per load:
 *   - 'name' (C, the default): at the end of the first column, beside the
 *     name, the column widening where the table has buttons; the figures end
 *     under the total of the line above the table;
 *   - 'edge' (B): at the card's edge, the figures in fixed columns right
 *     after the first one.
 * Neither keeps a column for rows without a button.
 */
export type IPositionActionsPlacement = 'name' | 'edge';

export const POSITION_ACTIONS_PLACEMENT_KEY = 'demoPositionActions';

function readPositionActionsPlacement(): IPositionActionsPlacement {
  try {
    return globalThis.localStorage?.getItem(POSITION_ACTIONS_PLACEMENT_KEY) ===
      'edge'
      ? 'edge'
      : 'name';
  } catch {
    return 'name';
  }
}

export const POSITION_ACTIONS_PLACEMENT = readPositionActionsPlacement();

// The rows' own inset, the wallet table's ($2)
const ROW_INSET = 8;
// 'name': the first column with a button at its end, wide enough for "Sell
// Early" beside a long symbol (PT-stk-ePendle)
const FIRST_COLUMN_WITH_ACTIONS_WIDTH = 340;
// 'edge': the figures' columns right after the first one. A narrow table
// (a detail page beside its form) caps them at a share of its width: the
// strip and the rows cap alike, so their columns stay in line where only
// the rows have a button to make room for
const EDGE_SECOND_COLUMN_WIDTH = 200;
const EDGE_SECOND_COLUMN_MAX_WIDTH = '26%';
const EDGE_VALUE_COLUMN_WIDTH = 120;
const EDGE_VALUE_COLUMN_MAX_WIDTH = '16%';

/**
 * The room the chevron after a total takes on the line above a table (the
 * icon, $5, and its gap, $1): a table under such a line keeps it free, so
 * its values end under that total
 */
export const TOTAL_CHEVRON_SLOT = 24;

type IColumnProps = {
  width?: number;
  maxWidth?: `${number}%`;
  flex?: number;
  flexBasis?: number;
  flexShrink?: number;
  minWidth?: number;
  ai?: 'flex-start' | 'flex-end';
};

export type IPositionTableColumns = {
  placement: IPositionActionsPlacement;
  /** the strip's and the rows' insets */
  inset: { pl: number; pr: number };
  /** the token and its name; under 'name' the row's button at its end */
  first: IColumnProps;
  second: IColumnProps;
  /** the value, right-aligned under 'name' */
  value: IColumnProps;
  /** 'edge': the rest of the row, the row's button at its end */
  trailing?: { flexGrow: number; flexShrink: number; jc: 'flex-end' };
};

export function positionTableColumns({
  placement = POSITION_ACTIONS_PLACEMENT,
  hasActions,
  endInset = ROW_INSET,
  edgeSecondWidth = EDGE_SECOND_COLUMN_WIDTH,
}: {
  placement?: IPositionActionsPlacement;
  /** whether any row of the table has a button or a Pending badge */
  hasActions: boolean;
  /** the room kept at the right ('name'): TOTAL_CHEVRON_SLOT under a total */
  endInset?: number;
  edgeSecondWidth?: number;
}): IPositionTableColumns {
  if (placement === 'edge') {
    return {
      placement,
      inset: { pl: ROW_INSET, pr: ROW_INSET },
      first: { width: POSITION_COLUMN_WIDTH, flexShrink: 0, minWidth: 0 },
      second: {
        width: edgeSecondWidth,
        maxWidth: EDGE_SECOND_COLUMN_MAX_WIDTH,
        flexShrink: 0,
        minWidth: 0,
      },
      value: {
        width: EDGE_VALUE_COLUMN_WIDTH,
        maxWidth: EDGE_VALUE_COLUMN_MAX_WIDTH,
        flexShrink: 0,
        minWidth: 0,
      },
      trailing: { flexGrow: 1, flexShrink: 0, jc: 'flex-end' },
    };
  }
  return {
    placement,
    inset: { pl: ROW_INSET, pr: Math.max(endInset, ROW_INSET) },
    first: {
      width: hasActions
        ? FIRST_COLUMN_WITH_ACTIONS_WIDTH
        : POSITION_COLUMN_WIDTH,
      flexShrink: 0,
      minWidth: 0,
    },
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
