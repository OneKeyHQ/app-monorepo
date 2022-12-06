import { useCallback } from 'react';

import { useFocusEffect } from '@react-navigation/core';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const useOnKeyDown = platformEnv.isRuntimeBrowser
  ? (key: string, callback: () => void) =>
      useFocusEffect(
        useCallback(() => {
          if (platformEnv.isRuntimeBrowser) {
            const onKeyCallback = (e: KeyboardEvent) => {
              if (e.code === key) {
                callback();
              }
            };
            document.addEventListener('keydown', onKeyCallback);
            return () => {
              document.removeEventListener('keydown', onKeyCallback);
            };
          }
        }, [callback, key]),
      )
  : () => {};

export const useCloseOnEsc = (close: () => void) =>
  useOnKeyDown('Escape', close);
