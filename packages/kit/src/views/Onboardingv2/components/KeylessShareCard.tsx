import { useMemo } from 'react';

import { StyleSheet } from 'react-native';

import {
  AnimatePresence,
  Button,
  HeightTransition,
  Icon,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { EOnboardingV2KeylessWalletCreationMode } from '@onekeyhq/shared/src/routes/onboardingv2';

import {
  ECreationStepState,
  type IKeylessKeyStepCardProps,
} from './keylessOnboardingTypes';
import { SecurityKeyIcon } from './SecurityKeyIcon';

function StepStatusIcon(props: { state: ECreationStepState | undefined }) {
  const { state } = props;
  if (!state) {
    return null;
  }
  switch (state) {
    case ECreationStepState.InProgress:
      return (
        <Spinner
          key="spinner"
          size="small"
          animation="quick"
          enterStyle={{ scale: 0.7, opacity: 0 }}
          exitStyle={{ scale: 0.7, opacity: 0 }}
          scale={0.8}
        />
      );
    case ECreationStepState.Success:
      return (
        <YStack
          animation="quick"
          enterStyle={{ scale: 0.8, opacity: 0 }}
          exitStyle={{ scale: 0.8, opacity: 0 }}
          key="checkmark"
        >
          <Icon name="Checkmark2SmallOutline" color="$iconSuccess" size="$5" />
        </YStack>
      );
    case ECreationStepState.Error:
      return (
        <YStack
          animation="quick"
          enterStyle={{ scale: 0.8, opacity: 0 }}
          exitStyle={{ scale: 0.8, opacity: 0 }}
          key="error"
        >
          <Icon name="CrossedSmallOutline" color="$iconCritical" size="$5" />
        </YStack>
      );
    case ECreationStepState.Info:
      return (
        <YStack
          animation="quick"
          enterStyle={{ scale: 0.8, opacity: 0 }}
          exitStyle={{ scale: 0.8, opacity: 0 }}
          key="info"
        >
          <Icon
            name="CirclePlaceholderOnOutline"
            color="$iconSubdued"
            size="$4.5"
          />
        </YStack>
      );
    default:
      return null;
  }
}

function StepInfoMessage(props: {
  state: ECreationStepState | undefined;
  infoMessage?: string;
}) {
  const { state, infoMessage } = props;
  if (!infoMessage) {
    return null;
  }

  if (state === ECreationStepState.Error) {
    // Error state: show error styling and optional error message
    return (
      <SizableText
        size="$bodyMdMedium"
        color="$textCritical"
        textAlign="center"
      >
        {infoMessage ?? 'Operation failed'}
      </SizableText>
    );
  }

  // Info state: show info styling and info message
  return (
    <SizableText size="$bodyMdMedium" color="$textInfo" textAlign="center">
      {infoMessage}
    </SizableText>
  );
}

/**
 * Highlight background component for active steps.
 * Displays a subtle background highlight with shadow and blur effects
 * when the step is in an active state (InProgress, Info, or Error).
 * Provides visual feedback to indicate which step is currently being processed.
 */
function StepHighlightBackground(props: IKeylessKeyStepCardProps) {
  const {
    step: { state },
  } = props;
  const shouldShow =
    state !== ECreationStepState.Success && state !== ECreationStepState.Idle;

  return (
    <AnimatePresence>
      {shouldShow ? (
        <YStack
          animation="quick"
          animateOnly={['opacity', 'transform']}
          enterStyle={{
            opacity: 0,
            scale: 0.97,
            filter: 'blur(4px)',
          }}
          exitStyle={{
            opacity: 0,
            scale: 0.97,
            filter: 'blur(4px)',
          }}
          position="absolute"
          left={-10}
          top={-10}
          right={-10}
          bottom={-10}
          $gtMd={{
            left: -16,
            top: -16,
            right: -16,
            bottom: -16,
          }}
          bg="$bgSubdued"
          borderRadius="$4"
          borderCurve="continuous"
          $platform-web={{
            boxShadow:
              '0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          }}
          $theme-dark={{
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: '$neutral2',
          }}
          zIndex={0}
        />
      ) : null}
    </AnimatePresence>
  );
}

/**
 * Connector line component between step cards.
 * Renders a vertical dotted line connecting the current step to the next step,
 * creating a visual flow chain. Only displayed when this is not the last step.
 * The connector consists of multiple small circular dots arranged vertically.
 */
function StepConnector(props: IKeylessKeyStepCardProps) {
  const { isLastStep } = props;
  if (isLastStep) {
    return null;
  }

  return (
    <YStack
      w={2}
      position="absolute"
      left={31}
      top={64}
      bottom={-40}
      gap="$1"
      overflow="hidden"
    >
      {Array.from({ length: 20 }).map((_, i) => (
        <YStack key={i} w="100%" h="$1" bg="$neutral3" borderRadius="$full" />
      ))}
    </YStack>
  );
}

function StepIconContainer(props: IKeylessKeyStepCardProps) {
  const { securityKeyType, step } = props;
  const isIdle = step.state === ECreationStepState.Idle;

  return (
    <YStack
      w="$16"
      h="$16"
      borderRadius="$2"
      bg="$bg"
      borderCurve="continuous"
      $platform-web={{
        boxShadow:
          '0 1px 1px 0 rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 4px 6px 0 rgba(0, 0, 0, 0.04), 0 24px 68px 0 rgba(0, 0, 0, 0.05), 0 2px 3px 0 rgba(0, 0, 0, 0.04)',
      }}
      $theme-dark={{
        bg: '$whiteA1',
        borderWidth: 1,
        borderColor: '$neutral3',
      }}
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$neutral3',
      }}
      $platform-ios={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0.5 },
        shadowOpacity: 0.2,
        shadowRadius: 0.5,
      }}
      $platform-android={{ elevation: 0.5 }}
      alignItems="center"
      justifyContent="center"
      opacity={isIdle ? 0.5 : 1}
    >
      {securityKeyType ? (
        <SecurityKeyIcon type={securityKeyType} muted={isIdle} />
      ) : null}
      {!isIdle ? (
        <YStack
          position="absolute"
          right={-9}
          bottom={-9}
          w={26}
          h={26}
          borderWidth={1}
          bg="$bg"
          borderRadius="$full"
          borderColor="$borderSubdued"
          alignItems="center"
          justifyContent="center"
        >
          <AnimatePresence exitBeforeEnter initial={false}>
            <StepStatusIcon state={step.state} />
          </AnimatePresence>
        </YStack>
      ) : null}
    </YStack>
  );
}

