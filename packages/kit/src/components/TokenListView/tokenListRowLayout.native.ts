import type {
  ITokenListHeaderLayout,
  ITokenRowContainerStyle,
} from './tokenListRowLayoutShared';

// Native engines already round the pressed fill on their own. An explicit
// container radius would also mask the resting row, so none is set here.
export const TOKEN_ROW_CONTAINER_STYLE: ITokenRowContainerStyle = undefined;

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
