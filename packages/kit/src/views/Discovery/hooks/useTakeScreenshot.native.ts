import { useCallback } from 'react';

import { manipulateAsync } from 'expo-image-manipulator';
import { captureRef } from 'react-native-view-shot';

import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';

import { THUMB_CROP_SIZE } from '../config/TabList.constants';
import { captureViewRefs } from '../utils/explorerUtils';
import { getScreenshotPath, saveScreenshot } from '../utils/screenshot';

// Extracted from MobileBrowserBottomBar.native to break dependency cycles
export const useTakeScreenshot = (id?: string | null) => {
  const actionsRef = useBrowserTabActions();

  const takeScreenshot = useCallback(
    () =>
      new Promise<boolean>((resolve, reject) => {
        if (!id) {
          reject(new Error('capture view id is null'));
          return;
        }
        captureRef(captureViewRefs[id ?? ''], {
          format: 'jpg',
          quality: 0.2,
        })
          .then(async (imageUri) => {
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
            actionsRef.current.setWebTabData({
              id,
              thumbnail: path,
            });
            void saveScreenshot(manipulateValue.uri, path);
            resolve(true);
          })
          .catch((e) => {
            console.log('capture error e: ', e);
            reject(e);
          });
      }),
    [actionsRef, id],
  );

  return takeScreenshot;
};
