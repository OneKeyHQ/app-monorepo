import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { useWindowDimensions } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useProviderSideBarValue from '../../hocs/Provider/hooks/useProviderSideBarValue';
import { getTokens, useIsHorizontalLayout, useMedia } from '../../hooks';

import { useTabNameContext as useNativeTabNameContext } from './TabNameContext';
import { useFocusedTab } from './useFocusedTab';

import type { useEventEmitter } from './useEventEmitter';

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

export * from './useCurrentTabScrollY';

const useNativeTabContainerWidth = platformEnv.isNativeIOSPad
  ? () => {
      const isHorizontal = useIsHorizontalLayout();
      const { width } = useWindowDimensions();
      const sideBarWidth = useMemo(() => {
        if (isHorizontal) {
          return getTokens().size.sideBarWidth.val;
        }
        return 0;
      }, [isHorizontal]);
      return width - sideBarWidth;
    }
  : () => undefined;
export const useTabContainerWidth = platformEnv.isNative
  ? useNativeTabContainerWidth
  : () => {
      const { leftSidebarCollapsed = false } = useProviderSideBarValue() || {};
      const { md } = useMedia();
      const sideBarWidth = useMemo(() => {
        if (md) {
          return 0;
        }
        if (!leftSidebarCollapsed) {
          return getTokens().size.sideBarWidth.val;
        }
        return 0;
      }, [md, leftSidebarCollapsed]);
      return `calc(100vw - ${sideBarWidth}px)`;
    };
