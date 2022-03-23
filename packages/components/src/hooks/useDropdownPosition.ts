import { useEffect, useRef, useState } from 'react';

import { isNil, isString } from 'lodash';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IDropdownPosition, IDropdownProps } from '../Select';

export type ISelectorContentPosition = {
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
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
}: {
  dropdownPosition?: IDropdownPosition;
  triggerEle?: any;
  domId?: any;
  visible?: boolean;
  translateY?: number;
  autoAdjust?: boolean;
  setPositionOnlyMounted?: boolean;
  dropdownProps?: IDropdownProps;
}) {
  const [position, setPosition] = useState<ISelectorContentPosition>({
    left: undefined,
    top: undefined,
    right: undefined,
    bottom: undefined,
  });
  // TODO reset position to undefined after window resize
  const isPositionNotReady = isNil(position.left) && isNil(position.top);
  const triggerWidth = useRef<number | null>(null);

  useEffect(() => {
    let timer: any = null;
    if (!platformEnv.isBrowser) {
      return;
    }
    if (triggerEle && visible) {
      const triggerPosition = getDomElementPosition(triggerEle);
      triggerWidth.current = triggerPosition.width;
      let dropdownHeight = 0;
      if (isString(dropdownProps?.height)) {
        if (dropdownProps?.height.endsWith('px')) {
          dropdownHeight = parseInt(dropdownProps?.height ?? '', 10) || 0;
        }
      }

      if (!setPositionOnlyMounted || isPositionNotReady) {
        if (dropdownPosition === 'top-right') {
          setPosition({
            left: undefined,
            right: triggerPosition.right,
            top: triggerPosition.top + translateY - dropdownHeight,
          });
        } else if (dropdownPosition === 'right') {
          setPosition({
            left: undefined,
            right: triggerPosition.right,
            top: triggerPosition.top + triggerPosition.height + translateY,
          });
        } else if (dropdownPosition === 'left') {
          setPosition({
            left: triggerPosition.left,
            right: undefined,
            top: triggerPosition.top + triggerPosition.height + translateY,
          });
        } else {
          console.error(
            `dropdownPosition not support yet: ${dropdownPosition}`,
          );
          // TODO supports dropdownPosition==='center'
          setPosition({
            left: triggerPosition.left,
            right: undefined,
            top: triggerPosition.top + triggerPosition.height + translateY,
          });
        }
      }

      if (autoAdjust) {
        timer = setTimeout(() => {
          const contentEle = document.getElementById(domId);
          if (contentEle && autoAdjust) {
            const pos1 = getDomElementPosition(contentEle);
            let left = pos1.left as number | undefined;
            let top = pos1.top as number | undefined;
            if (isNil(left) || isNil(top)) {
              return;
            }
            top -= translateY;
            let right: number | undefined;
            let bottom: number | undefined;
            if (pos1.outOfX > 0) {
              if (pos1.overflowWidth) {
                left = 0;
              } else {
                left -= pos1.outOfX;
              }
            }
            if (pos1.outOfY > 0) {
              if (pos1.overflowHeight) {
                top = 0;
              } else {
                top -= pos1.outOfY;
              }
            }
            if (!isNil(left) && left < 0) {
              left = 0;
            }
            if (!isNil(top) && top < 0) {
              top = 0;
            }

            setPosition({
              left,
              top,
              right,
              bottom,
            });
          }
        }, 300);
      }
    }
    return () => {
      clearTimeout(timer);
    };
  }, [
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
