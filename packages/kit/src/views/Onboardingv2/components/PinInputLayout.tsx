import type {
  ComponentProps,
  ForwardRefExoticComponent,
  RefAttributes,
} from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import { useFocusEffect } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Button,
  HeightTransition,
  Keyboard,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { KEYLESS_PIN_LENGTH } from '@onekeyhq/shared/src/keylessWallet/keylessWalletConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MultipleClickStack } from '../../../components/MultipleClickStack';
import PassCodeInput from '../../../components/Password/components/PassCodeInput';
import { KeylessOnboardingDebugPanel } from '../pages/KeylessOnboardingDebugPanel';

import {
  OnboardingIconBadge,
  OnboardingPage,
  OnboardingSidebar,
} from './Layout';

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
  isLoading?: boolean;
  onClose?: () => Promise<void>;
  onUnmounted?: () => void;
  onEnableInput?: () => void;
  isVerifyPinPage?: boolean;
  onAutoInputPin?: () => void;
  showInputSkeleton?: boolean;
  testID?: string;
  inputTestID?: string;
  // Spells out that this PIN restores the wallet, for the layouts that have no
  // room for the explainer sidebar. The App unlock passcode states its own
  // purpose on its setup page.
  showRecoveryRoleHint?: boolean;
}

export interface IPinInputLayoutRef {
  focus: () => void;
}

// Height of the dot field, which carries its own vertical padding.
const inputHeight = 80;

