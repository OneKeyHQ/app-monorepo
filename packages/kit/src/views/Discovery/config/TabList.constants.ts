import { Dimensions } from 'react-native';

export const TAB_LIST_CELL_COUNT_PER_ROW = 2;
export const TAB_LIST_HORIZONTAL_MARGIN = 14;
export const TAB_LIST_ITEM_SPACING = 8;
export const TAB_LIST_HEADER_HEIGHT = 36;

export const TAB_LIST_CELL_WIDTH =
  (Dimensions.get('window').width -
    TAB_LIST_HORIZONTAL_MARGIN * 2 -
    (TAB_LIST_CELL_COUNT_PER_ROW - 1) * TAB_LIST_ITEM_SPACING) /
  TAB_LIST_CELL_COUNT_PER_ROW;

export const THUMB_WIDTH = TAB_LIST_CELL_WIDTH - 12;
