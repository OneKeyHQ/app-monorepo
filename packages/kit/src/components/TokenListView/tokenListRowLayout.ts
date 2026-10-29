// Geometry shared by the NativeList token table rows and the header rendered
// above them. The header mirrors the row templates instead of using a generic
// equal-width grid, so these values must stay in sync with the row config in
// NativeTokenSelectorList. `tokenListRowLayout.native.ts` holds the native
// engine's numbers.

export const TOKEN_ROW_ICON_SIZE_WIDE = 32;
export const TOKEN_ROW_ICON_SIZE_COMPACT = 40;

export function getTokenRowIconSize(gtMd: boolean): number {
  return gtMd ? TOKEN_ROW_ICON_SIZE_WIDE : TOKEN_ROW_ICON_SIZE_COMPACT;
}

export type ITokenListHeaderLayout = {
  // Width of the slot the header keeps empty above the row's token icon.
  leadingWidth: number;
  // Gap between the leading slot and each column, same as the row's cells.
  cellGap: number;
  // Extra props for the header `ListItem` so its horizontal box matches the
  // rows; undefined keeps the `ListItem` defaults.
  containerProps?: { mx: number; px: number };
};

// Web rows: `horizontalPadding: 12`, 12px flex gap, 32px (gtMd) / 40px icon.
// Rows carry no outer margin inside the list, so the header drops the
// `ListItem` default margin and pads itself like a row instead.
const WEB_ROW_HORIZONTAL_PADDING = 12;
const WEB_CELL_GAP = 12;

export function getTokenListHeaderLayout(
  gtMd: boolean,
): ITokenListHeaderLayout {
  return {
    leadingWidth: getTokenRowIconSize(gtMd),
    cellGap: WEB_CELL_GAP,
    containerProps: { mx: 0, px: WEB_ROW_HORIZONTAL_PADDING },
  };
}