function StepContent(props: IKeylessKeyStepCardProps) {
  const { title, description, step } = props;
  const isIdle = step.state === ECreationStepState.Idle;
  const shouldShowDescription =
    description &&
    (step.state === ECreationStepState.Info ||
      step.state === ECreationStepState.InProgress);

  return (
    <YStack gap="$1" flex={1} opacity={isIdle ? 0.5 : 1}>
      <SizableText size="$headingSm">{title}</SizableText>
      <HeightTransition initialHeight={0}>
        {shouldShowDescription ? (
          <SizableText color="$textDisabled">{description}</SizableText>
        ) : null}
      </HeightTransition>
    </YStack>
  );
}

function StepActions(props: IKeylessKeyStepCardProps) {
  const {
    mode,
    onStepAction,
    buttonText,
    onSecondaryAction,
    secondaryButtonText,
    step,
  } = props;

  const isStepLoading = step.state === ECreationStepState.InProgress;
  const isStepActionDisabled = useMemo(() => {
    if (mode === EOnboardingV2KeylessWalletCreationMode.View) {
      return isStepLoading;
    }
    return (
      step.state === ECreationStepState.Idle ||
      step.state === ECreationStepState.Success ||
      isStepLoading
    );
  }, [mode, step.state, isStepLoading]);
  const shouldShowActionButtons = useMemo(() => {
    if (mode === EOnboardingV2KeylessWalletCreationMode.View) {
      return true;
    }
    return (
      step.state !== ECreationStepState.Success &&
      step.state !== ECreationStepState.Idle
    );
  }, [mode, step.state]);

  return (
    <HeightTransition initialHeight={0}>
      <YStack
        gap="$2"
        mt="$4"
        pt="$4"
        pl="$12"
        borderWidth={0}
        borderTopWidth={StyleSheet.hairlineWidth}
        borderTopColor="$borderSubdued"
      >
        {shouldShowActionButtons ? (
          <YStack gap="$2">
            <Button
              variant="primary"
              onPress={onStepAction}
              loading={isStepLoading}
              disabled={isStepActionDisabled}
            >
              {buttonText}
            </Button>
            {onSecondaryAction && secondaryButtonText ? (
              <Button
                variant="secondary"
                onPress={onSecondaryAction}
                loading={isStepLoading}
                disabled={isStepActionDisabled}
              >
                {secondaryButtonText}
              </Button>
            ) : null}
          </YStack>
        ) : null}

        <StepInfoMessage state={step.state} infoMessage={step.infoMessage} />
      </YStack>
    </HeightTransition>
  );
}

export function KeylessShareCard(props: IKeylessKeyStepCardProps) {
  return (
    <YStack>
      {/* Decorative background highlight for active steps */}
      <StepHighlightBackground {...props} />
      {/* Vertical connector line to next step (hidden for last step) */}
      <StepConnector {...props} />

      {/* Main content: icon and text */}
      <XStack alignItems="center" gap="$5">
        <StepIconContainer {...props} />
        <StepContent {...props} />
      </XStack>

      {/* Actions: buttons and info or error message */}
      <StepActions {...props} />
    </YStack>
  );
}
