// Platform-neutral part of the token table geometry. The NativeList rows and
// the header above them read the icon size from here; the per-engine header
// numbers live in `tokenListRowLayout.ts` (web) / `tokenListRowLayout.native.ts`.

// Horizontal content padding of the token NativeList. Rows add their own
// `horizontalPadding` inside it, and NativeList lays the RN header / empty /
// footer slots out at this inset too, so page-level slot content (which pads
// itself to the page edge) has to pull this back out; see TokenListView.
export const TOKEN_LIST_CONTENT_PADDING_HORIZONTAL = 8;

// Horizontal margin for page-level native slot content so it lines up with
// the rows, or undefined when the slot content already does. Web slot content
// is sized for the inset. iOS keeps the React-applied inset in both the plain
// and the sidecar (Recent History band) layouts. Android does too without a
// sidecar, but its sidecar layout places the slot holders at the band's
// centering offset without the content padding and lays the React root out
// at 0 inside them, so the inset is already gone there and compensating
// would pull the slots the same 8 units past the rows instead.
export function getTokenListSlotInsetCompensation({
  isNative,
  isNativeAndroid,
  hasSidecarLayout,
}: {
  isNative: boolean;
  isNativeAndroid: boolean;
  hasSidecarLayout: boolean;
}): number | undefined {
  if (!isNative) return undefined;
  if (isNativeAndroid && hasSidecarLayout) return undefined;
  return -TOKEN_LIST_CONTENT_PADDING_HORIZONTAL;
}

export const TOKEN_ROW_ICON_SIZE_WIDE = 32;
export const TOKEN_ROW_ICON_SIZE_COMPACT = 40;

export function getTokenRowIconSize(gtMd: boolean): number {
  return gtMd ? TOKEN_ROW_ICON_SIZE_WIDE : TOKEN_ROW_ICON_SIZE_COMPACT;
}

type ITokenTableColumnWeight = 1 | 2 | 3;

export type ITokenTableColumnWeights = {
  asset: ITokenTableColumnWeight;
  balance: ITokenTableColumnWeight;
  price: ITokenTableColumnWeight;
  // Empty column in front of the trailing swap button.
  swapSpacer?: ITokenTableColumnWeight;
};

// The table used to be four equal columns with the swap button right-aligned in
// the last one, and the token icon inside the first. Rows now keep the icon and
// the button outside the weighted columns, so 2:3:3:2 approximates that grid
// and keeps the price column clear of the button. NativeList only accepts
// weights of 1 to 3. The header must use the same weights to stay aligned.
export function getTokenTableColumnWeights(
  withSwapAction: boolean | undefined,
): ITokenTableColumnWeights {
  if (!withSwapAction) return { asset: 1, balance: 1, price: 1 };
  return { asset: 2, balance: 3, price: 3, swapSpacer: 2 };
}

// Row box style handed to NativeList as `style.container`; undefined keeps
// the engine default.
export type ITokenRowContainerStyle = { cornerRadius: number } | undefined;

export type ITokenListHeaderLayout = {
  // Width of the slot the header keeps empty above the row's token icon.
  leadingWidth: number;
  // Gap between the leading slot and each column, same as the row's cells.
  cellGap: number;
  // Extra props for the header `ListItem` so its horizontal box matches the
  // rows; undefined keeps the `ListItem` defaults.
  containerProps?: { mx: number; px: number };
};
