import { useCallback } from 'react';

import { useFocusEffect } from '@react-navigation/core';

export const DESKTOP_TOP_DRAG_BAR_ID = 'DesktopDragZoneBoxTopFixedDragBar';
export const DESKTOP_TOP_DRAG_BAR_HEIGHT = '20px';

export function useDesktopTopDragBarController({ height }: { height: string }) {
  useFocusEffect(
    useCallback(() => {
      const bar = document.querySelector(`#${DESKTOP_TOP_DRAG_BAR_ID}`) as
        | HTMLElement
        | undefined;
      if (bar) {
        bar.style.height = height;
      }

      return () => {
        if (bar) {
          bar.style.height = DESKTOP_TOP_DRAG_BAR_HEIGHT;
        }
      };
    }, [height]),
  );
}
