import { useState } from 'react';

import {
  Button,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { OnboardingLayout } from '../components/OnboardingLayout';

export default function VerifyRecoveryPhrase() {
  // Track selected word index for each question (0-2 for 3 options)
  const [selectedWords, setSelectedWords] = useState<{
    [key: number]: number | null;
  }>({
    0: null,
    1: null,
    2: null,
  });

  const handleWordSelect = (questionIndex: number, wordIndex: number) => {
    setSelectedWords((prev) => ({
      ...prev,
      [questionIndex]: wordIndex,
    }));
  };

  const questions = [
    {
      position: 9,
      options: ['word1', 'word2', 'word3'],
    },
    {
      position: 12,
      options: ['word4', 'word5', 'word6'],
    },
    {
      position: 3,
      options: ['word7', 'word8', 'word9'],
    },
  ];

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header title="Verify your recovery phrase" />
        <OnboardingLayout.Body>
          {questions.map((question, questionIndex) => (
            <YStack key={questionIndex} gap="$2">
              <SizableText size="$bodyMd">
                Word #{question.position}
              </SizableText>
              <XStack gap="$2">
                {question.options.map((word, wordIndex) => (
                  <Button
                    key={wordIndex}
                    size="large"
                    flex={1}
                    variant={
                      selectedWords[questionIndex] === wordIndex
                        ? 'primary'
                        : 'secondary'
                    }
                    onPress={() => handleWordSelect(questionIndex, wordIndex)}
                  >
                    {word}
                  </Button>
                ))}
              </XStack>
            </YStack>
          ))}
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}
