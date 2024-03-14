import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import type { ForwardedRef, PropsWithChildren } from 'react';

import useEventEmitter from '@react-navigation/core/src/useEventEmitter';

type IRefreshingFocusedEventMapCore = {
  changeFocused: { data: boolean };
  changeIsRefreshing: { data: { isRefreshing: boolean; isHeader: boolean } };
};

const TabRefreshingFocusedContext = createContext<
  | (ReturnType<
      ReturnType<
        typeof useEventEmitter<IRefreshingFocusedEventMapCore>
      >['create']
    > & {
      initialFocused: boolean;
      setScrollHeaderIsRefreshing: (isRefreshing: boolean) => void;
    })
  | undefined
>(undefined);

export type IRefreshingFocusedContainerRef = {
  setFocused: (focused: boolean) => void;
  setIsRefreshing: (isRefreshing: boolean, isHeader: boolean) => void;
};

function RawRefreshingFocusedContainer(
  {
    children,
    initialFocused,
    setScrollHeaderIsRefreshing,
  }: PropsWithChildren & {
    initialFocused: boolean;
    setScrollHeaderIsRefreshing: (isRefreshing: boolean) => void;
  },
  ref: ForwardedRef<IRefreshingFocusedContainerRef>,
) {
  const emitter = useEventEmitter<IRefreshingFocusedEventMapCore>();
  const tabRefreshingFocusedContext = useMemo(
    () => ({
      ...emitter.create(''),
      initialFocused,
      setScrollHeaderIsRefreshing,
    }),
    [emitter, initialFocused, setScrollHeaderIsRefreshing],
  );
  const setFocused = useCallback(
    (focused: boolean) => {
      tabRefreshingFocusedContext.initialFocused = focused;
      emitter.emit({ type: 'changeFocused', data: focused });
    },
    [emitter, tabRefreshingFocusedContext],
  );
  const setIsRefreshing = useCallback(
    (isRefreshing: boolean, isHeader: boolean) => {
      emitter.emit({
        type: 'changeIsRefreshing',
        data: { isRefreshing, isHeader },
      });
    },
    [emitter],
  );
  useImperativeHandle(ref, () => ({
    setFocused,
    setIsRefreshing,
  }));

  return (
    <TabRefreshingFocusedContext.Provider value={tabRefreshingFocusedContext}>
      {children}
    </TabRefreshingFocusedContext.Provider>
  );
}

export function useTabIsRefreshingFocused() {
  const tabRefreshingFocusedContext = useContext(TabRefreshingFocusedContext);
  const [isFocused, setIsFocused] = useState(
    tabRefreshingFocusedContext?.initialFocused,
  );
  const [isHeaderRefreshing, setIsHeaderRefreshing] = useState(false);
  const [isFooterRefreshing, setIsFooterRefreshing] = useState(false);
  useEffect(() => {
    const unsubscribeChangeFocused = tabRefreshingFocusedContext?.addListener(
      'changeFocused',
      ({ data }) => {
        if (data === isFocused) {
          return;
        }
        setIsFocused(data);
      },
    );
    const unsubscribeChangeIsRefreshing =
      tabRefreshingFocusedContext?.addListener(
        'changeIsRefreshing',
        ({ data }) => {
          if (!isFocused) {
            return;
          }
          if (
            (data.isRefreshing === isHeaderRefreshing && data.isHeader) ||
            (data.isRefreshing === isFooterRefreshing && !data.isHeader)
          ) {
            return;
          }
          if (data.isHeader) {
            setIsHeaderRefreshing(data.isRefreshing);
          } else {
            setIsFooterRefreshing(data.isRefreshing);
          }
        },
      );
    return () => {
      unsubscribeChangeFocused?.();
      unsubscribeChangeIsRefreshing?.();
    };
  }, [
    tabRefreshingFocusedContext,
    isFocused,
    isHeaderRefreshing,
    isFooterRefreshing,
  ]);
  const overrideSetIsRefreshing = useCallback(
    (_isRefreshing: boolean) => {
      tabRefreshingFocusedContext?.setScrollHeaderIsRefreshing?.(_isRefreshing);
      setIsHeaderRefreshing(_isRefreshing);
    },
    [tabRefreshingFocusedContext],
  );
  return {
    isFocused,
    isHeaderRefreshing,
    isFooterRefreshing,
    setIsHeaderRefreshing: overrideSetIsRefreshing,
    setIsFooterRefreshing,
  };
}

export const RefreshingFocusedContainer = forwardRef(
  RawRefreshingFocusedContainer,
);
