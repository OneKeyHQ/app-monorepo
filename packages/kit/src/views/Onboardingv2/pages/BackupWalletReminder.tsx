import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Button,
  Icon,
  Image,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

import { OnboardingLayout } from '../components/OnboardingLayout';

export default function BackupWalletReminder() {
  const navigation = useAppNavigation();

  const handleContinue = () => {
    navigation.push(EOnboardingPagesV2.ShowRecoveryPhrase);
  };

  const TEXTS: { text: string; icon: IKeyOfIcons }[] = [
    {
      text: 'Your recovery phrase gives full access to your wallet',
      icon: 'LockSolid',
    },
    {
      text: 'Use it to restore your wallet if you forget your passcode',
      icon: 'InputSolid',
    },
    {
      text: 'Never share it or enter it anywhere',
      icon: 'EyeOffSolid',
    },
    {
      text: 'OneKey Support will never ask for it',
      icon: 'Shield2CheckSolid',
    },
  ];

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header />
        <OnboardingLayout.Body>
          <Image
            alignSelf="center"
            source={require('@onekeyhq/kit/assets/onboarding/recovery-phrase-illustration.png')}
            w={108}
            h={162}
          />
          <SizableText size="$heading2xl">
            Read the following, then save the phrase securely
          </SizableText>
          <YStack gap="$4" py="$5">
            {TEXTS.map(({ text, icon }) => (
              <XStack key={text} gap="$3">
                <Icon name={icon} size="$5" color="$iconSubdued" />
                <SizableText
                  key={text}
                  size="$bodyMd"
                  color="$textSubdued"
                  flex={1}
                >
                  {text}
                </SizableText>
              </XStack>
            ))}
          </YStack>
          <Button size="large" variant="primary" onPress={handleContinue}>
            Show recovery phrase
          </Button>
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}
