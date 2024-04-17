import { useCallback, useEffect, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import wordLists from 'bip39/src/wordlists/english.json';
import { shuffle } from 'lodash';

import type { IPropsWithTestId } from '@onekeyhq/components';
import {
  ActionList,
  Dialog,
  Page,
  SecureView,
  SizableText,
  Stack,
  Toast,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import {
  ensureSensitiveTextEncoded,
  generateMnemonic,
} from '@onekeyhq/core/src/secret';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IOnboardingParamList } from '@onekeyhq/shared/src/routes';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

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

  const verifyRecoveryPhrases = useMemo(() => {
    if (route.params?.isBackup) {
      return [];
    }
    const shufflePhrases = shuffle(phrases).slice(0, 3);
    const length = wordLists.length;
    const confuseWords: string[] = [];
    const getConfuseWord: () => string = () => {
      // eslint-disable-next-line no-bitwise
      const index = (Math.random() * length) >> 1;
      const word = wordLists[index];
      if (shufflePhrases.includes(word) || confuseWords.includes(word)) {
        return getConfuseWord();
      }
      return word;
    };
    for (let i = 0; i < 6; i += 1) {
      confuseWords.push(getConfuseWord());
    }
    return shufflePhrases
      .map((word, index) => [
        phrases.indexOf(word),
        shuffle([
          shufflePhrases[index],
          ...confuseWords.slice(index * 2, index * 2 + 2),
        ]),
      ])
      .sort((a, b) => (a[0] as number) - (b[0] as number));
  }, [phrases, route.params?.isBackup]);

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
      verifyRecoveryPhrases,
    });
  }, [
    mnemonic,
    navigation,
    route.params?.isBackup,
    servicePassword,
    verifyRecoveryPhrases,
  ]);

  const headerRight = useCallback(
    () => (
      <ActionList
        title="More"
        renderTrigger={
          <HeaderIconButton title="Actions" icon="DotHorOutline" />
        }
        items={[
          {
            label: 'Copy recovery phrase',
            icon: 'Copy1Outline',
            onPress: () => {
              Dialog.show({
                icon: 'ErrorOutline',
                tone: 'destructive',
                title: 'Copy recovery phrase?',
                description:
                  'Clipboard access can expose your recovery phrase to unauthorized apps.',
                footerProps: {
                  flexDirection: 'row-reverse',
                },
                onConfirmText: 'Copy anyway',
                onConfirm: () => {
                  copyText(mnemonic);
                },
                confirmButtonProps: {
                  variant: 'secondary',
                },
                onCancelText: 'Cancel copy',
                cancelButtonProps: {
                  variant: 'primary',
                },
              });
            },
          },
        ]}
      />
    ),
    [copyText, mnemonic],
  );

  return (
    <Page scrollEnabled>
      <Page.Header title="Backup recovery phrases" headerRight={headerRight} />
      <Page.Body p="$5" pt="$0">
        <SizableText pt="$2" pb="$4" px="$1" size="$headingMd">
          Write down each phrase in order and store them in a secure location
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
