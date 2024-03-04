import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import type { IStackProps } from '@onekeyhq/components';
import { IconButton, SizableText, Stack, Toast } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import {
  useBrowserBookmarkAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { BROWSER_BOTTOM_BAR_HEIGHT } from '../../config/Animation.constants';
import { THUMB_WIDTH } from '../../config/TabList.constants';
import useBrowserOptionsAction from '../../hooks/useBrowserOptionsAction';
import {
  useDisabledAddedNewTab,
  useDisplayHomePageFlag,
  useWebTabDataById,
  useWebTabs,
} from '../../hooks/useWebTabs';
import {
  EDiscoveryModalRoutes,
  type IDiscoveryModalParamList,
} from '../../router/Routes';
import { captureViewRefs, webviewRefs } from '../../utils/explorerUtils';
import { getScreenshotPath, saveScreenshot } from '../../utils/screenshot';

import MobileBrowserBottomOptions from './MobileBrowserBottomOptions';

import type WebView from 'react-native-webview';

interface IMobileBrowserBottomBarProps extends IStackProps {
  id: string;
}

function MobileBrowserBottomBar({ id, ...rest }: IMobileBrowserBottomBarProps) {
  const intl = useIntl();
  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();

  const { tab } = useWebTabDataById(id);
  const { tabs } = useWebTabs();

  const { displayHomePage } = useDisplayHomePageFlag();
  const { setWebTabData, setPinnedTab, setCurrentWebTab } =
    useBrowserTabActions().current;
  const { disabledAddedNewTab } = useDisabledAddedNewTab();
  const { addBrowserBookmark, removeBrowserBookmark } =
    useBrowserBookmarkAction().current;
  const { handleShareUrl } = useBrowserOptionsAction();

  const tabCount = useMemo(() => tabs.length, [tabs]);

  const takeScreenshot = useCallback(
    () =>
      new Promise<boolean>((resolve, reject) => {
        if (!id) {
          reject(new Error('capture view id is null'));
          return;
        }
        captureRef(captureViewRefs[id ?? ''], {
          format: 'jpg',
          quality: 0.2,
          width: THUMB_WIDTH,
          height: THUMB_WIDTH,
        })
          .then(async (imageUri) => {
            const path = getScreenshotPath(`${id}-${Date.now()}.jpg`);
            setWebTabData({
              id,
              thumbnail: path,
            });
            void saveScreenshot(imageUri, path);
            resolve(true);
          })
          .catch((e) => {
            console.log('capture error e: ', e);
            reject(e);
          });
      }),
    [id, setWebTabData],
  );

  const handleShowTabList = useCallback(async () => {
    try {
      if (!displayHomePage) {
        await takeScreenshot();
      }
    } catch (e) {
      console.error(e);
    }
    navigation.pushModal(EModalRoutes.DiscoveryModal, {
      screen: EDiscoveryModalRoutes.MobileTabList,
    });
  }, [takeScreenshot, navigation, displayHomePage]);

  const handleAddNewTab = useCallback(async () => {
    if (disabledAddedNewTab) {
      Toast.message({
        title: intl.formatMessage(
          { id: 'msg__tab_has_reached_the_maximum_limit_of_str' },
          { 0: '20' },
        ),
      });
      return;
    }
    try {
      if (!displayHomePage) {
        await takeScreenshot();
      }
    } catch (e) {
      console.error(e);
    }
    navigation.pushFullModal(EModalRoutes.DiscoveryModal, {
      screen: EDiscoveryModalRoutes.SearchModal,
    });
  }, [disabledAddedNewTab, navigation, displayHomePage, takeScreenshot, intl]);

  const handleBookmarkPress = useCallback(
    (isBookmark: boolean) => {
      if (isBookmark) {
        void addBrowserBookmark({ url: tab?.url, title: tab?.title ?? '' });
      } else {
        void removeBrowserBookmark(tab?.url);
      }
      Toast.success({
        title: isBookmark
          ? intl.formatMessage({ id: 'msg__bookmark_added' })
          : intl.formatMessage({ id: 'msg__bookmark_removed' }),
      });
    },
    [intl, addBrowserBookmark, removeBrowserBookmark, tab?.url, tab?.title],
  );

  const handlePinTab = useCallback(
    (pinned: boolean) => {
      setPinnedTab({ id, pinned });
      Toast.success({
        title: pinned
          ? intl.formatMessage({ id: 'msg__pinned' })
          : intl.formatMessage({ id: 'msg__unpinned' }),
      });
    },
    [setPinnedTab, id, intl],
  );

  const handleGoBackHome = useCallback(async () => {
    try {
      await takeScreenshot();
    } catch (e) {
      console.error('takeScreenshot error: ', e);
    }
    setTimeout(() => {
      setCurrentWebTab(null);
    });
  }, [takeScreenshot, setCurrentWebTab]);

  const onShare = useCallback(() => {
    handleShareUrl(tab?.url ?? '');
  }, [tab?.url, handleShareUrl]);

  const disabledGoBack = displayHomePage || !tab?.canGoBack;
  const disabledGoForward = displayHomePage ? true : !tab?.canGoForward;
  return (
    <Stack
      flexDirection="row"
      bg="$bgApp"
      h={BROWSER_BOTTOM_BAR_HEIGHT}
      zIndex={1}
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderSubdued"
      {...rest}
    >
      <Stack flex={1} alignItems="center" justifyContent="center">
        <IconButton
          variant="tertiary"
          size="medium"
          icon="ChevronLeftOutline"
          disabled={disabledGoBack}
          accessible={!disabledGoBack}
          onPress={() => {
            (webviewRefs[id]?.innerRef as WebView)?.goBack();
          }}
          testID="browser-bar-go-back"
        />
      </Stack>
      <Stack flex={1} alignItems="center" justifyContent="center">
        <IconButton
          variant="tertiary"
          size="medium"
          icon="ChevronRightOutline"
          disabled={disabledGoForward}
          accessible={!disabledGoForward}
          onPress={() => {
            (webviewRefs[id]?.innerRef as WebView)?.goForward();
          }}
          testID="browser-bar-go-forward"
        />
      </Stack>
      <Stack flex={1} alignItems="center" justifyContent="center">
        <IconButton
          variant="secondary"
          size="medium"
          icon="PlusLargeOutline"
          onPress={handleAddNewTab}
          testID="browser-bar-add"
        />
      </Stack>
      <Stack flex={1} alignItems="center" justifyContent="center">
        <Stack
          p="$3"
          borderRadius="$full"
          pressStyle={{
            bg: '$bgActive',
          }}
          onPress={() => {
            void handleShowTabList();
          }}
          testID="browser-bar-tabs"
        >
          <Stack
            minWidth="$5"
            minHeight="$5"
            borderRadius="$1"
            borderWidth="$0.5"
            borderColor="$iconSubdued"
            alignItems="center"
            justifyContent="center"
          >
            <SizableText size="$bodySmMedium" color="$iconSubdued">
              {tabCount}
            </SizableText>
          </Stack>
        </Stack>
      </Stack>
      <Stack flex={1} alignItems="center" justifyContent="center">
        <MobileBrowserBottomOptions
          isBookmark={tab?.isBookmark ?? false}
          onBookmarkPress={handleBookmarkPress}
          onRefresh={() => {
            webviewRefs[id]?.reload();
          }}
          onShare={onShare}
          isPinned={tab?.isPinned ?? false}
          onPinnedPress={handlePinTab}
          onBrowserOpen={() => {
            if (tab?.url) {
              openUrlExternal(tab.url);
            }
          }}
          onGoBackHomePage={handleGoBackHome}
        >
          <IconButton
            variant="tertiary"
            size="medium"
            icon="DotHorOutline"
            disabled={displayHomePage}
            testID="browser-bar-options"
          />
        </MobileBrowserBottomOptions>
      </Stack>
    </Stack>
  );
}

export default MobileBrowserBottomBar;
