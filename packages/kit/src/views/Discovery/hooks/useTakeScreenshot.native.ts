import { useCallback } from 'react';

import { manipulateAsync } from 'expo-image-manipulator';
import { captureRef } from 'react-native-view-shot';

import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { THUMB_CROP_SIZE } from '../config/TabList.constants';
import { captureViewRefs } from '../utils/explorerUtils';
import { getScreenshotPath, saveScreenshot } from '../utils/screenshot';

// Extracted from MobileBrowserBottomBar.native to break dependency cycles
export const useTakeScreenshot = (id?: string | null) => {
  const actionsRef = useBrowserTabActions();

  const takeScreenshot = useCallback(async () => {
    if (!id) {
      return false;
    }
    // Yield to the main thread so pending animations/transitions
    // can complete before the synchronous GPU snapshot blocks it
    await timerUtils.setTimeoutPromised(undefined, 100);
    try {
      // TODO: replace captureRef with platform-native async snapshot APIs to avoid blocking the main thread.
      // captureRef calls drawViewHierarchyInRect:afterScreenUpdates: synchronously on the main thread.
      // - iOS: use WKWebView.takeSnapshot(with:completionHandler:) which renders asynchronously on the GPU side.
      // - Android: use PixelCopy.request() (API 24+) which captures the Surface content asynchronously.
      const imageUri = await captureRef(captureViewRefs[id ?? ''], {
        format: 'jpg',
        quality: 0.2,
      });
      const manipulateValue = await manipulateAsync(imageUri, [
        {
          crop: {
            originX: 0,
            originY: 0,
            width: THUMB_CROP_SIZE,
            height: THUMB_CROP_SIZE,
          },
        },
      ]);
      const path = getScreenshotPath(`${id}-${Date.now()}.jpg`);
      actionsRef.current?.setWebTabData({
        id,
        thumbnail: path,
      });
      void saveScreenshot(manipulateValue.uri, path);
      return true;
    } catch (e) {
      console.log('capture error e: ', e);
      return false;
    }
  }, [actionsRef, id]);

  return takeScreenshot;
};
