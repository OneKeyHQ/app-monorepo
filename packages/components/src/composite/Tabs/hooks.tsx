import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import type { ForwardedRef, PropsWithChildren } from 'react';

import { useTabNameContext as useNativeTabNameContext } from './TabNameContext';
import { useEventEmitter } from './useEventEmitter';
import { useFocusedTab } from './useFocusedTab';

export const useTabNameContext = useNativeTabNameContext;

export const useIsFocusedTab = () => {
  const focusedTab = useFocusedTab();
  const tabName = useTabNameContext();
  return focusedTab === tabName;
};

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
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      emitter.emit({ type: 'changeFocused', data: focused });
    },
    [emitter, tabRefreshingFocusedContext],
  );
  const setIsRefreshing = useCallback(
    (isRefreshing: boolean, isHeader: boolean) => {
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
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
  // const [isFocused, setIsFocused] = useState(true);
  const [isHeaderRefreshing, setIsHeaderRefreshing] = useState(false);
  const [isFooterRefreshing, setIsFooterRefreshing] = useState(false);
  const overrideSetIsHeaderRefreshing = useCallback(
    (_isRefreshing: boolean) => {
      tabRefreshingFocusedContext?.setScrollHeaderIsRefreshing?.(_isRefreshing);
      setIsHeaderRefreshing(_isRefreshing);
    },
    [tabRefreshingFocusedContext],
  );

  const isFocused = useIsFocusedTab();

  return {
    isFocused,
    isHeaderRefreshing,
    isFooterRefreshing,
    setIsHeaderRefreshing: overrideSetIsHeaderRefreshing,
    setIsFooterRefreshing,
  };
}

export const RefreshingFocusedContainer = forwardRef(
  RawRefreshingFocusedContainer,
);
