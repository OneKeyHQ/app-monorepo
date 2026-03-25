import { useCallback } from 'react';

import { Button, Page, SizableText, YStack } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IRookieShareData } from '@onekeyhq/shared/types/rookieGuide';

const ROOKIE_GUIDE_URL = 'http://localhost:3002';

// Mock share data for testing
const MOCK_SHARE_DATA: IRookieShareData = {
  imageUrl: 'https://uni.onekey-asset.com/static/logo/onekey-icon-256.png',
  title: 'How to deposit? Your first step on-chain',
  subtitle: 'Every step brings you closer to Web3',
  footerText: 'Open source and easy to use from day one.',
  referralCode: 'ONEKEY123',
  referralUrl: 'https://web.onekey.so/learning?ref=ONEKEY123',
};

export default function RookieGuideGallery() {
  const openInModal = useCallback(() => {
    openUrlUtils.openUrlInApp(ROOKIE_GUIDE_URL, 'Rookie Guide');
  }, []);

  const openInBrowser = useCallback(() => {
    openUrlUtils.openUrlInDiscovery({
      url: ROOKIE_GUIDE_URL,
      title: 'Rookie Guide',
    });
  }, []);

  const openShareDialog = useCallback(() => {
    appEventBus.emit(EAppEventBusNames.ShowRookieShare, {
      data: MOCK_SHARE_DATA,
    });
  }, []);

  return (
    <Page>
      <Page.Body justifyContent="center" alignItems="center" gap="$5" px="$10">
        <YStack gap="$4" alignItems="center">
          <SizableText size="$headingSm" color="$text">
            Rookie Guide WebView
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {ROOKIE_GUIDE_URL}
          </SizableText>
          <Button variant="primary" onPress={openInModal}>
            Open in Modal
          </Button>
          <Button onPress={openInBrowser}>Open in Browser</Button>
        </YStack>

        <YStack gap="$4" alignItems="center" mt="$8">
          <SizableText size="$headingSm" color="$text">
            Rookie Share Dialog
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
            Test the share dialog with mock data
          </SizableText>
          <Button variant="primary" onPress={openShareDialog}>
            Open Share Dialog
          </Button>
        </YStack>
      </Page.Body>
    </Page>
  );
}
