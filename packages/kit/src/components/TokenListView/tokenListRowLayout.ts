import {
  TOKEN_ROW_HORIZONTAL_PADDING,
  getTokenRowIconSize,
} from './tokenListRowLayoutShared';

import type {
  ITokenListFooterLayout,
  ITokenListHeaderLayout,
  ITokenRowContainerStyle,
} from './tokenListRowLayoutShared';

// The web engine paints the hover/pressed fill on the row box and rounds it
// only by the row's own container radius, so the rows carry the legacy
// `ListItem` radius themselves (OK-66430).
export const TOKEN_ROW_CONTAINER_STYLE: ITokenRowContainerStyle = {
  cornerRadius: 12,
};

// Web rows (see NativeTokenSelectorList): `horizontalPadding: 12`, 12px flex
// gap, 32px (gtMd) / 40px icon. Rows carry no outer margin inside the list,
// so the header drops the `ListItem` default margin and pads itself like a
// row instead. Keep in sync with the row config.
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

// The web NativeList already insets its footer slot by the content padding,
// the same inset the rows get, so footer rows drop every outer margin and pad
// themselves like a row.
export function getTokenListFooterLayout(_options: {
  tableLayout?: boolean;
  plainMode?: boolean;
}): ITokenListFooterLayout {
  return { mx: 0, itemProps: { mx: 0, px: TOKEN_ROW_HORIZONTAL_PADDING } };
}
