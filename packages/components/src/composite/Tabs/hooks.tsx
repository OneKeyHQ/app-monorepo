import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { useWindowDimensions } from 'react-native';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
import {
  isDualScreenDevice,
  useDualScreenWidth,
} from '@onekeyhq/shared/src/modules/DualScreenInfo';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { isNativeTablet } from '../../hooks/useIsTablet';
import { useIsSplitView } from '../../hooks/useOrientation';
import { useIsIpadModalPage } from '../../layouts/Page/hooks';
import { useIPadModalPageWidth } from '../../layouts/Page/iPadModalPageContext';
import {
  DESKTOP_MODE_UI_PAGE_BORDER_WIDTH,
  DESKTOP_MODE_UI_PAGE_MARGIN,
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

const useNativeTabContainerWidth = isDualScreenDevice()
  ? () => {
      const dualScreenWidth = useDualScreenWidth();
      return dualScreenWidth;
    }
  : () => {
      const isTablet = isNativeTablet();
      const isLandscape = useIsSplitView();
      const { width } = useWindowDimensions();
      const isIpadModalPage = useIsIpadModalPage();
      const ipadModalPageWidth = useIPadModalPageWidth();
      if (isIpadModalPage) {
        return ipadModalPageWidth || 640;
      }
      if (isTablet && isLandscape) {
        // In landscape split view, use half of the screen width
        return width / 2;
      }
      // In portrait or non-tablet, use full screen width
      return width;
    };

export const useTabContainerWidth = platformEnv.isNative
  ? useNativeTabContainerWidth
  : () => {
      const { md } = useMedia();
      return useMemo(() => {
        // Small screen or WebDappMode: no sidebar, use full width
        if (platformEnv.isWebDappMode || md) {
          return `calc(100vw)`;
        }

        // Large screen: subtract sidebar width (always collapsed)
        return `calc(100vw - ${
          MIN_SIDEBAR_WIDTH +
          DESKTOP_MODE_UI_PAGE_MARGIN +
          DESKTOP_MODE_UI_PAGE_BORDER_WIDTH * 2
        }px)`;
      }, [md]);
    };
