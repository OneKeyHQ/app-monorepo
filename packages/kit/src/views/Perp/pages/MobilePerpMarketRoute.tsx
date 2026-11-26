import { useRef } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  GlassButtonCapsule,
  NavBackButton,
  Page,
  XStack,
  YStack,
  useIsOverlayPage,
  useIsSplitDetailActive,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { isFoldableIPhone } from '@onekeyhq/shared/src/modules/DualScreenInfo/isFoldableIPhone';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { LazyLoadPage } from '../../../components/LazyLoadPage';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { loadPerpsMobileMarketPage } from '../utils/preloadPerpsMobileMarketPage';

export interface IMobilePerpMarketPageProps {
  inPageHeaderGeometry?: { width: number; top: number } | null;
}

const LazyMarketDetail = LazyLoadPage(loadPerpsMobileMarketPage);

export function MobilePerpMarketRoute() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const isSplitDetailActive = useIsSplitDetailActive();
  const isOverlayPage = useIsOverlayPage();
  const isFocused = useIsFocused();
  const media = useMedia();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { top: safeAreaTop } = useSafeAreaInsets();
  const isTitleInLeftItem = isFoldableIPhone();
  const isInPageHeaderTarget =
    platformEnv.isNativeIOS26Plus &&
    !platformEnv.isNativeIOSPad &&
    !isTitleInLeftItem &&
    !isOverlayPage &&
    !isSplitDetailActive;
  const portraitHeaderGeometryRef = useRef<{
    width: number;
    top: number;
  } | null>(null);
  // Match Market detail: keep the header in the page during interactive pop,
  // and retain portrait geometry while a fullscreen chart owns orientation.
  if (
    isInPageHeaderTarget &&
    isFocused &&
    media.md &&
    windowWidth <= windowHeight &&
    safeAreaTop > 0
  ) {
    portraitHeaderGeometryRef.current = {
      width: windowWidth,
      top: safeAreaTop,
    };
  }
  const inPageHeaderGeometry = isInPageHeaderTarget
    ? portraitHeaderGeometryRef.current
    : null;

  return (
    <YStack flex={1}>
      {inPageHeaderGeometry ? <Page.Header headerShown={false} /> : null}
      <LazyMarketDetail inPageHeaderGeometry={inPageHeaderGeometry} />
      {inPageHeaderGeometry ? (
        <XStack
          position="absolute"
          left="$4"
          top={inPageHeaderGeometry.top}
          w="$11"
          h="$11"
          alignItems="center"
          justifyContent="center"
        >
          <GlassButtonCapsule circular>
            <NavBackButton
              onPress={() => navigation.pop()}
              borderWidth={0}
              hitSlop={4}
              accessibilityLabel={intl.formatMessage({
                id: ETranslations.global_back,
              })}
            />
          </GlassButtonCapsule>
        </XStack>
      ) : null}
    </YStack>
  );
}
