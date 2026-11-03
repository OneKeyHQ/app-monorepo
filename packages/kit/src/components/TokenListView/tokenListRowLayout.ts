import { getTokenRowIconSize } from './tokenListRowLayoutShared';

import type { ITokenListHeaderLayout } from './tokenListRowLayoutShared';

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
