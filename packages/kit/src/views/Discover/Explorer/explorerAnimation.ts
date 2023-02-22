import { createRef } from 'react';

import { makeMutable, runOnJS, withTiming } from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';

import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { appSelector } from '../../../store';

import { pauseDappInteraction, resumeDappInteraction } from './explorerUtils';

import type { View } from 'react-native';
import type ViewShot from 'react-native-view-shot';
// for mobile tab animations
export const MIN_OR_HIDE = 0;
export const MAX_OR_SHOW = 1;
export const expandAnim = makeMutable(MIN_OR_HIDE);
export const showTabGridAnim = makeMutable(MIN_OR_HIDE);
export const tabViewShotRef = createRef<ViewShot>();
export const tabGridRefs: Record<string, View> = {};

// can not use a whole object as animated value (it will be frozen)
// so store them separately
// https://github.com/software-mansion/react-native-reanimated/issues/3670#issuecomment-1303388096
export const targetPreviewX = makeMutable(0);
export const targetPreviewY = makeMutable(0);
export const targetPreviewWidth = makeMutable(0);
export const targetPreviewHeight = makeMutable(0);

let thumbnailRatio = 0.8;
export const setThumbnailRatio = (ratio: number) => {
  thumbnailRatio = ratio;
};
const thumbnailWidth = 340;
const getTabCellLayout = (tabId: string, callback: () => void) => {
  tabGridRefs[tabId]?.measure((x, y, width, height, pageX, pageY) => {
    targetPreviewX.value = pageX;
    targetPreviewY.value = pageY;
    targetPreviewWidth.value = width;
    targetPreviewHeight.value = height;
    callback();
  });
};
export const showTabGrid = () => {
  pauseDappInteraction();
  const { currentTabId } = appSelector((s) => s.webTabs);
  if (platformEnv.isNative && tabViewShotRef.current) {
    captureRef(tabViewShotRef, {
      format: 'jpg',
      width: thumbnailWidth,
      height: thumbnailWidth * thumbnailRatio,
      quality: 0.6,
    }).then((uri) => {
      appEventBus.emit(
        AppEventBusNames.WebTabThumbnailUpdated,
        currentTabId,
        uri,
      );
    });
  }
  getTabCellLayout(currentTabId, () => {
    showTabGridAnim.value = withTiming(MAX_OR_SHOW);
  });
};

export const hideTabGrid = (id?: string) => {
  const curId = id || appSelector((s) => s.webTabs.currentTabId);
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
