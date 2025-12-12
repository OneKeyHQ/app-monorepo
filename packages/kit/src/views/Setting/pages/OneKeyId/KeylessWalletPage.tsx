import { memo } from 'react';

import { Page, SizableText, YStack } from '@onekeyhq/components';

function KeylessWalletPageView() {
  return (
    <Page>
      <Page.Header title="Keyless Wallet" />
      <Page.Body>
        <YStack p="$5" gap="$4">
          <SizableText size="$bodyLg" color="$textSubdued">
            Keyless wallet settings will be available here.
          </SizableText>
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default memo(KeylessWalletPageView);
