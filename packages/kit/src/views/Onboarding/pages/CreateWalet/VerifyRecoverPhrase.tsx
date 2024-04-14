import { useCallback, useState } from 'react';

import { isEqual } from 'lodash';

import type { IButtonProps, IPageScreenProps } from '@onekeyhq/components';
import {
  Button,
  Page,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ensureSensitiveTextEncoded } from '@onekeyhq/core/src/secret';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IOnboardingParamList } from '@onekeyhq/shared/src/routes';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

function WordButton({
  children,
  onPress,
  ...props
}: { children: string; onPress: (word: string) => void } & Omit<
  IButtonProps,
  'onPress' | 'children'
>) {
  const handlePress = useCallback(() => {
    onPress(children);
  }, [children, onPress]);
  return (
    <Button onPress={handlePress} {...props}>
      {children}
    </Button>
  );
}

function WordSelector({
  words,
  selectedWord,
  onSelect,
}: {
  words: string[];
  selectedWord: string;
  onSelect: (word: string) => void;
}) {
  const onPress = useCallback(
    (word: string) => {
      onSelect(word);
    },
    [onSelect],
  );

  return (
    <XStack space="$2.5">
      {words.map((word) => (
        <WordButton
          flex={1}
          width="100%"
          key={word}
          onPress={onPress}
          borderColor={selectedWord === word ? '$borderActive' : undefined}
        >
          {word}
        </WordButton>
      ))}
    </XStack>
  );
}

export function VerifyRecoveryPhrase({
  route,
}: IPageScreenProps<
  IOnboardingParamList,
  EOnboardingPages.VerifyRecoverPhrase
>) {
  const { servicePassword } = backgroundApiProxy;
  const { mnemonic, verifyRecoveryPhrases } = route.params || {};

  ensureSensitiveTextEncoded(mnemonic);
  const navigation = useAppNavigation();

  const { result: phrases } = usePromiseResult(async () => {
    if (process.env.NODE_ENV !== 'production') {
      const mnemonicRaw = await servicePassword.decodeSensitiveText({
        encodedText: mnemonic,
      });
      return mnemonicRaw.split(' ');
    }
    return [];
  }, [mnemonic, servicePassword]);

  const [selectedWords, setSelectedWords] = useState<string[]>([]);

  const handleConfirm = useCallback(() => {
    if (verifyRecoveryPhrases && phrases) {
      const isValid = selectedWords.every((word, index) => {
        const [wordIndex] = verifyRecoveryPhrases[index];
        return word === phrases[Number(wordIndex)];
      });

      if (isValid) {
        navigation.push(EOnboardingPages.FinalizeWalletSetup, {
          mnemonic,
        });
      } else {
        Toast.error({
          title: 'Invalid words',
          message: 'Double-check and retry',
        });
      }
    }
  }, [mnemonic, navigation, phrases, selectedWords, verifyRecoveryPhrases]);

  return (
    <Page>
      <Page.Header title="Verify your Recovery Phrase" />
      <Page.Body p="$5">
        {phrases && verifyRecoveryPhrases ? (
          <YStack space="$5">
            {verifyRecoveryPhrases.map(([wordIndex, phraseArray], index) => (
              <YStack key={String(wordIndex)} space="$2.5">
                <SizableText>{`Word #${Number(wordIndex) + 1}`}</SizableText>
                <WordSelector
                  words={phraseArray}
                  selectedWord={selectedWords[index]}
                  onSelect={(word) => {
                    setSelectedWords((prev) => {
                      prev[index] = word;
                      return [...prev];
                    });
                  }}
                />
              </YStack>
            ))}
          </YStack>
        ) : null}
      </Page.Body>
      <Page.Footer onConfirmText="Confirm" onConfirm={handleConfirm} />
    </Page>
  );
}

export default VerifyRecoveryPhrase;
