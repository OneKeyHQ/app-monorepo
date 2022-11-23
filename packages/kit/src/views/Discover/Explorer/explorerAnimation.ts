import { createRef } from 'react';

import { makeMutable, runOnJS, withTiming } from 'react-native-reanimated';
import ViewShot, { captureRef } from 'react-native-view-shot';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { appSelector } from '../../../store';
import { setWebTabData } from '../../../store/reducers/webTabs';

import type { View } from 'react-native';
// for mobile tab animations
export const MIN_OR_HIDE = 0;
export const MAX_OR_SHOW = 1;
export const expandAnim = makeMutable(MIN_OR_HIDE);
export const showTabGridAnim = makeMutable(MIN_OR_HIDE);
export const tabViewShotRef = createRef<ViewShot>();
export const tabGridRefs: Record<string, View> = {};

export const targetGridLayout = makeMutable({
  pageX: 0,
  pageY: 0,
  width: 0,
  height: 0,
});

let thumbnailRatio = 0.8;
export const setThumbnailRatio = (ratio: number) => {
  thumbnailRatio = ratio;
};
const thumbnailWidth = 340;
export const showTabGrid = () => {
  const { currentTabId } = appSelector((s) => s.webTabs);
  if (platformEnv.isNative) {
    captureRef(tabViewShotRef, {
      format: 'jpg',
      width: thumbnailWidth,
      height: thumbnailWidth * thumbnailRatio,
      quality: 0.6,
    }).then((uri) => {
      backgroundApiProxy.dispatch(
        setWebTabData({
          id: currentTabId,
          thumbnail: uri,
        }),
      );
    });
  }
  tabGridRefs[currentTabId]?.measure((x, y, width, height, pageX, pageY) => {
    targetGridLayout.value = { pageX, pageY, width, height };
  });
  setTimeout(() => (showTabGridAnim.value = withTiming(MAX_OR_SHOW)), 30);
};

export const hideTabGrid = () => {
  showTabGridAnim.value = withTiming(MIN_OR_HIDE);
};

export const expandFloatingWindow = (afterMaximize: () => void = () => {}) => {
  expandAnim.value = withTiming(MAX_OR_SHOW, { duration: 300 }, () =>
    runOnJS(afterMaximize),
  );
};
export const minimizeFloatingWindow = (beforeMinimize?: () => void) => {
  beforeMinimize?.();
  expandAnim.value = withTiming(MIN_OR_HIDE, { duration: 300 });
};
export const toggleFloatingWindow = ({
  beforeMinimize,
  beforeMaximize,
  afterMaximize,
}: {
  beforeMinimize?: () => void;
  beforeMaximize?: () => void;
  afterMaximize?: () => void;
}) => {
  if (expandAnim.value === MIN_OR_HIDE) {
    beforeMaximize?.();
    expandFloatingWindow(afterMaximize);
  } else {
    minimizeFloatingWindow(beforeMinimize);
  }
};
