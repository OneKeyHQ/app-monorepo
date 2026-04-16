import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Electron drag-region helpers. On desktop, the header container is a window
// drag handle; interactive children opt out so they remain clickable.
const DRAG_STYLE = (platformEnv.isDesktop
  ? { WebkitAppRegion: 'drag' }
  : undefined) as any;

const NO_DRAG_STYLE = (platformEnv.isDesktop
  ? { WebkitAppRegion: 'no-drag' }
  : undefined) as any;
