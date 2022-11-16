import { createRef } from 'react';

import { makeMutable, runOnJS, withTiming } from 'react-native-reanimated';
import ViewShot, { captureRef } from 'react-native-view-shot';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { appSelector } from '../../../store';
import { setWebTabData } from '../../../store/reducers/webTabs';
// for mobile tab animations
export const MIN_OR_HIDE = 0;
export const MAX_OR_SHOW = 1;
export const expandAnim = makeMutable(MIN_OR_HIDE);
export const showTabGridAnim = makeMutable(MIN_OR_HIDE);
export const tabViewShotRef = createRef<ViewShot>();

let thumbnailRatio = 0.8;
export const setThumbnailRatio = (ratio: number) => {
  thumbnailRatio = ratio;
};
const thumbnailWidth = 340;
export const showTabGrid = () => {
  if (platformEnv.isNative) {
    captureRef(tabViewShotRef, {
      format: 'jpg',
      width: thumbnailWidth,
      height: thumbnailWidth * thumbnailRatio,
      quality: 0.6,
    }).then((uri) => {
      const { currentTabId } = appSelector((s) => s.webTabs);
      backgroundApiProxy.dispatch(
        setWebTabData({
          id: currentTabId,
          thumbnail: uri,
        }),
      );
    });
  }
  showTabGridAnim.value = withTiming(MAX_OR_SHOW);
};

export const hideTabGrid = () => {
  showTabGridAnim.value = withTiming(MIN_OR_HIDE);
};

export const expandFloatingWindow = (onMaximize: () => void = () => {}) => {
  expandAnim.value = withTiming(MAX_OR_SHOW, { duration: 300 }, () =>
    runOnJS(onMaximize),
  );
};
export const minimizeFloatingWindow = (onMinimize?: () => void) => {
  onMinimize?.();
  expandAnim.value = withTiming(MIN_OR_HIDE, { duration: 300 });
};
export const toggleFloatingWindow = ({
  onMinimize,
  onMaximize,
}: {
  onMinimize?: () => void;
  onMaximize?: () => void;
}) => {
  if (expandAnim.value === MIN_OR_HIDE) {
    expandFloatingWindow(onMaximize);
  } else {
    minimizeFloatingWindow(onMinimize);
  }
};
