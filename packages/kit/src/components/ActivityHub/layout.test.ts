import {
  ACTIVITY_HUB_SHORTCUT_ROW_PADDING,
  getActivityHubLayout,
} from './layout';

function getShortcutTileWidth(hasCampaigns: boolean) {
  const { panelWidth, shortcutColumns } = getActivityHubLayout(hasCampaigns);
  return (panelWidth - ACTIVITY_HUB_SHORTCUT_ROW_PADDING) / shortcutColumns;
}

describe('getActivityHubLayout', () => {
  it('narrows the panel when only the two shortcuts are shown', () => {
    expect(getActivityHubLayout(true).panelWidth).toBeGreaterThan(
      getActivityHubLayout(false).panelWidth,
    );
  });

  it('keeps the shortcut tiles the same size in both layouts', () => {
    expect(getShortcutTileWidth(false)).toBe(getShortcutTileWidth(true));
  });

  it('spans the whole row with the shortcuts when campaigns are hidden', () => {
    const { shortcutBasis, shortcutColumns } = getActivityHubLayout(false);

    expect(shortcutColumns * Number.parseFloat(shortcutBasis)).toBe(100);
  });
});
