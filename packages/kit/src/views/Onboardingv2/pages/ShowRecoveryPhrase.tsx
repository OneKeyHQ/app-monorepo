import { useMemo } from 'react';

import { useRoute } from '@react-navigation/core';

import {
  Button,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  ensureSensitiveTextEncoded,
  generateMnemonic,
} from '@onekeyhq/core/src/secret';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { OnboardingLayout } from '../components/OnboardingLayout';

import type { RouteProp } from '@react-navigation/core';

export default function ShowRecoveryPhrase() {
  const navigation = useAppNavigation();
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
  const recoveryPhrase = useMemo(
    () => mnemonic.split(' ').filter(Boolean),
    [mnemonic],
  );
  const handleContinue = () => {
    navigation.push(EOnboardingPagesV2.VerifyRecoveryPhrase, route.params);
  };

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header title="Wallet #1" />
        <OnboardingLayout.Body>
          <YStack gap="$5">
            <YStack gap="$3">
              <SizableText size="$heading2xl">
                Note down phrase in order and keep them safe.
              </SizableText>
            </YStack>

            <XStack mx="$-1" py="$5" flexWrap="wrap">
              {recoveryPhrase.map((phrase, index) => (
                <YStack key={index} p="$1" flex={1} w="50%">
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
            </XStack>

            <Button size="large" variant="primary" onPress={handleContinue}>
              I've saved the phrases
            </Button>
          </YStack>
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}
