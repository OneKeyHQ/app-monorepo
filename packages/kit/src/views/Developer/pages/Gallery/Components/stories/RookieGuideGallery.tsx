import { useCallback } from 'react';

import { Button, Page, SizableText, YStack } from '@onekeyhq/components';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';

const ROOKIE_GUIDE_URL = 'http://localhost:3002';

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

  return (
    <Page>
      <Page.Body justifyContent="center" alignItems="center" gap="$5" px="$10">
        <YStack gap="$4" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {ROOKIE_GUIDE_URL}
          </SizableText>
          <Button variant="primary" onPress={openInModal}>
            Open in Modal
          </Button>
          <Button onPress={openInBrowser}>Open in Browser</Button>
        </YStack>
      </Page.Body>
    </Page>
  );
}
