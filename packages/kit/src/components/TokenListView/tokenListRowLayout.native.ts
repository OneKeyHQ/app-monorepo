import type { ITokenListHeaderLayout } from './tokenListRowLayout';

export const TOKEN_ROW_ICON_SIZE_WIDE = 32;
export const TOKEN_ROW_ICON_SIZE_COMPACT = 40;

export function getTokenRowIconSize(gtMd: boolean): number {
  return gtMd ? TOKEN_ROW_ICON_SIZE_WIDE : TOKEN_ROW_ICON_SIZE_COMPACT;
}

// Native rows: 44px leading slot, 8px gaps, and the header `ListItem` keeps
// its default horizontal box.
const NATIVE_LEADING_WIDTH = 44;
const NATIVE_CELL_GAP = 8;

export function getTokenListHeaderLayout(
  _gtMd: boolean,
): ITokenListHeaderLayout {
  return {
    leadingWidth: NATIVE_LEADING_WIDTH,
    cellGap: NATIVE_CELL_GAP,
  };
}
