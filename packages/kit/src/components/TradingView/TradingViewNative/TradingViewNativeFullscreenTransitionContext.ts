import { createContext } from 'react';

import type { SharedValue } from 'react-native-reanimated';

// Android sequences fullscreen entry: the layer mounts hidden at its landscape
// size, the window rotates once the chart has drawn, and only then is the layer
// shown. A leaf module so the chart wrapper and presentation share it without
// importing each other.
export interface ITradingViewNativeFullscreenTransition {
  // Whether the shown layer takes touches and accessibility focus.
  isRevealed: boolean;
  // Shows and hides the layer on the UI thread; a missing value shows it.
  layerOpacity?: SharedValue<number>;
  // Set while the window is rotating to landscape for this layer: the host
  // shows the layer on the UI thread as soon as the window is landscape, even
  // before JS learns the rotation was applied.
  revealOnLandscape?: SharedValue<boolean>;
  // The session rotates to landscape: the layer takes the landscape size from
  // the start, before and while the window rotates.
  isLandscapeLayout: boolean;
  // The session hides the status bar, so the layer never reserves its inset.
  isStatusBarHidden: boolean;
  // The fullscreen chart has drawn at its prepared size.
  onLayerReady: () => void;
}

export const TradingViewNativeFullscreenTransitionContext = createContext<
  ITradingViewNativeFullscreenTransition | undefined
>(undefined);
