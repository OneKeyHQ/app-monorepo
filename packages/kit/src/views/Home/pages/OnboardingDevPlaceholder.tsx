import { useCallback } from 'react';

import { Button, Page, SizableText, YStack } from '@onekeyhq/components';
import {
  EOnboardingPagesV2,
  EOnboardingV2Routes,
} from '@onekeyhq/shared/src/routes';
import { ERootRoutes } from '@onekeyhq/shared/src/routes/root';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';

function OnboardingDevPlaceholder() {
  const navigation = useAppNavigation();

  const handleReenterOnboarding = useCallback(() => {
    navigation.navigate(ERootRoutes.Onboarding, {
      screen: EOnboardingV2Routes.OnboardingV2,
      params: {
        screen: EOnboardingPagesV2.GetStarted,
      },
    });
  }, [navigation]);

  const handleClearAndRestart = useCallback(async () => {
    await backgroundApiProxy.serviceApp.resetApp();
  }, []);

  return (
    <Page>
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        gap="$4"
        p="$4"
      >
        <SizableText size="$headingXl">Onboarding Dev Mode</SizableText>
        <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
          Placeholder for onboarding redesign development.
        </SizableText>
        <YStack gap="$3" w="100%" maxWidth={300} pt="$4">
          <Button size="large" onPress={handleReenterOnboarding}>
            Re-enter Onboarding
          </Button>
          <Button
            size="large"
            variant="destructive"
            onPress={handleClearAndRestart}
          >
            Clear Data & Restart
          </Button>
        </YStack>
      </YStack>
    </Page>
  );
}

export default OnboardingDevPlaceholder;
