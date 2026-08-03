import { useCallback, useState } from 'react';

import {
  KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET,
  Keyboard,
  Page,
  Stack,
  YStack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { TabPageHeader } from '../../../components/TabPageHeader';
import { NotBackedUpEmpty } from '../components/NotBakcedUp';
import { HomeTestIDs } from '../testIDs';

import { HomeHeaderContainer } from './HomeHeaderContainer';
import { homePageContentMaxWidthSx } from './homePageContentMaxWidth';

import type { LayoutChangeEvent } from 'react-native';

export type IEmptyWalletHomePageProps = {
  variant: 'notBackedUp';
  sceneName: EAccountSelectorSceneName;
  tabBarBottomInset?: number;
};

export function EmptyWalletHomePage({
  variant,
  sceneName,
  tabBarBottomInset,
}: IEmptyWalletHomePageProps) {
  const measuredTabBarBottomInset = useScrollContentTabBarOffset();
  const bottomInset = tabBarBottomInset ?? measuredTabBarBottomInset;
  const [tabPageHeight, setTabPageHeight] = useState(
    platformEnv.isNativeIOS ? 162 : 92,
  );
  const handleTabPageLayout = useCallback((event: LayoutChangeEvent) => {
    setTabPageHeight(event.nativeEvent.layout.height - 20);
  }, []);

  return (
    <Page fullPage testID={HomeTestIDs.emptyWalletPage}>
      <Page.Body>
        <Page.Container flex={1} padded={false}>
          {platformEnv.isNative ? (
            <Stack h={tabPageHeight} />
          ) : (
            <TabPageHeader sceneName={sceneName} tabRoute={ETabRoutes.Home} />
          )}
          <Keyboard.AwareScrollView
            testID={HomeTestIDs.emptyWalletScroll}
            style={{ flex: 1 }}
            nestedScrollEnabled={platformEnv.isNativeAndroid}
            contentContainerStyle={{ paddingBottom: bottomInset }}
            bottomOffset={KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET}
          >
            <Stack {...homePageContentMaxWidthSx}>
              <HomeHeaderContainer variant={variant} />
            </Stack>
            <NotBackedUpEmpty />
          </Keyboard.AwareScrollView>
          {platformEnv.isNative ? (
            <YStack
              position="absolute"
              top={-20}
              left={0}
              bg="$bgApp"
              pt="$5"
              width="100%"
              onLayout={handleTabPageLayout}
            >
              <TabPageHeader sceneName={sceneName} tabRoute={ETabRoutes.Home} />
            </YStack>
          ) : null}
        </Page.Container>
      </Page.Body>
    </Page>
  );
}
