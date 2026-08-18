// Shortcut tiles sit in a 4-column grid because the campaign cards underneath
// are what set the panel width. A panel without campaign cards shrinks to the
// two tiles, so the basis has to grow by the same factor to keep the tile size —
// hence the paired values.
export const ACTIVITY_HUB_SHORTCUT_ROW_PADDING = 32;

export type IActivityHubShortcutBasis = `${number}%`;

const ACTIVITY_HUB_LAYOUTS = {
  wide: {
    panelWidth: 384,
    shortcutBasis: '25%',
    shortcutColumns: 4,
  },
  narrow: {
    panelWidth: 208,
    shortcutBasis: '50%',
    shortcutColumns: 2,
  },
} as const;

// A panel is wide when it has the full 4-column room: campaign cards force that
// on desktop, and on md the hub is a screen-wide sheet that always has it.
export function getActivityHubLayout(isWidePanel: boolean) {
  return isWidePanel ? ACTIVITY_HUB_LAYOUTS.wide : ACTIVITY_HUB_LAYOUTS.narrow;
}
