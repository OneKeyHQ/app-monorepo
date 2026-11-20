import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Rows in the device pages sit inside a bordered card: this is how far their
// content starts from the card's edge. Kept free of component imports so leaf
// rows can use it without the list item itself.
export const LIST_ITEM_GROUP_INSET = 16;

// Phones read a size up, as every other native list in the app does: 16 for
// a row, 18 for its group's title. Desktop keeps the denser 14 and 16.
export const LIST_ITEM_GROUP_TITLE_SIZE = platformEnv.isNative
  ? '$headingLg'
  : '$headingMd';
export const LIST_ITEM_TITLE_SIZE = platformEnv.isNative
  ? '$bodyLgMedium'
  : '$bodyMdMedium';
export const LIST_ITEM_VALUE_SIZE = platformEnv.isNative
  ? '$bodyLg'
  : '$bodyMd';

// The row shape every item in a group shares. Rows built inside their own
// components (selects, stateful switches) spread it themselves.
export const LIST_ITEM_GROUP_ITEM_PROPS = {
  mx: '$0',
  px: LIST_ITEM_GROUP_INSET,
  minHeight: 52,
  // The card clips the rows; hover fills run to its edges.
  borderRadius: '$0',
} as const;
