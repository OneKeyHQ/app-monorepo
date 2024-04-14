import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';

import type { IPropsWithTestId } from '@onekeyhq/components';
import {
  Button,
  Input,
  Page,
  SecureView,
  SizableText,
  Stack,
  Toast,
  XStack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import {
  ensureSensitiveTextEncoded,
  generateMnemonic,
} from '@onekeyhq/core/src/secret';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOnboardingParamList } from '@onekeyhq/shared/src/routes';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

import { Tutorials } from '../../components';

import type { RouteProp } from '@react-navigation/core';

function FocusDisplayInput({
  text,
  index,
  testID = '',
}: IPropsWithTestId<{ text: string; index: number }>) {
  return (
    <XStack
      px="$2"
      py="$1.5"
      bg="$bgDisabled"
      bw="$px"
      borderColor="$border"
      borderRadius="$2"
      $md={{
        px: '$3',
        py: '$2',
        borderRadius: '$3',
      }}
    >
      <SizableText
        selectable={false}
        minWidth="$7"
        color="$textSubdued"
        $md={{ minWidth: '$8' }}
      >
        {index + 1}
      </SizableText>
      <SizableText selectable testID={testID}>
        {text}
      </SizableText>
    </XStack>
  );
}

export function RecoveryPhrase() {
  const navigation = useAppNavigation();
  const { copyText } = useClipboard();
  const { servicePassword } = backgroundApiProxy;

  const route =
    useRoute<
      RouteProp<IOnboardingParamList, EOnboardingPages.RecoveryPhrase>
    >();

  useEffect(() => {
    console.log('RecoveryPhrase useEffect');
  }, []);

  const { result: mnemonic = '' } = usePromiseResult(async () => {
    console.log('RecoveryPhrase generateMnemonic');
    const routeMnemonic = route.params?.mnemonic;
    if (routeMnemonic) {
      ensureSensitiveTextEncoded(routeMnemonic);
      return backgroundApiProxy.servicePassword.decodeSensitiveText({
        encodedText: routeMnemonic,
      });
    }
    return generateMnemonic();
  }, [route.params.mnemonic]);
  const phrases = useMemo(
    () => mnemonic.split(' ').filter(Boolean),
    [mnemonic],
  );

  const handleConfirmPress = useCallback(async () => {
    if (route.params?.isBackup) {
      Toast.success({
        title: 'Done! Your recovery phrase is backuped.',
      });
      navigation.popStack();
      return;
    }
    navigation.push(EOnboardingPages.VerifyRecoverPhrase, {
      mnemonic: await servicePassword.encodeSensitiveText({
        text: mnemonic,
      }),
      isBackup: route.params?.isBackup,
    });
  }, [mnemonic, navigation, route.params?.isBackup, servicePassword]);

  return (
    <Page scrollEnabled>
      <Page.Header title="Write Down Your Phrases" />
      <Page.Body p="$5" pt="$0">
        <SizableText pt="$2" pb="$4" px="$1" size="$headingMd">
          Tap to display words and write down your phrases in order
        </SizableText>

        <SecureView>
          <XStack flexWrap="wrap" mx="$-1">
            {phrases.map((phrase, index) => (
              <Stack
                key={index}
                $md={{
                  flexBasis: '50%',
                }}
                flexBasis="33.33%"
                p="$1"
              >
                <FocusDisplayInput
                  text={phrase}
                  index={index}
                  testID={`phrase-index${index}`}
                />
              </Stack>
            ))}
          </XStack>
        </SecureView>

        <Tutorials
          list={[
            {
              title: "Why Can't I Copy Multiple Phrases?",
              description: 'Mass copying is disabled for clipboard security.',
            },
            {
              title: 'Why One Word at a Time?',
              description: 'One-word display combats screen recording threats.',
            },
          ]}
        />
      </Page.Body>
      <Page.Footer
        onConfirmText="I've Saved the Phrase"
        onConfirm={handleConfirmPress}
        confirmButtonProps={{ testID: 'saved-the-phrase' }}
      />
    </Page>
  );
}

export default RecoveryPhrase;
