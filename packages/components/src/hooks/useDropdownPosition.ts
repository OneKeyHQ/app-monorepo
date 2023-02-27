import type { MutableRefObject, RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { isNil, isString, pick } from 'lodash';
import { Dimensions, useWindowDimensions } from 'react-native';

import { wait } from '@onekeyhq/kit/src/utils/helper';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ModalRefStore } from '../Modal';

import type { IDropdownPosition, IDropdownProps, SelectProps } from '../Select';
import type { View } from 'react-native';

export interface UseDropdownProps {
  dropdownPosition?: IDropdownPosition;
  triggerEle?: SelectProps['triggerEle'];
  visible?: boolean;
  translateY?: number;
  autoAdjust?: boolean;
  setPositionOnlyMounted?: boolean;
  dropdownProps?: IDropdownProps;
  contentRef?: RefObject<SelectProps['triggerEle']>;
  outerContainerRef?: MutableRefObject<unknown>;
}

export type ISelectorContentPosition = {
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
};

interface ElementRect {
  width: number;
  height: number;
  left: number;
  top: number;
}

interface ElementPosition {
  x?: number;
  y?: number;
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

function isHTMLElement(el?: SelectProps['triggerEle']): el is HTMLElement {
  return !!platformEnv.isRuntimeBrowser;
}

export const getMeasure = (
  ele?: SelectProps['triggerEle'],
): Promise<ElementRect | null> =>
  new Promise((resolve) => {
    if (!ele) {
      return resolve(null);
    }
    if (isHTMLElement(ele)) {
      const rect = ele.getBoundingClientRect();
      return resolve(pick(rect, 'width', 'height', 'left', 'top'));
    }
    ele.measure((...args) => {
      const [width, height, left, top] = args.slice(2);
      resolve({
        width,
        height,
        left,
        top,
      });
    });
  });

function calculatePosition(
  measure: ElementRect,
  win: {
    width: number;
    height: number;
    scrollX?: number;
    scrollY?: number;
  },
) {
  const { left, top, width, height } = measure;
  return {
    left: left + (win.scrollX || 0),
    top: top + (win.scrollY || 0),
    right: win.width - left - width,
    width,
    height,
    outOfX: left + width - win.width - 1,
    outOfY: top + height - win.height - 1,
    overflowWidth: width > win.width,
    overflowHeight: height > win.height,
  };
}

const getElementPosition = async ({
  ele,
  outerContainerRef,
}: Pick<UseDropdownProps, 'visible' | 'outerContainerRef'> & {
  ele: SelectProps['triggerEle'];
}): Promise<ElementPosition | undefined> => {
  const modalRef = outerContainerRef || ModalRefStore.ref;
  const triggerMeasure = await getMeasure(ele);
  if (!triggerMeasure) {
    return;
  }
  const { width, height } = triggerMeasure;
  if (isHTMLElement(ele)) {
    const win = ele.ownerDocument.defaultView || window;
    return calculatePosition(triggerMeasure, {
      width: win.innerWidth,
      height: win.innerHeight,
      scrollX: win.scrollX,
      scrollY: win.scrollY,
    });
  }
  const win = Dimensions.get('window');
  const position = calculatePosition(triggerMeasure, {
    width: win.width,
    height: win.height,
  });
  if (!modalRef?.current || platformEnv.isRuntimeBrowser) {
    return position;
  }
  const modalMeasure = await getMeasure(modalRef?.current as View);

  if (!modalMeasure) {
    return;
  }
  // use Select in native Modal
  const inModalRight = position.right - modalMeasure.left;
  const inModalLeft = position.left - modalMeasure.left;
  const inModalTop = position.top - modalMeasure.top;
  Object.assign(position, {
    left: inModalLeft,
    top: inModalTop,
    right: inModalRight,
    outOfX: inModalLeft + width - modalMeasure.width - 1,
    outOfY: inModalTop + height - modalMeasure.height - 1,
    overflowWidth: width > modalMeasure.width,
    overflowHeight: height > modalMeasure.height,
  });
  return position;
};

function toPxPositionValue(num?: number | null) {
  if (isNil(num)) {
    return undefined;
  }
  return `${Math.round(num)}px`;
}

function useDropdownPosition({
  triggerEle,
  visible,
  dropdownPosition = 'left', // 'center' | 'left' | 'right'
  translateY = 0,
  autoAdjust = true,
  setPositionOnlyMounted = false,
  dropdownProps,
  contentRef,
  outerContainerRef,
}: UseDropdownProps) {
  const win = useWindowDimensions();
  const [position, setPosition] =
    useState<ISelectorContentPosition>(defaultPosition);
  const [isPositionNotReady, setIsPositionNotReady] = useState(false);
  // TODO reset position to undefined after window resize
  const triggerWidth = useRef<number | null>(null);

  useEffect(() => {
    setIsPositionNotReady(
      position.left === defaultPosition.left &&
        position.top === defaultPosition.top,
    );
  }, [position]);

  const getDropdownPosition = useCallback(async (): Promise<
    ISelectorContentPosition | undefined
  > => {
    const triggerPosition = await getElementPosition({
      ele: triggerEle,
      visible,
      outerContainerRef,
    });
    if (!triggerPosition) {
      return defaultPosition;
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
    if (dropdownPosition === 'top-right') {
      return {
        right,
        top: top + translateY - dropdownHeight,
      };
    }
    if (dropdownPosition === 'top-left') {
      return {
        left,
        top: top + translateY - dropdownHeight,
      };
    }
    if (dropdownPosition === 'right') {
      return {
        right,
        top: top + height + translateY,
      };
    }
    if (dropdownPosition === 'left') {
      return {
        left,
        top: top + height + translateY,
      };
    }
    console.error(`dropdownPosition not support yet: ${dropdownPosition}`);
    // TODO supports dropdownPosition==='center'
    return {
      left,
      top: top + height + translateY,
    };
  }, [
    triggerEle,
    visible,
    outerContainerRef,
    dropdownProps?.height,
    dropdownPosition,
    translateY,
  ]);

  const adjustDropdownPosition = useCallback(
    async (pos?: ISelectorContentPosition) => {
      if (!autoAdjust) {
        return pos;
      }
      await wait(300);
      const contentPosition = await getElementPosition({
        ele: contentRef?.current,
      });
      if (!contentPosition) {
        return pos;
      }
      let { left, top } = contentPosition;
      top -= translateY;
      if (contentPosition.outOfX > 0) {
        if (contentPosition.overflowWidth) {
          left = 0;
        } else {
          left -= contentPosition.outOfX;
        }
      }
      if (contentPosition.outOfY > 0) {
        if (contentPosition.overflowHeight) {
          top = 0;
        } else {
          top -= contentPosition.outOfY;
        }
      }
      left = Math.max(left, 0);
      top = Math.max(top, 0);
      return {
        left,
        top,
      };
    },
    [autoAdjust, contentRef, translateY],
  );

  useEffect(() => {
    if (!visible) {
      return;
    }
    getDropdownPosition()
      .then((pos) => {
        if (!pos) {
          return;
        }
        setPosition(pos);
        if (!autoAdjust) {
          return;
        }
        return adjustDropdownPosition(pos);
      })
      .then((pos) => {
        if (!pos) {
          return;
        }
        setPosition(pos);
      });
  }, [
    win,
    visible,
    getDropdownPosition,
    adjustDropdownPosition,
    autoAdjust,
    dropdownPosition,
    isPositionNotReady,
    setPositionOnlyMounted,
    translateY,
    triggerEle,
    dropdownProps?.height,
  ]);

  return {
    position,
    toPxPositionValue,
    isPositionNotReady,
    triggerWidth: triggerWidth.current,
  };
}

export { useDropdownPosition, toPxPositionValue };
