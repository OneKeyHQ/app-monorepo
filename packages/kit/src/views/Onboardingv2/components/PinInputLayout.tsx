import { useCallback, useMemo, useRef } from 'react';

import { useFocusEffect } from '@react-navigation/core';
import { type TextInput } from 'react-native';

import {
  Button,
  HeightTransition,
  Input,
  Keyboard,
  Page,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OnboardingLayout } from './OnboardingLayout';

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
  placeholder?: string;
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
  placeholder = '••••',
}: IPinInputLayoutProps) {
  const inputRef = useRef<TextInput>(null);
  const { gtMd } = useMedia();

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(
        () => {
          inputRef.current?.focus();
        },
        platformEnv.isNative ? 500 : 300,
      );
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
                    placeholder={placeholder}
                    textAlign="center"
                    fontSize={platformEnv.isNative ? 20 : 24}
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
              {gtMd ? (
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
              ) : null}
            </YStack>
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
        {!gtMd ? (
          <Keyboard.StickyView>
            <OnboardingLayout.Footer>
              <YStack gap="$2" w="100%" y={platformEnv.isNative ? '$5' : '$0'}>
                <Button
                  size="large"
                  variant={isSubmitDisabled ? 'secondary' : 'primary'}
                  onPress={onSubmit}
                  disabled={isSubmitDisabled}
                >
                  {buttonText}
                </Button>
                {secondaryButtonText && onSecondaryButtonPress ? (
                  <Button
                    m="$0"
                    py="$3"
                    size="large"
                    variant="tertiary"
                    onPress={onSecondaryButtonPress}
                  >
                    {secondaryButtonText}
                  </Button>
                ) : null}
              </YStack>
            </OnboardingLayout.Footer>
          </Keyboard.StickyView>
        ) : null}
      </OnboardingLayout>
    </Page>
  );
}

export { PinInputLayout };
