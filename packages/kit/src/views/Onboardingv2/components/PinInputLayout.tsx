import { useCallback, useRef } from 'react';

import { useFocusEffect } from '@react-navigation/core';

import {
  Button,
  HeightTransition,
  Input,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { OnboardingLayout } from './OnboardingLayout';

import type { TextInput } from 'react-native';

interface IPinInputLayoutProps {
  title: string;
  description?: string | React.ReactNode;
  descriptionColor?: '$textSubdued' | '$textCaution';
  buttonText: string;
  secondaryButtonText?: string;
  onSecondaryButtonPress?: () => void;
  value: string;
  onChange: (pin: string) => void;
  onSubmit: () => void;
  isSubmitDisabled?: boolean;
  isInputDisabled?: boolean;
  errorMessage?: string;
}

function PinInputLayout({
  title,
  description,
  descriptionColor = '$textSubdued',
  buttonText,
  secondaryButtonText,
  onSecondaryButtonPress,
  value,
  onChange,
  onSubmit,
  isSubmitDisabled = false,
  isInputDisabled = false,
  errorMessage,
}: IPinInputLayoutProps) {
  const inputRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }, []),
  );

  const handleChangeText = useCallback(
    (text: string) => {
      onChange(text.replace(/[^0-9]/g, ''));
    },
    [onChange],
  );

  const handleSubmitEditing = useCallback(() => {
    if (!isSubmitDisabled) {
      onSubmit();
    }
  }, [isSubmitDisabled, onSubmit]);

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header />
        <OnboardingLayout.Body constrained={false} scrollable={false}>
          <OnboardingLayout.ConstrainedContent gap="$10">
            <YStack gap="$2">
              <SizableText size="$heading2xl">{title}</SizableText>
              <SizableText size="$bodyLg" color={descriptionColor}>
                {description}
              </SizableText>
            </YStack>

            <YStack gap="$6">
              <HeightTransition initialHeight={50}>
                <YStack gap="$2">
                  <Input
                    ref={inputRef}
                    size="large"
                    placeholder="••••"
                    textAlign="center"
                    fontSize={24}
                    h={50}
                    maxLength={4}
                    keyboardType="number-pad"
                    secureTextEntry
                    value={value}
                    error={!!errorMessage}
                    disabled={isInputDisabled}
                    onChangeText={handleChangeText}
                    onSubmitEditing={handleSubmitEditing}
                  />
                  {errorMessage ? (
                    <SizableText size="$bodySm" color="$textCritical">
                      {errorMessage}
                    </SizableText>
                  ) : null}
                </YStack>
              </HeightTransition>
              <XStack gap="$2">
                {secondaryButtonText && onSecondaryButtonPress ? (
                  <Button
                    size="large"
                    variant="secondary"
                    flexGrow={1}
                    flexBasis={0}
                    onPress={onSecondaryButtonPress}
                  >
                    {secondaryButtonText}
                  </Button>
                ) : null}
                <Button
                  size="large"
                  variant={isSubmitDisabled ? 'secondary' : 'primary'}
                  flexGrow={1}
                  flexBasis={0}
                  onPress={onSubmit}
                  disabled={isSubmitDisabled}
                >
                  {buttonText}
                </Button>
              </XStack>
            </YStack>
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}

export { PinInputLayout };
