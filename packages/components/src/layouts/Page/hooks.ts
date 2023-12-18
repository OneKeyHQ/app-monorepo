import { useCallback, useContext } from 'react';

import { useKeyboardEvent, useKeyboardHeight } from '../../hooks';

import { PageContext } from './PageContext';

export const usePage = () => {
  const { options } = useContext(PageContext);
  const getContentOffset = useCallback(
    () => options?.pageOffsetRef?.current,
    [options?.pageOffsetRef],
  );
  return {
    pageRef: options?.pageRef?.current,
    getContentOffset,
  };
};

export const usePageScrollEnabled = () => {
  const { options, setOptions } = useContext(PageContext);
  return {
    scrollEnabled: options?.scrollEnabled,
    changeScrollEnabled: (enabled: boolean) => {
      setOptions?.((value) => ({
        ...value,
        scrollEnabled: enabled,
      }));
    },
  };
};

export const usePageAvoidKeyboard = () => {
  const { options, setOptions } = useContext(PageContext);
  const keyboardHeight = useKeyboardHeight();
  const changePageAvoidHeight = useCallback(
    (callback: (keyboardHeight: number) => number) => {
      setOptions?.((value) => ({
        ...value,
        avoidHeight: callback(keyboardHeight),
      }));
    },
    [keyboardHeight, setOptions],
  );

  useKeyboardEvent(
    {
      keyboardWillHide: () => {
        changePageAvoidHeight(() => 0);
      },
    },
    [],
  );
  return {
    keyboardHeight,
    avoidHeight: options?.avoidHeight,
    changePageAvoidHeight,
  };
};
