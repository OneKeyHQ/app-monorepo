import type { IPageScreenProps } from '@onekeyhq/components';
import { Page, SizableText, YStack } from '@onekeyhq/components';
import { useKeylessWalletFeatureIsEnabled } from '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet';
import type {
  EOnboardingPagesV2,
  IOnboardingParamListV2,
} from '@onekeyhq/shared/src/routes/onboardingv2';

import { OnboardingLayout } from '../components/OnboardingLayout';

export default function KeylessWalletRecovery({
  route: _route,
}: IPageScreenProps<
  IOnboardingParamListV2,
  EOnboardingPagesV2.KeylessWalletRecovery
>) {
  const isKeylessWalletEnabled = useKeylessWalletFeatureIsEnabled();

  if (!isKeylessWalletEnabled) {
    return null;
  }

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header title="Restore your wallet" />
        <OnboardingLayout.Body constrained={false}>
          <OnboardingLayout.ConstrainedContent
            gap="$10"
            $platform-native={{
              py: '$5',
            }}
          >
            <YStack gap="$2">
              <SizableText color="$textDisabled">
                Restore by{' '}
                <SizableText color="$textSubdued" size="$bodyMdMedium">
                  2 security keys
                </SizableText>
                .
              </SizableText>
            </YStack>
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}
