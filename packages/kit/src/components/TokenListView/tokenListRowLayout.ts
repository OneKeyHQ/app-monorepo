// Geometry shared by the NativeList token table rows and the header rendered
// above them. The header mirrors the row templates instead of using a generic
// equal-width grid, so these values must stay in sync with the row config in
// NativeTokenSelectorList.

export const TOKEN_ROW_ICON_SIZE_WIDE = 32;
export const TOKEN_ROW_ICON_SIZE_COMPACT = 40;

export function getTokenRowIconSize(gtMd: boolean): number {
  return gtMd ? TOKEN_ROW_ICON_SIZE_WIDE : TOKEN_ROW_ICON_SIZE_COMPACT;
}
