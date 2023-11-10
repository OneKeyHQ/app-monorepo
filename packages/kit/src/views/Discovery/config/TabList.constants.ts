import { Dimensions } from 'react-native';

export const TAB_LIST_CELL_COUNT_PER_ROW = 2;
export const TAB_LIST_HORIZONTAL_MARGIN = 16;
export const TAB_LIST_HORIZONTAL_SPACING = 16;

export const TAB_LIST_CELL_WIDTH =
  (Dimensions.get('window').width -
    TAB_LIST_HORIZONTAL_MARGIN * 2 -
    (TAB_LIST_CELL_COUNT_PER_ROW - 1) * TAB_LIST_HORIZONTAL_SPACING) /
  TAB_LIST_CELL_COUNT_PER_ROW;
export const TAB_LIST_CELL_HEIGHT = Math.floor((TAB_LIST_CELL_WIDTH * 10) / 9);

export const THUMB_HEIGHT = Math.floor(TAB_LIST_CELL_HEIGHT - 32 - 40);
export const THUMB_WIDTH = Math.floor(TAB_LIST_CELL_WIDTH - 16 * 2);
