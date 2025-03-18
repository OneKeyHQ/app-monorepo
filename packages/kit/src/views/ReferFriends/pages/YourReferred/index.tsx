import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { Animated, Easing, Keyboard } from 'react-native';

import {
  AnimatePresence,
  Empty,
  Icon,
  Image,
  Page,
  SizableText,
  Tab,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useHomePageWidth from '../../../Home/hooks/useHomePageWidth';

let CONTENT_ITEM_WIDTH: Animated.Value | undefined;

function HardwareSales() {
  return (
    <YStack>
      <YStack px="$5" pt="$5">
        <SizableText size="$bodyLgMedium">OneKey Pro*2 + Keytag*1</SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          2025-01-26 21:46
        </SizableText>
        <Empty
          icon="PeopleOutline"
          title="Start Earning Today"
          description="Share your referral code to start earning rewards."
        />
      </YStack>
    </YStack>
  );
}

export default function YourReferred() {
  const intl = useIntl();
  const { screenWidth, pageWidth } = useHomePageWidth();
  if (CONTENT_ITEM_WIDTH == null) {
    CONTENT_ITEM_WIDTH = new Animated.Value(pageWidth);
  }

  const tabs = useMemo(
    () => [
      {
        title: 'OneKey ID',
        page: HardwareSales,
      },
      {
        title: 'Earn',
        page: HardwareSales,
      },
      {
        title: 'Hardware Sales',
        page: HardwareSales,
      },
    ],
    [],
  );

  const onRefresh = useCallback(() => {}, []);
  useEffect(() => {
    if (!CONTENT_ITEM_WIDTH) {
      return;
    }
    Animated.timing(CONTENT_ITEM_WIDTH, {
      toValue: pageWidth,
      duration: 400,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [pageWidth]);
  return (
    <Page scrollEnabled>
      <Page.Header title="Your referred" />
      <Page.Body>
        <Tab
          disableRefresh={!platformEnv.isNative}
          data={tabs}
          ListHeaderComponent={
            <YStack px="$5">
              <SizableText size="$bodyLg">Total</SizableText>
              <SizableText size="$heading5xl">245</SizableText>
            </YStack>
          }
          initialScrollIndex={0}
          initialHeaderHeight={220}
          contentItemWidth={CONTENT_ITEM_WIDTH}
          contentWidth={screenWidth}
          showsVerticalScrollIndicator={false}
          onRefresh={onRefresh}
        />
      </Page.Body>
    </Page>
  );
}
