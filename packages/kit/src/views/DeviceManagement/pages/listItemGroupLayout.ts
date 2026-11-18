// Rows in the device pages sit inside a bordered card: this is how far their
// content starts from the card's edge. Kept free of imports so leaf rows can
// use it without the list item itself.
export const LIST_ITEM_GROUP_INSET = 16;

// The row shape every item in a group shares. Rows built inside their own
// components (selects, stateful switches) spread it themselves.
export const LIST_ITEM_GROUP_ITEM_PROPS = {
  mx: '$0',
  px: LIST_ITEM_GROUP_INSET,
  minHeight: 52,
  // The card clips the rows; hover fills run to its edges.
  borderRadius: '$0',
} as const;
