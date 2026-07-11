import { useMemo } from 'react';

import {
  GlassButtonCapsule,
  Page,
  XStack,
  isLiquidGlassAvailable,
  useSafeAreaInsets,
} from '@onekeyhq/components';

import { MoreActionButton } from '../../components/MoreActionButton';
import { HeaderNotificationIconButton } from '../../components/TabPageHeader/components/HeaderNotificationIconButton';
import { HeaderUpdateButton } from '../../components/TabPageHeader/components/HeaderUpdateButton';
import { LegacyUniversalSearchInput } from '../../components/TabPageHeader/LegacyUniversalSearchInput';
import { HOME_HEADER_SEARCH_ROW_HEIGHT } from '../../components/TabPageHeader/MDHeader';

import { NativeHomePage } from './NativeHomePage';
import { HomeTestIDs } from './testIDs';

import type { INativeHomePageViewProps } from './NativeHomePageView.types';

export function NativeHomePageView({
  sceneName: _sceneName,
  onPressHide: _onPressHide,
}: INativeHomePageViewProps) {
  const { top } = useSafeAreaInsets();
  const headerGlassActive = isLiquidGlassAvailable();
  const topBarStyle = useMemo(
    () => ({
      marginTop: top,
    }),
    [top],
  );

  return (
    <Page fullPage testID={HomeTestIDs.page}>
      <Page.Header headerShown={false} />
      <Page.Body>
        <Page.Container flex={1} padded={false}>
          <XStack
            alignItems="center"
            px="$5"
            h={HOME_HEADER_SEARCH_ROW_HEIGHT}
            gap={headerGlassActive ? '$3' : '$6'}
            bg="$bgApp"
            style={topBarStyle}
          >
            <XStack flex={1}>
              <LegacyUniversalSearchInput
                size="medium"
                glass
                containerProps={{ width: '100%', $gtLg: undefined }}
              />
            </XStack>
            <HeaderUpdateButton />
            <GlassButtonCapsule>
              <HeaderNotificationIconButton testID="header-right-notification" />
              <MoreActionButton />
            </GlassButtonCapsule>
          </XStack>
          <NativeHomePage debugOverlayEnabled={false} />
        </Page.Container>
      </Page.Body>
    </Page>
  );
}
