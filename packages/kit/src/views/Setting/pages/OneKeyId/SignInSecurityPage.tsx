import { memo } from 'react';

import { Page, SizableText, YStack } from '@onekeyhq/components';

function SignInSecurityPageView() {
  return (
    <Page>
      <Page.Header title="Sign-In & Security" />
      <Page.Body>
        <YStack p="$5" gap="$4">
          <SizableText size="$bodyLg" color="$textSubdued">
            Sign-in and security settings will be available here.
          </SizableText>
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default memo(SignInSecurityPageView);
