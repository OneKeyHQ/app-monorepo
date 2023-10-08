import { makeMutable, runOnJS, withTiming } from 'react-native-reanimated';

import { getCurrentTabId } from '../../../store/observable/webTabs';

import { getWebTabs } from './Controller/useWebTabs';
import {
  dismissWebviewKeyboard,
  pauseDappInteraction,
  resumeDappInteraction,
} from './explorerUtils';

import type { View } from 'react-native';
// for mobile tab animations
export const MIN_OR_HIDE = 0;
export const MAX_OR_SHOW = 1;
export const expandAnim = makeMutable(MIN_OR_HIDE);
export const showTabGridAnim = makeMutable(MIN_OR_HIDE);
export const tabGridRefs: Record<string, View> = {};

// can not use a whole object as animated value (it will be frozen)
// so store them separately
// https://github.com/software-mansion/react-native-reanimated/issues/3670#issuecomment-1303388096
export const targetPreviewX = makeMutable(0);
export const targetPreviewY = makeMutable(0);
export const targetPreviewWidth = makeMutable(0);
export const targetPreviewHeight = makeMutable(0);

// to scroll web tab grid to current tab position
export const tabGridScrollY = makeMutable(0);

export const WEB_TAB_CELL_GAP = 16;

let thumbnailRatio = 0.8;
export const setThumbnailRatio = (ratio: number) => {
  thumbnailRatio = ratio;
};
export const getThumbnailRatio = () => thumbnailRatio;
export const thumbnailWidth = 340;

const getTabCellLayout = (tabId: string, callback: () => void) => {
  const tabCell = tabGridRefs[tabId];
  if (tabCell) {
    tabCell.measure((x, y, width, height, pageX, pageY) => {
      // hotfix:
      // The measure values may be empty on Android platform.
      // This will cause the bounce animation to be ineffective.
      // so, we need to provide a fallback value.
      //
      // However, the specific reason why is not quite clear yet.
      // It could be a bug in the yoga layout engine, or it could be some other reason.
      // Fortunately, it is working now.
      targetPreviewX.value = pageX || targetPreviewX.value;
      targetPreviewY.value = pageY || targetPreviewY.value;
      targetPreviewWidth.value = width || targetPreviewWidth.value;
      targetPreviewHeight.value = height || targetPreviewHeight.value;
      callback();
    });
  } else {
    callback();
  }
};

export const showTabGrid = () => {
  pauseDappInteraction();
  const { currentTabId, tabs } = getWebTabs();
  getTabCellLayout(currentTabId, () => {
    showTabGridAnim.value = withTiming(MAX_OR_SHOW);
    setTimeout(() => {
      const tabRowIndex = Math.floor(
        (tabs.findIndex((t) => t.id === currentTabId) - 1) / 2,
      );
      // reset scroll position to trigger useDerivedValue
      // tabGridScrollY.value = 0;
      tabGridScrollY.value =
        tabRowIndex * targetPreviewHeight.value + WEB_TAB_CELL_GAP;
    }, 330);
  });
};

export const hideTabGrid = (id?: string) => {
  const curId = id || getCurrentTabId();
  getTabCellLayout(curId, () => {
    showTabGridAnim.value = withTiming(MIN_OR_HIDE);
    resumeDappInteraction();
  });
};

interface ExpandAnimationEvents {
  before?: () => void;
  after?: () => void;
}
export const expandFloatingWindow = ({
  before,
  after = () => {},
}: ExpandAnimationEvents) => {
  resumeDappInteraction();
  before?.();
  expandAnim.value = withTiming(MAX_OR_SHOW, { duration: 300 }, () =>
    runOnJS(after)(),
  );
};
export const minimizeFloatingWindow = ({
  before,
  after = () => {},
}: ExpandAnimationEvents) => {
  pauseDappInteraction();
  dismissWebviewKeyboard();
  before?.();
  setTimeout(() => {
    expandAnim.value = withTiming(MIN_OR_HIDE, { duration: 300 }, () =>
      runOnJS(after)(),
    );
  });
};

const noop = () => {};

export interface ToggleFloatingWindowEvents {
  beforeMinimize?: () => void;
  beforeMaximize?: () => void;
  afterMaximize?: () => void;
  afterMinimize?: () => void;
}
export const toggleFloatingWindow = ({
  beforeMinimize,
  beforeMaximize,
  afterMaximize = noop,
  afterMinimize = noop,
}: ToggleFloatingWindowEvents) => {
  if (expandAnim.value === MIN_OR_HIDE) {
    expandFloatingWindow({ before: beforeMaximize, after: afterMaximize });
  } else {
    minimizeFloatingWindow({ before: beforeMinimize, after: afterMinimize });
  }
};
