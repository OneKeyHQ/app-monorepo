import { useCallback, useMemo } from 'react';

import { StyleSheet } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { IconButton, Stack, Text, Toast } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../../routes/Root/Modal/Routes';
import { openUrlExternal } from '../../../../utils/openUrl';
import { BROWSER_BOTTOM_BAR_HEIGHT } from '../../config/Animation.constants';
import { THUMB_WIDTH } from '../../config/TabList.constants';
import useBrowserBookmarkAction from '../../hooks/useBrowserBookmarkAction';
import useBrowserOptionsAction from '../../hooks/useBrowserOptionsAction';
import useWebTabAction from '../../hooks/useWebTabAction';
import {
  useDisabledAddedNewTab,
  useDisplayHomePageFlag,
  useWebTabData,
  useWebTabs,
} from '../../hooks/useWebTabs';
import {
  EDiscoveryModalRoutes,
  type IDiscoveryModalParamList,
} from '../../router/Routes';
import { setWebTabData } from '../../store/contextWebTabs';
import { captureViewRefs, webviewRefs } from '../../utils/explorerUtils';
import { getScreenshotPath, saveScreenshot } from '../../utils/screenshot';

import MobileBrowserBottomOptions from './MobileBrowserBottomOptions';

import type WebView from 'react-native-webview';
import type { StackProps } from 'tamagui';

interface IMobileBrowserBottomBarProps extends StackProps {
  id: string;
}

function MobileBrowserBottomBar({ id, ...rest }: IMobileBrowserBottomBarProps) {
  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();
  const { tab } = useWebTabData(id);
  const { tabs } = useWebTabs();

  const { displayHomePage } = useDisplayHomePageFlag();
  const { setPinnedTab, setDisplayHomePage } = useWebTabAction();
  const { disabledAddedNewTab } = useDisabledAddedNewTab();
  const { addBrowserBookmark, removeBrowserBookmark } =
    useBrowserBookmarkAction();
  const { handleShareUrl } = useBrowserOptionsAction();

  const tabCount = useMemo(() => tabs.length, [tabs]);

  const takeScreenshot = useCallback(
    async () =>
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
            void setWebTabData({
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
    [id],
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
      Toast.message({ title: '窗口已达 20 个上限' });
      return;
    }
    try {
      if (!displayHomePage) {
        await takeScreenshot();
      }
    } catch (e) {
      console.error(e);
    }
    navigation.pushModal(EModalRoutes.DiscoveryModal, {
      screen: EDiscoveryModalRoutes.FakeSearchModal,
    });
  }, [disabledAddedNewTab, navigation, displayHomePage, takeScreenshot]);

  const onShare = useCallback(() => {
    handleShareUrl(tab?.url ?? '');
  }, [tab?.url, handleShareUrl]);

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
          testID="browser-bar-go-back"
          disabled={displayHomePage ? true : !tab?.canGoBack}
          onPress={() => {
            (webviewRefs[id]?.innerRef as WebView)?.goBack();
          }}
        />
      </Stack>
      <Stack flex={1} alignItems="center" justifyContent="center">
        <IconButton
          variant="tertiary"
          size="medium"
          icon="ChevronRightOutline"
          testID="browser-bar-go-forward"
          disabled={displayHomePage ? true : !tab?.canGoForward}
          onPress={() => {
            (webviewRefs[id]?.innerRef as WebView)?.goForward();
          }}
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
          testID="browser-bar-tabs"
          onPress={() => {
            void handleShowTabList();
          }}
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
            <Text variant="$bodySmMedium" color="$iconSubdued">
              {tabCount}
            </Text>
          </Stack>
        </Stack>
      </Stack>
      <Stack flex={1} alignItems="center" justifyContent="center">
        <MobileBrowserBottomOptions
          isBookmark={tab?.isBookmark ?? false}
          onBookmarkPress={(isBookmark) => {
            if (isBookmark) {
              addBrowserBookmark({ url: tab?.url, title: tab?.title ?? '' });
            } else {
              removeBrowserBookmark(tab?.url);
            }
            Toast.success({
              title: isBookmark ? 'Bookmark Added' : 'Bookmark Removed',
            });
          }}
          onRefresh={() => {
            console.log(webviewRefs[id]?.reload);
            webviewRefs[id]?.reload();
          }}
          onShare={onShare}
          isPinned={tab?.isPinned ?? false}
          onPinnedPress={(pinned) => {
            void setPinnedTab({ id, pinned });
            Toast.success({ title: pinned ? 'Pined' : ' Unpinned' });
          }}
          onBrowserOpen={() => {
            if (tab?.url) {
              openUrlExternal(tab.url);
            }
          }}
          onGoBackHomePage={async () => {
            await takeScreenshot();
            setTimeout(() => {
              setDisplayHomePage(true);
            });
          }}
        >
          <IconButton
            variant="tertiary"
            size="medium"
            icon="DotHorOutline"
            testID="browser-bar-options"
            disabled={displayHomePage}
          />
        </MobileBrowserBottomOptions>
      </Stack>
    </Stack>
  );
}

export default MobileBrowserBottomBar;