const PinInputLayout = forwardRef<IPinInputLayoutRef, IPinInputLayoutProps>(
  (
    {
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
      isLoading,
      onClose,
      onUnmounted,
      onEnableInput,
      isVerifyPinPage,
      onAutoInputPin,
      showInputSkeleton = false,
      testID,
      inputTestID,
      showRecoveryRoleHint = false,
    },
    ref,
  ) => {
    const intl = useIntl();
    const passCodeInputRef = useRef<{ focus: () => void } | null>(null);
    const { gtMd } = useMedia();
    const hasSecondaryAction = Boolean(
      secondaryButtonText && onSecondaryButtonPress,
    );
    // Only a pair of buttons can overflow; a lone submit button keeps the row.
    const stackButtons = hasSecondaryAction && !gtMd;
    const buttonWidthProps = stackButtons
      ? ({ width: '100%' } as const)
      : ({ flexGrow: 1, flexBasis: 0 } as const);
    const prevShowInputSkeletonRef = useRef(showInputSkeleton);

    const focusInput = useCallback(() => {
      passCodeInputRef.current?.focus();
    }, []);

    useImperativeHandle(ref, () => ({
      focus: focusInput,
    }));

    useFocusEffect(
      useCallback(() => {
        // Skip auto-focus if skeleton is showing
        if (showInputSkeleton) {
          return;
        }
        const timer = setTimeout(focusInput, platformEnv.isNative ? 500 : 300);
        return () => clearTimeout(timer);
      }, [focusInput, showInputSkeleton]),
    );

    // Focus when skeleton transitions from shown to hidden
    useEffect(() => {
      if (prevShowInputSkeletonRef.current && !showInputSkeleton) {
        const timer = setTimeout(focusInput, platformEnv.isNative ? 100 : 50);
        return () => clearTimeout(timer);
      }
      prevShowInputSkeletonRef.current = showInputSkeleton;
    }, [focusInput, showInputSkeleton]);

    const handleChangeText = useCallback(
      (text: string) => {
        onChange(text.replace(/[^0-9]/g, ''));
      },
      [onChange],
    );

    const handleSubmitEditing = useCallback(() => {
      // Match the submit button gate so double-Enter cannot fire a second
      // submission while one is already in flight.
      if (!isSubmitDisabled && !isLoading) {
        onSubmit();
      }
    }, [isSubmitDisabled, isLoading, onSubmit]);

    const submitButtonProps = useMemo<ComponentProps<typeof Button>>(
      () => ({
        onPress: onSubmit,
        loading: isLoading,
        disabled: isSubmitDisabled || isLoading,
      }),
      [isSubmitDisabled, isLoading, onSubmit],
    );

    const renderInput = () => {
      if (showInputSkeleton) {
        return <Skeleton h={inputHeight} w="100%" radius={12} />;
      }
      // One dot cell per digit, on every platform: a single long box hides how
      // many digits the PIN has, which is the confusion this screen is fixing.
      return (
        <YStack h={inputHeight} justifyContent="center">
          <PassCodeInput
            ref={passCodeInputRef}
            testId={inputTestID}
            cellCount={KEYLESS_PIN_LENGTH}
            cellSize={gtMd ? 24 : 16}
            value={value}
            editable={!isInputDisabled}
            onPinCodeChange={handleChangeText}
            onSubmitEditing={handleSubmitEditing}
          />
        </YStack>
      );
    };

    const secondaryButton = hasSecondaryAction ? (
      <Button
        testID="onboardingv2-btn"
        size="large"
        variant="secondary"
        {...buttonWidthProps}
        onPress={onSecondaryButtonPress}
      >
        {secondaryButtonText}
      </Button>
    ) : null;

    const submitButton = (
      <Button
        testID="onboardingv2-btn"
        size="large"
        variant={isSubmitDisabled ? 'secondary' : 'primary'}
        {...buttonWidthProps}
        {...submitButtonProps}
      >
        {buttonText}
      </Button>
    );

    return (
      <OnboardingPage
        testID={testID}
        onUnmounted={onUnmounted}
        onClose={() => {
          void onClose?.();
        }}
        contentContainerProps={{
          $gtMd: { minHeight: 600, flexDirection: 'row' },
        }}
      >
        <YStack
          w="100%"
          $md={{
            flex: 1,
          }}
          $gtMd={{
            flexDirection: 'row',
            alignSelf: 'flex-start',
          }}
        >
          <YStack flex={1}>
            <YStack gap="$2" mb="$5" $gtMd={{ mb: '$12' }}>
              <SizableText size="$heading4xl">{title}</SizableText>
              {!gtMd && showRecoveryRoleHint ? (
                <SizableText size="$bodyLg" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.create_pin_recovery_role__desc,
                  })}
                </SizableText>
              ) : null}
              <MultipleClickStack onPress={onEnableInput}>
                <SizableText size="$bodyLg" color={descriptionColor}>
                  {description}
                </SizableText>
              </MultipleClickStack>
            </YStack>

            <YStack
              mb="$6"
              $md={{
                flex: 1,
              }}
            >
              {/* Input Form */}
              <HeightTransition initialHeight={inputHeight}>
                <YStack gap="$2">
                  {renderInput()}
                  {errorMessage ? (
                    <SizableText size="$bodySm" color="$textCritical">
                      {errorMessage}
                    </SizableText>
                  ) : null}
                </YStack>
              </HeightTransition>

              <KeylessOnboardingDebugPanel
                isVerifyPinPage={isVerifyPinPage}
                onAutoInputPin={onAutoInputPin}
                onForceEnableInput={onEnableInput}
              />
            </YStack>

            {/* Submit Button */}
            <Keyboard.StickyView>
              <XStack
                gap="$2"
                // Half-width buttons cannot hold a long secondary label and its
                // translations on a phone, so the pair stacks instead of
                // wrapping. Stacked, the primary action goes on top; the two
                // orders below keep focus and reading order matching that.
                flexDirection={stackButtons ? 'column' : 'row'}
                $md={{
                  pb: '$5',
                }}
              >
                {stackButtons ? (
                  <>
                    {submitButton}
                    {secondaryButton}
                  </>
                ) : (
                  <>
                    {secondaryButton}
                    {submitButton}
                  </>
                )}
              </XStack>
            </Keyboard.StickyView>
          </YStack>
          {gtMd ? (
            <OnboardingSidebar>
              <OnboardingIconBadge icon="InfoSimpleSolid" />
              <YStack gap="$4">
                <SizableText size="$bodyLg">
                  {intl.formatMessage({
                    id: ETranslations.create_pin_recovery_role__desc,
                  })}
                </SizableText>
                <SizableText size="$bodyLg">
                  {intl.formatMessage({
                    id: ETranslations.create_pin_dual_factor__desc,
                  })}
                </SizableText>
                <SizableText size="$bodyLg">
                  {intl.formatMessage({
                    id: ETranslations.create_pin_keep_safe__desc,
                  })}
                </SizableText>
              </YStack>
            </OnboardingSidebar>
          ) : null}
        </YStack>
      </OnboardingPage>
    );
  },
);

PinInputLayout.displayName = 'PinInputLayout';

export { PinInputLayout };
export type IPinInputLayoutComponent = ForwardRefExoticComponent<
  IPinInputLayoutProps & RefAttributes<IPinInputLayoutRef>
>;
