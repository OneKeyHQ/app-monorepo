import { Page, SizableText, YStack } from '@onekeyhq/components';

import { OnboardingLayout } from '../components/OnboardingLayout';

function CreatePinPage() {
  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header />
        <OnboardingLayout.Body constrained={false} scrollable={false}>
          <OnboardingLayout.ConstrainedContent>
            <YStack gap="$5">
              <YStack gap="$2">
                <SizableText size="$heading2xl">Create your PIN</SizableText>
                <SizableText size="$bodyLg" color="$textSubdued">
                  Set a PIN to secure your wallet
                </SizableText>
              </YStack>
              {/* TODO: Add PIN input UI */}
            </YStack>
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}

export { CreatePinPage as default };
