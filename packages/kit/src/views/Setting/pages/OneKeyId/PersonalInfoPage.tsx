import { memo } from 'react';

import { Page, SizableText, YStack } from '@onekeyhq/components';

function PersonalInfoPageView() {
  return (
    <Page>
      <Page.Header title="Personal Information" />
      <Page.Body>
        <YStack p="$5" gap="$4">
          <SizableText size="$bodyLg" color="$textSubdued">
            Personal information settings will be available here.
          </SizableText>
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default memo(PersonalInfoPageView);
