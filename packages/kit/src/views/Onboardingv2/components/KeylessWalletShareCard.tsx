import { useIntl } from 'react-intl';
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
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  ECreationStepState,
  type ICreationStep,
} from './keylessWalletOnboardingTypes';
import { SecurityKeyIcon } from './SecurityKeyIcon';

export interface IKeylessKeyStepCardProps {
  step: ICreationStep;
  index: number;
  isLastStep: boolean;
  onStepAction: () => void;
  buttonText: string;
  onSecondaryAction?: () => void;
  secondaryButtonText?: string;
}

function renderStepStatusIcon(state: ECreationStepState | undefined) {
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

export function KeylessWalletShareCard({
  step,
  index: _index,
  isLastStep,
  onStepAction,
  buttonText,
  onSecondaryAction,
  secondaryButtonText,
}: IKeylessKeyStepCardProps) {
  const intl = useIntl();

  return (
    <>
      <YStack>
        {/* Highlight background */}
        <AnimatePresence>
          {step.state !== ECreationStepState.Success &&
          step.state !== ECreationStepState.Idle ? (
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

        {/* Connected line between steps */}
        {!isLastStep ? (
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
              <YStack
                key={i}
                w="100%"
                h="$1"
                bg="$neutral3"
                borderRadius="$full"
              />
            ))}
          </YStack>
        ) : null}

        <XStack alignItems="center" gap="$5">
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
            opacity={step.state === ECreationStepState.Idle ? 0.5 : 1}
          >
            {step.securityKeyType ? (
              <SecurityKeyIcon
                type={step.securityKeyType}
                muted={step.state === ECreationStepState.Idle}
              />
            ) : null}
            {step.state !== ECreationStepState.Idle ? (
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
                  {renderStepStatusIcon(step.state)}
                </AnimatePresence>
              </YStack>
            ) : null}
          </YStack>
          <YStack
            gap="$1"
            flex={1}
            opacity={step.state === ECreationStepState.Idle ? 0.5 : 1}
          >
            <SizableText size="$headingSm">{step.title}</SizableText>
            <HeightTransition initialHeight={0}>
              {step.description &&
              (step.state === ECreationStepState.Info ||
                step.state === ECreationStepState.InProgress) ? (
                <SizableText color="$textDisabled">
                  {step.description}
                </SizableText>
              ) : null}
            </HeightTransition>
          </YStack>
        </XStack>

        <HeightTransition initialHeight={0}>
          {/* Info state - waiting for user action */}
          {step.state === ECreationStepState.Info ? (
            <YStack
              gap="$2"
              mt="$4"
              pt="$4"
              borderWidth={0}
              borderTopWidth={StyleSheet.hairlineWidth}
              borderTopColor="$borderSubdued"
            >
              {step.infoMessage ? (
                <SizableText
                  size="$bodyMdMedium"
                  color="$textInfo"
                  textAlign="left"
                >
                  {step.infoMessage}
                </SizableText>
              ) : null}
              <YStack gap="$2">
                <Button variant="primary" onPress={onStepAction} w="100%">
                  {buttonText}
                </Button>
                {onSecondaryAction && secondaryButtonText ? (
                  <Button
                    variant="secondary"
                    onPress={onSecondaryAction}
                    w="100%"
                  >
                    {secondaryButtonText}
                  </Button>
                ) : null}
              </YStack>
            </YStack>
          ) : null}

          {/* Error state */}
          {step.state === ECreationStepState.Error ? (
            <XStack
              gap="$2"
              mt="$4"
              pt="$4"
              borderWidth={0}
              borderTopWidth={StyleSheet.hairlineWidth}
              borderTopColor="$borderSubdued"
              alignItems="center"
            >
              <SizableText
                size="$bodyMdMedium"
                color="$textCritical"
                flex={1}
                textAlign="left"
              >
                {step.infoMessage ?? 'Operation failed'}
              </SizableText>
              <Button variant="primary" onPress={onStepAction}>
                {intl.formatMessage({
                  id: ETranslations.global_retry,
                })}
              </Button>
            </XStack>
          ) : null}
        </HeightTransition>
      </YStack>
    </>
  );
}
