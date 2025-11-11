import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Button,
  Icon,
  Image,
  Page,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

import { OnboardingLayout } from '../components/OnboardingLayout';

import type { RouteProp } from '@react-navigation/core';

export default function BackupWalletReminder() {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const { gtMd } = useMedia();
  const { mnemonic, isWalletBackedUp, walletId } =
    useRoute<
      RouteProp<IOnboardingParamListV2, EOnboardingPagesV2.BackupWalletReminder>
    >().params;
  const handleContinue = () => {
    navigation.push(EOnboardingPagesV2.ShowRecoveryPhrase, {
      mnemonic,
      isWalletBackedUp,
      walletId,
    });
  };

  const TEXTS: { text: string; icon: IKeyOfIcons }[] = [
    {
      text: intl.formatMessage({
        id: ETranslations.onboarding_bullet_recovery_phrase_full_access,
      }),
      icon: 'LockSolid',
    },
    {
      text: intl.formatMessage({
        id: ETranslations.onboarding_bullet_forgot_passcode_use_recovery,
      }),
      icon: 'InputSolid',
    },
    {
      text: intl.formatMessage({
        id: ETranslations.onboarding_bullet_never_share_recovery_phrase,
      }),
      icon: 'EyeOffSolid',
    },
    {
      text: intl.formatMessage({
        id: ETranslations.onboarding_bullet_onekey_support_no_recovery_phrase,
      }),
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
            {intl.formatMessage({
              id: ETranslations.onboarding_save_phrase_securely_instruction,
            })}
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
          {gtMd ? (
            <Button size="large" variant="primary" onPress={handleContinue}>
              {intl.formatMessage({
                id: ETranslations.global_show_recovery_phrase,
              })}
            </Button>
          ) : null}
        </OnboardingLayout.Body>
        {!gtMd ? (
          <OnboardingLayout.Footer>
            <Button
              w="100%"
              size="large"
              variant="primary"
              onPress={handleContinue}
            >
              {intl.formatMessage({
                id: ETranslations.global_show_recovery_phrase,
              })}
            </Button>
          </OnboardingLayout.Footer>
        ) : null}
      </OnboardingLayout>
    </Page>
  );
}
