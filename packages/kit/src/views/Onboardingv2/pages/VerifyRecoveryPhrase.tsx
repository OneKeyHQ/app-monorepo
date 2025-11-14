import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import bip39Wordlists from 'bip39/src/wordlists/english.json';
import { shuffle } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Page,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  ensureSensitiveTextEncoded,
  generateMnemonic,
} from '@onekeyhq/core/src/secret';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EOnboardingPagesV2,
  IOnboardingParamListV2,
} from '@onekeyhq/shared/src/routes/onboardingv2';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { OnboardingLayout } from '../components/OnboardingLayout';
import { shuffleWordsIndices } from '../utils';

import type { RouteProp } from '@react-navigation/core';

export default function VerifyRecoveryPhrase() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<IOnboardingParamListV2, EOnboardingPagesV2.VerifyRecoveryPhrase>
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
  }, [route.params?.mnemonic]);
  const recoveryPhrase = useMemo(
    () => mnemonic.split(' ').filter(Boolean),
    [mnemonic],
  );

  const answerIndices = useMemo(() => {
    if (recoveryPhrase.length === 0) return [];
    return shuffleWordsIndices(recoveryPhrase.length);
  }, [recoveryPhrase]);

  const [selectedWords, setSelectedWords] = useState<{
    [key: number]: string | null;
  }>({
    0: null,
    1: null,
    2: null,
  });

  const shuffleWords = useMemo(() => {
    const answerWords = answerIndices.map((index) => recoveryPhrase[index]);
    const confuseWords: string[] = [];
    const getRandomWord = (): string => {
      const randomIndex = Math.floor(Math.random() * bip39Wordlists.length);
      const word = bip39Wordlists[randomIndex];

      if (answerWords.includes(word) || confuseWords.includes(word)) {
        return getRandomWord();
      }

      return word;
    };

    for (let i = 0; i < 6; i += 1) {
      confuseWords.push(getRandomWord());
    }
    return answerWords.map((word, index) => {
      return {
        words: shuffle([word, ...confuseWords.slice(index * 2, index * 2 + 2)]),
        index: answerIndices[index],
      };
    });
  }, [answerIndices, recoveryPhrase]);

  const handleWordSelect = useCallback(
    (questionIndex: number, word: string) => {
      const newSelectedWords = { ...selectedWords };
      newSelectedWords[questionIndex] = word;
      setSelectedWords(newSelectedWords);

      setTimeout(async () => {
        if (Object.values(newSelectedWords).every((w) => w !== null)) {
          const verifyResult = answerIndices.every(
            (recoveryPhraseIndex, index) => {
              if (newSelectedWords[index] === null) {
                return false;
              }
              return (
                newSelectedWords[index] === recoveryPhrase[recoveryPhraseIndex]
              );
            },
          );

          if (verifyResult) {
            if (route.params?.walletId) {
              await backgroundApiProxy.serviceAccount.updateWalletBackupStatus({
                walletId: route.params?.walletId,
                isBackedUp: true,
              });
            }
            Toast.success({
              title: intl.formatMessage({
                id: ETranslations.backup_recovery_phrase_backed_up,
              }),
            });
            navigation.popStack();
          } else {
            setSelectedWords({
              0: null,
              1: null,
              2: null,
            });
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.feedback_passphrase_not_matched,
              }),
            });
          }
        }
      });
    },
    [
      answerIndices,
      intl,
      navigation,
      recoveryPhrase,
      route.params?.walletId,
      selectedWords,
    ],
  );

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header
          title={intl.formatMessage({
            id: ETranslations.onboarding_verify_recovery_phrase_title,
          })}
        />
        <OnboardingLayout.Body>
          {shuffleWords.map((question, questionIndex) => (
            <YStack key={questionIndex} gap="$2">
              <SizableText size="$bodyMd">
                Word #{question.index + 1}
              </SizableText>
              <XStack
                gap="$2"
                justifyContent="space-evenly"
                alignItems="center"
              >
                {question.words.map((word, wordIndex) => (
                  <XStack key={wordIndex} flex={1}>
                    <Button
                      key={wordIndex}
                      size="large"
                      width="100%"
                      variant={
                        selectedWords[questionIndex] === word
                          ? 'primary'
                          : 'secondary'
                      }
                      onPress={() => handleWordSelect(questionIndex, word)}
                    >
                      {word}
                    </Button>
                  </XStack>
                ))}
              </XStack>
            </YStack>
          ))}
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}
