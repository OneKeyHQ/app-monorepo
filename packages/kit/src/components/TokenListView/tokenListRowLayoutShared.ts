// Platform-neutral part of the token table geometry. The NativeList rows and
// the header above them read the icon size from here; the per-engine header
// numbers live in `tokenListRowLayout.ts` (web) / `tokenListRowLayout.native.ts`.

// Horizontal content padding of the token NativeList. Rows add their own
// `horizontalPadding` inside it, and NativeList lays the RN header / empty /
// footer slots out at this inset too, so page-level slot content (which pads
// itself to the page edge) has to pull this back out; see TokenListView.
export const TOKEN_LIST_CONTENT_PADDING_HORIZONTAL = 8;

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
