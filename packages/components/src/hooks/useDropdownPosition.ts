import { useEffect, useRef, useState } from 'react';

import { isNil, isString } from 'lodash';
import { Dimensions, View } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IDropdownPosition, IDropdownProps, SelectProps } from '../Select';

interface UseDropdownProps {
  dropdownPosition?: IDropdownPosition;
  triggerEle?: SelectProps['triggerEle'];
  domId?: any;
  visible?: boolean;
  translateY?: number;
  autoAdjust?: boolean;
  setPositionOnlyMounted?: boolean;
  dropdownProps?: IDropdownProps;
}

export type ISelectorContentPosition = {
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
};

interface ElementPosition {
  left: number;
  right: number;
  top: number;
  width: number;
  height: number;
  outOfX: number;
  outOfY: number;
  overflowWidth: boolean;
  overflowHeight: boolean;
}

const defaultPosition = {
  left: -99999,
  top: -99999,
  right: 0,
  bottom: 0,
};

function getDomElementPosition(ele: HTMLElement) {
  const rect = ele.getBoundingClientRect();
  const win = ele.ownerDocument.defaultView || window;

  const { width } = rect;
  const { height } = rect;
  const left = rect.left + win.scrollX;
  const top = rect.top + win.scrollY;

  const outOfX = left + width - win.innerWidth - 1;
  const outOfY = top + height - win.innerHeight - 1;
  const right = win.innerWidth - rect.right;

  return {
    left,
    right,
    top,
    width,
    height,
    outOfX,
    outOfY,
    overflowWidth: width > win.innerWidth,
    overflowHeight: height > win.innerHeight,
  };
}

const useElementPosition = (
  ele?: SelectProps['triggerEle'],
  visible?: boolean,
) => {
  const [triggerPosition, setTriggerPosition] =
    useState<ElementPosition | null>(null);

  useEffect(() => {
    if (!ele) {
      return;
    }
    if (platformEnv.isRuntimeBrowser) {
      setTriggerPosition(getDomElementPosition(ele as unknown as HTMLElement));
      return;
    }
    // for native
    // see: https://reactnative.dev/docs/direct-manipulation#measurecallback
    setTriggerPosition(null);
    (ele as View).measure((...args: number[]) => {
      const [w, h, left, top] = args.slice(2);
      const { width: winWidth, height: winHeight } = Dimensions.get('window');
      setTriggerPosition({
        left,
        top,
        right: winWidth - left - w,
        width: w,
        height: h,
        outOfX: left + w - winWidth - 1,
        outOfY: top + h - winHeight - 1,
        overflowWidth: w > winWidth,
        overflowHeight: h > winHeight,
      });
    });
  }, [ele, visible]);

  return triggerPosition;
};

function toPxPositionValue(num?: number | null) {
  if (isNil(num)) {
    return undefined;
  }
  return `${Math.round(num)}px`;
}

function useDropdownPosition({
  triggerEle,
  domId,
  visible,
  dropdownPosition = 'left', // 'center' | 'left' | 'right'
  translateY = 0,
  autoAdjust = true,
  setPositionOnlyMounted = false,
  dropdownProps,
}: UseDropdownProps) {
  const [position, setPosition] =
    useState<ISelectorContentPosition>(defaultPosition);
  const [isPositionNotReady, setIsPositionNotReady] = useState(false);
  // TODO reset position to undefined after window resize
  const triggerWidth = useRef<number | null>(null);

  const triggerPosition = useElementPosition(triggerEle, visible);

  useEffect(() => {
    setIsPositionNotReady(
      position.left === defaultPosition.left &&
        position.top === defaultPosition.top,
    );
  }, [position]);

  useEffect(() => {
    let timer: any = null;
    if (!triggerPosition) {
      setPosition(defaultPosition);
      return;
    }
    const { left, top, right, width, height } = triggerPosition;
    triggerWidth.current = width;
    let dropdownHeight = 0;
    if (
      isString(dropdownProps?.height) &&
      dropdownProps?.height.endsWith('px')
    ) {
      dropdownHeight = parseInt(dropdownProps?.height ?? '', 10) || 0;
    }

    let pos: ISelectorContentPosition | null = null;

    if (isPositionNotReady) {
      if (dropdownPosition === 'top-right') {
        pos = {
          left: undefined,
          right,
          top: top + translateY - dropdownHeight,
        };
      } else if (dropdownPosition === 'top-left') {
        pos = {
          left,
          right: undefined,
          top: top + translateY - dropdownHeight,
        };
      } else if (dropdownPosition === 'right') {
        pos = {
          left: undefined,
          right,
          top: top + height + translateY,
        };
      } else if (dropdownPosition === 'left') {
        pos = {
          left,
          right: undefined,
          top: top + height + translateY,
        };
      } else {
        console.error(`dropdownPosition not support yet: ${dropdownPosition}`);
        // TODO supports dropdownPosition==='center'
        pos = {
          left,
          right: undefined,
          top: top + height + translateY,
        };
      }
    }

    if (autoAdjust && platformEnv.isRuntimeBrowser) {
      timer = setTimeout(() => {
        const contentEle = document.getElementById(domId);
        if (contentEle) {
          const pos1 = getDomElementPosition(contentEle);
          let adjustLeft = pos1.left as number | undefined;
          let adjustTop = pos1.top as number | undefined;
          if (isNil(adjustLeft) || isNil(adjustTop)) {
            return;
          }
          adjustTop -= translateY;
          let adjustRight: number | undefined;
          let adjustBottom: number | undefined;
          if (pos1.outOfX > 0) {
            if (pos1.overflowWidth) {
              adjustLeft = 0;
            } else {
              adjustLeft -= pos1.outOfX;
            }
          }
          if (pos1.outOfY > 0) {
            if (pos1.overflowHeight) {
              adjustTop = 0;
            } else {
              adjustTop -= pos1.outOfY;
            }
          }
          if (!isNil(adjustLeft) && adjustLeft < 0) {
            adjustLeft = 0;
          }
          if (!isNil(adjustTop) && adjustTop < 0) {
            adjustTop = 0;
          }

          pos = {
            left: adjustLeft,
            top: adjustTop,
            right: adjustRight,
            bottom: adjustBottom,
          };
        }
      }, 300);
    }
    if (pos) {
      setPosition(pos);
    }
    return () => {
      clearTimeout(timer);
    };
  }, [
    triggerPosition,
    autoAdjust,
    domId,
    dropdownPosition,
    isPositionNotReady,
    setPositionOnlyMounted,
    translateY,
    triggerEle,
    visible,
    dropdownProps?.height,
  ]);

  return {
    position,
    triggerWidth: triggerWidth.current,
    toPxPositionValue,
  };
}

export { useDropdownPosition, toPxPositionValue };
