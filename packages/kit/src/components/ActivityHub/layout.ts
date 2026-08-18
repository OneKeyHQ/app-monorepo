// Shortcut tiles sit in a 4-column grid because the campaign cards underneath
// are what set the panel width. With no campaigns the panel shrinks to the two
// tiles, so the basis has to grow by the same factor to keep the tile size —
// hence the paired values.
export const ACTIVITY_HUB_SHORTCUT_ROW_PADDING = 32;

export type IActivityHubShortcutBasis = `${number}%`;

const ACTIVITY_HUB_LAYOUTS = {
  withCampaigns: {
    panelWidth: 384,
    shortcutBasis: '25%',
    shortcutColumns: 4,
  },
  shortcutsOnly: {
    panelWidth: 208,
    shortcutBasis: '50%',
    shortcutColumns: 2,
  },
} as const;

export function getActivityHubLayout(hasCampaigns: boolean) {
  return hasCampaigns
    ? ACTIVITY_HUB_LAYOUTS.withCampaigns
    : ACTIVITY_HUB_LAYOUTS.shortcutsOnly;
}
