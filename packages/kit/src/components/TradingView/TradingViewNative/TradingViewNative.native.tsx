import { useEffect } from 'react';

import * as ScreenOrientation from 'expo-screen-orientation';
import { noop } from 'lodash';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TradingViewNativeContainer } from './TradingViewNativeContainer';

import type { ITradingViewNativeProps } from './types';

const DEFAULT_ORIENTATION_LOCK = platformEnv.isNativeIOSPad
  ? ScreenOrientation.OrientationLock.DEFAULT
  : ScreenOrientation.OrientationLock.PORTRAIT_UP;

function lockScreenOrientation(
  orientationLock: ScreenOrientation.OrientationLock,
) {
  void ScreenOrientation.lockAsync(orientationLock).catch(noop);
}

export function TradingViewNative(props: ITradingViewNativeProps) {
  const isFullscreen = Boolean(props.isNativeChartFullscreen);

  useEffect(() => {
    lockScreenOrientation(
      isFullscreen
        ? ScreenOrientation.OrientationLock.LANDSCAPE
        : DEFAULT_ORIENTATION_LOCK,
    );

    return () => {
      if (isFullscreen) {
        lockScreenOrientation(DEFAULT_ORIENTATION_LOCK);
      }
    };
  }, [isFullscreen]);

  return <TradingViewNativeContainer {...props} />;
}
