import {
  DRAWING_CHEVRON_PATH,
  DRAWING_ICON_PATHS,
} from '../../drawings/iconPaths';

// Web renders the same stroke paths as native; only the chevron has its own grid.
export const TRADING_VIEW_DRAWING_ICONS = {
  ...DRAWING_ICON_PATHS,
  chevron: DRAWING_CHEVRON_PATH,
} as const;
