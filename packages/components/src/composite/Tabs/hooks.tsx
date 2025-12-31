import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { useWindowDimensions } from 'react-native';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { useAppSideBarStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useIsNativeTablet, useOrientation } from '../../hooks';
import { useIPadModalPageWidth, useIsIpadModalPage } from '../../layouts';
import {
  DESKTOP_MODE_UI_PAGE_BORDER_WIDTH,
  DESKTOP_MODE_UI_PAGE_MARGIN,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
} from '../../utils/sidebar';

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

export const useTabContainerWidth = platformEnv.isNative
  ? () => {
      const isTablet = useIsNativeTablet();
      const isLandscape = useOrientation();
      const { width, height } = useWindowDimensions();
      const isIpadModalPage = useIsIpadModalPage();
      const ipadModalPageWidth = useIPadModalPageWidth();
      if (isIpadModalPage) {
        return ipadModalPageWidth || 640;
      }
      if (isTablet) {
        return isLandscape
          ? Math.max(width, height) / 2
          : Math.min(width, height);
      }
      return Math.min(width, height);
    }
  : () => {
      const [{ isCollapsed: leftSidebarCollapsed = false }] =
        useAppSideBarStatusAtom();
      const { md } = useMedia();
      return useMemo(() => {
        // Small screen or WebDappMode: no sidebar, use full width
        if (platformEnv.isWebDappMode || md) {
          return `calc(100vw)`;
        }

        // Large screen: subtract sidebar width
        const sideBarWidth = leftSidebarCollapsed
          ? MIN_SIDEBAR_WIDTH
          : MAX_SIDEBAR_WIDTH;
        return `calc(100vw - ${
          sideBarWidth +
          DESKTOP_MODE_UI_PAGE_MARGIN +
          DESKTOP_MODE_UI_PAGE_BORDER_WIDTH * 2
        }px)`;
      }, [leftSidebarCollapsed, md]);
    };
