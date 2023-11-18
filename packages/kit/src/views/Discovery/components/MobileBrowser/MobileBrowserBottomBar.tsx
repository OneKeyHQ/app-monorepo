import { useCallback, useMemo, useState } from 'react';

import { captureRef } from 'react-native-view-shot';

import { IconButton, Stack, Text } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';
import useSafeAreaInsets from '@onekeyhq/components/src/Provider/hooks/useSafeAreaInsets';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../../routes/Root/Modal/Routes';
import { THUMB_HEIGHT, THUMB_WIDTH } from '../../config/TabList.constants';
import useWebTabAction from '../../hooks/useWebTabAction';
import { useWebTabData, useWebTabs } from '../../hooks/useWebTabs';
import {
  EDiscoveryModalRoutes,
  type IDiscoveryModalParamList,
} from '../../router/Routes';
import { setWebTabData } from '../../store/contextWebTabs';
import { captureViewRefs, webviewRefs } from '../../utils/explorerUtils';
import { getScreenshotPath, saveScreenshot } from '../../utils/screenshot';

import MobileBrowserBottomOptions from './MobileBrowserBottomOptions';

import type { IMobileBottomOptionsProps } from '../../types';
import type WebView from 'react-native-webview';

function MobileBrowserBottomBar({ id }: { id: string }) {
  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();
  const { tab } = useWebTabData(id);
  const { tabs } = useWebTabs();
  const { bottom } = useSafeAreaInsets();

  const { addBlankWebTab } = useWebTabAction();
  const [open, onOpenChange] = useState(false);

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
          height: THUMB_HEIGHT,
        })
          .then(async (imageUri) => {
            const path = getScreenshotPath(`${id}.jpg`);
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
      await takeScreenshot();
    } catch (e) {
      console.log(e);
    }
    navigation.pushModal(EModalRoutes.DiscoveryModal, {
      screen: EDiscoveryModalRoutes.MobileTabList,
    });
  }, [takeScreenshot, navigation]);

  return (
    <Stack bg="$bgApp" h={54} zIndex={1} display="flex">
      <Stack
        flex={1}
        flexDirection="row"
        overflow="hidden"
        mb={`${bottom}px`}
        alignItems="center"
        justifyContent="space-between"
        px={27}
      >
        <IconButton
          variant="tertiary"
          size="medium"
          icon="ChevronLeftOutline"
          disabled={!tab?.canGoBack}
          onPress={() => {
            (webviewRefs[id]?.innerRef as WebView)?.goBack();
          }}
        />
        <IconButton
          variant="tertiary"
          size="medium"
          icon="ChevronRightOutline"
          disabled={!tab?.canGoForward}
          onPress={() => {
            (webviewRefs[id]?.innerRef as WebView)?.goForward();
          }}
        />
        <IconButton
          variant="secondary"
          size="medium"
          icon="PlusLargeOutline"
          onPress={() => addBlankWebTab()}
        />
        <Stack
          p="$2"
          borderRadius="$full"
          pressStyle={{
            bg: '$bgActive',
          }}
          onPress={() => {
            void handleShowTabList();
          }}
        >
          <Stack
            minWidth="$5"
            minHeight="$5"
            p={tabCount.toString().length > 1 ? '$1' : undefined}
            borderRadius="$1"
            borderWidth="$0.5"
            borderColor="$iconSubdued"
            flexDirection="row"
            alignItems="center"
            justifyContent="center"
          >
            <Text variant="$bodySmMedium" color="$iconSubdued">
              {tabCount}
            </Text>
          </Stack>
        </Stack>
        <MobileBrowserBottomOptions
          open={open}
          onOpenChange={onOpenChange}
          // {...rest}
        >
          <IconButton
            variant="tertiary"
            size="medium"
            icon="DotHorOutline"
            onPress={() => onOpenChange(true)}
          />
        </MobileBrowserBottomOptions>
      </Stack>
    </Stack>
  );
}

export default MobileBrowserBottomBar;
