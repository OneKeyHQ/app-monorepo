import {
  ACTIVITY_HUB_SHORTCUT_ROW_PADDING,
  getActivityHubLayout,
} from './layout';

function getShortcutTileWidth(isWidePanel: boolean) {
  const { panelWidth, shortcutColumns } = getActivityHubLayout(isWidePanel);
  return (panelWidth - ACTIVITY_HUB_SHORTCUT_ROW_PADDING) / shortcutColumns;
}

describe('getActivityHubLayout', () => {
  it('keeps the shortcut tiles the same size in both layouts', () => {
    expect(getShortcutTileWidth(false)).toBe(getShortcutTileWidth(true));
  });

  it('spans the whole row with the shortcuts in the narrow panel', () => {
    const { shortcutBasis, shortcutColumns } = getActivityHubLayout(false);

    expect(shortcutColumns * Number.parseFloat(shortcutBasis)).toBe(100);
  });
});
