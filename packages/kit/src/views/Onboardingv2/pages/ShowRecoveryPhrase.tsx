import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Button,
  Page,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import {
  ensureSensitiveTextEncoded,
  generateMnemonic,
} from '@onekeyhq/core/src/secret';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useRecoveryPhraseProtected } from '../../../hooks/useRecoveryPhraseProtected/useRecoveryPhraseProtected';
import { OnboardingLayout } from '../components/OnboardingLayout';

import type { RouteProp } from '@react-navigation/core';

export default function ShowRecoveryPhrase() {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const { gtMd } = useMedia();
  const route =
    useRoute<
      RouteProp<IOnboardingParamListV2, EOnboardingPagesV2.ShowRecoveryPhrase>
    >();

  const { result: mnemonic = '' } = usePromiseResult(async () => {
    const routeMnemonic = route.params?.mnemonic;
    if (routeMnemonic) {
      ensureSensitiveTextEncoded(routeMnemonic);
      return backgroundApiProxy.servicePassword.decodeSensitiveText({
        encodedText: routeMnemonic,
      });
    }
    return generateMnemonic();
  }, [route.params.mnemonic]);
  const { result: displayName } = usePromiseResult<string>(async () => {
    if (!route.params.walletId) {
      return '';
    }
    const wallet = await backgroundApiProxy.serviceAccount.getWallet({
      walletId: route.params.walletId,
    });
    if (
      route.params.accountName &&
      accountUtils.isOthersWallet({ walletId: wallet.id })
    ) {
      return route.params.accountName;
    }
    return wallet.name;
  }, [route.params.accountName, route.params.walletId]);
  const recoveryPhrase = useMemo(
    () => mnemonic.split(' ').filter(Boolean),
    [mnemonic],
  );
  const handleContinue = useCallback(async () => {
    let isNotBackedUp = true;
    if (route.params.walletId) {
      const wallet = await backgroundApiProxy.serviceAccount.getWallet({
        walletId: route.params.walletId,
      });
      isNotBackedUp = !wallet?.backuped;
    }
    if (isNotBackedUp) {
      navigation.push(EOnboardingPagesV2.VerifyRecoveryPhrase, route.params);
    } else {
      navigation.popStack();
    }
  }, [navigation, route.params]);

  useRecoveryPhraseProtected();

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header title={displayName} />
        <OnboardingLayout.Body>
          <YStack gap="$5">
            <YStack gap="$3">
              <SizableText size="$heading2xl">
                {intl.formatMessage({
                  id: ETranslations.onboarding_backup_recovery_phrase_help_text,
                })}
              </SizableText>
            </YStack>

            <XStack mx="$-1" py="$5" flexWrap="wrap">
              {recoveryPhrase.map((phrase, index) => (
                <YStack key={index} p="$1" flex={1} flexBasis="50%">
                  <XStack
                    py="$2"
                    px="$1"
                    bg="$bg"
                    borderRadius="$3"
                    gap="$3"
                    borderWidth={1}
                    borderColor="$border"
                  >
                    <SizableText
                      size="$bodyLg"
                      color="$textDisabled"
                      w="$5"
                      textAlign="right"
                    >
                      {index + 1}
                    </SizableText>
                    <SizableText size="$bodyLg">{phrase}</SizableText>
                  </XStack>
                </YStack>
              ))}
              {recoveryPhrase.length % 2 === 1 ? (
                <YStack p="$1" flex={1} flexBasis="50%" />
              ) : null}
            </XStack>

            {gtMd ? (
              <Button size="large" variant="primary" onPress={handleContinue}>
                {intl.formatMessage({
                  id: ETranslations.global_saved_the_phrases,
                })}
              </Button>
            ) : null}
          </YStack>
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
                id: ETranslations.global_saved_the_phrases,
              })}
            </Button>
          </OnboardingLayout.Footer>
        ) : null}
      </OnboardingLayout>
    </Page>
  );
}
