import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IKeyOfIcons, IPageScreenProps } from '@onekeyhq/components';
import {
  AnimatePresence,
  Button,
  HeightTransition,
  Icon,
  Page,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes/onboardingv2';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { OnboardingLayout } from '../components/OnboardingLayout';

enum ECreationStepState {
  Idle = 'idle',
  InProgress = 'inProgress',
  Info = 'info',
  Success = 'success',
  Error = 'error',
}

enum ECreationStepId {
  DeviceShare = 'device-share',
  CloudShare = 'cloud-share',
  AuthShare = 'auth-share',
}

interface ICreationStep {
  id: ECreationStepId;
  icon: IKeyOfIcons;
  title: string;
  description?: string;
  state: ECreationStepState;
  infoMessage?: string;
}

// ============ STEP CONFIGURATION ============
// Platform-specific cloud provider name
const cloudProviderName =
  platformEnv.isNativeIOS || platformEnv.isMas ? 'iCloud' : 'Google Drive';

// Centralized text configuration for all steps
const STEP_CONFIG: Record<
  ECreationStepId,
  {
    icon: IKeyOfIcons;
    title: string;
    description: string;
    infoMessage: string;
    buttonText: string;
  }
> = {
  [ECreationStepId.DeviceShare]: {
    icon: 'Key2Solid',
    title: 'Device Key',
    description: 'Encrypted with your passcode and stored on this device.',
    infoMessage: 'Tap to save the key to your device',
    buttonText: 'Save to Device',
  },
  [ECreationStepId.CloudShare]: {
    icon: 'CloudSolid',
    title: 'Cloud Key',
    description: `Encrypted backup to ${cloudProviderName}`,
    infoMessage: `Tap to backup the key to ${cloudProviderName}`,
    buttonText: `Backup to ${cloudProviderName}`,
  },
  [ECreationStepId.AuthShare]: {
    icon: 'EmailSolid',
    title: 'Auth Key',
    description: 'Protected by your OneKey ID',
    infoMessage: 'Tap to save the key to OneKey server',
    buttonText: 'Save to Server',
  },
};
// ============================================

export function KeylessWalletCreation({
  route: _route,
}: IPageScreenProps<
  IOnboardingParamListV2,
  EOnboardingPagesV2.KeylessWalletCreation
>) {
  const intl = useIntl();
  const navigation = useAppNavigation();

  // Helper to create a step from config
  const createStep = useCallback(
    (id: ECreationStepId, state: ECreationStepState): ICreationStep => ({
      id,
      icon: STEP_CONFIG[id].icon,
      title: STEP_CONFIG[id].title,
      description: STEP_CONFIG[id].description,
      state,
      infoMessage:
        state === ECreationStepState.Info
          ? STEP_CONFIG[id].infoMessage
          : undefined,
    }),
    [],
  );

  // Build initial steps - all start in Idle state except first one
  const buildInitialSteps = useCallback((): ICreationStep[] => {
    return [
      createStep(ECreationStepId.DeviceShare, ECreationStepState.Info), // First step starts with Info state
      createStep(ECreationStepId.CloudShare, ECreationStepState.Idle),
      createStep(ECreationStepId.AuthShare, ECreationStepState.Idle),
    ];
  }, [createStep]);

  const [steps, setSteps] = useState<ICreationStep[]>(buildInitialSteps);
  const [successCount, setSuccessCount] = useState(0);

  // Check if all steps are complete
  const isCreationComplete = successCount >= 3;

  // Get visible steps (all steps are always visible in creation flow)
  const visibleSteps = useMemo(() => steps, [steps]);

  // Helper: Update step state
  const updateStepState = useCallback(
    (
      stepId: ECreationStepId,
      newState: ECreationStepState,
      infoMessage?: string,
    ) => {
      setSteps((prev) => {
        const newSteps = [...prev];
        const stepIndex = newSteps.findIndex((s) => s.id === stepId);
        if (stepIndex !== -1) {
          const wasSuccess =
            newSteps[stepIndex].state === ECreationStepState.Success;
          const isSuccess = newState === ECreationStepState.Success;

          newSteps[stepIndex] = {
            ...newSteps[stepIndex],
            state: newState,
            infoMessage:
              newState === ECreationStepState.Info
                ? infoMessage ?? STEP_CONFIG[stepId].infoMessage
                : undefined,
          };

          // Update success count
          if (!wasSuccess && isSuccess) {
            setSuccessCount((c) => c + 1);
          } else if (wasSuccess && !isSuccess) {
            setSuccessCount((c) => Math.max(0, c - 1));
          }
        }
        return newSteps;
      });
    },
    [],
  );

  // Helper: Move to next step
  const moveToNextStep = useCallback(
    (completedStepId: ECreationStepId) => {
      const stepOrder = [
        ECreationStepId.DeviceShare,
        ECreationStepId.CloudShare,
        ECreationStepId.AuthShare,
      ];
      const currentIndex = stepOrder.indexOf(completedStepId);
      if (currentIndex < stepOrder.length - 1) {
        const nextStepId = stepOrder[currentIndex + 1];
        updateStepState(nextStepId, ECreationStepState.Info);
      }
    },
    [updateStepState],
  );

  // Step 1: Save Device Share
  const handleDeviceShareSave = useCallback(async () => {
    updateStepState(ECreationStepId.DeviceShare, ECreationStepState.InProgress);

    try {
      // Prompt user for biometric/passcode verification to save device share
      await backgroundApiProxy.servicePassword.promptPasswordVerify();

      // TODO: Implement actual device share save logic
      // Simulate save delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      updateStepState(ECreationStepId.DeviceShare, ECreationStepState.Success);
      moveToNextStep(ECreationStepId.DeviceShare);
    } catch {
      // User cancelled or verification failed
      updateStepState(
        ECreationStepId.DeviceShare,
        ECreationStepState.Info,
        'Device key not saved. Tap to try again.',
      );
    }
  }, [updateStepState, moveToNextStep]);

  // Step 2: Save Cloud Share
  const handleCloudShareSave = useCallback(async () => {
    updateStepState(ECreationStepId.CloudShare, ECreationStepState.InProgress);

    try {
      // TODO: Implement actual cloud share save logic
      // Simulate cloud backup delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      updateStepState(ECreationStepId.CloudShare, ECreationStepState.Success);
      moveToNextStep(ECreationStepId.CloudShare);
    } catch {
      updateStepState(
        ECreationStepId.CloudShare,
        ECreationStepState.Info,
        'Cloud backup failed. Tap to try again.',
      );
    }
  }, [updateStepState, moveToNextStep]);

  // Step 3: Save Auth Share
  const handleAuthShareSave = useCallback(async () => {
    updateStepState(ECreationStepId.AuthShare, ECreationStepState.InProgress);

    try {
      // TODO: Implement actual auth share save logic
      // Simulate server save delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      updateStepState(ECreationStepId.AuthShare, ECreationStepState.Success);
    } catch {
      updateStepState(
        ECreationStepId.AuthShare,
        ECreationStepState.Info,
        'Server save failed. Tap to try again.',
      );
    }
  }, [updateStepState]);

  // Handle step action based on step type
  const handleStepAction = useCallback(
    (stepId: ECreationStepId) => {
      if (stepId === ECreationStepId.DeviceShare) {
        void handleDeviceShareSave();
      } else if (stepId === ECreationStepId.CloudShare) {
        void handleCloudShareSave();
      } else if (stepId === ECreationStepId.AuthShare) {
        void handleAuthShareSave();
      }
    },
    [handleDeviceShareSave, handleCloudShareSave, handleAuthShareSave],
  );

  // Get button text from config
  const getButtonText = useCallback(
    (stepId: ECreationStepId) => STEP_CONFIG[stepId]?.buttonText ?? 'Continue',
    [],
  );

  // Handle "Complete Setup" button
  const handleCompleteSetup = useCallback(() => {
    navigation.push(EOnboardingPagesV2.FinalizeWalletSetup, {});
  }, [navigation]);

  // Reset steps when component mounts
  useEffect(() => {
    setSteps(buildInitialSteps());
  }, [buildInitialSteps]);

  const renderStepStatusIcon = useCallback((state: ECreationStepState) => {
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
            <Icon
              name="Checkmark2SmallOutline"
              color="$iconSuccess"
              size="$5"
            />
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
            <Icon name="InfoCircleOutline" color="$iconInfo" size="$5" />
          </YStack>
        );
      default:
        return null;
    }
  }, []);

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header title="Secure your wallet" />
        <OnboardingLayout.Body constrained={false}>
          <OnboardingLayout.ConstrainedContent
            gap="$10"
            $platform-native={{
              py: '$5',
            }}
          >
            <YStack gap="$2">
              <SizableText color="$textSubdued">
                Your Keyless Wallet is secured with{' '}
                <SizableText color="$text" size="$bodyMdMedium">
                  3 security keys
                </SizableText>
                . Complete all steps below to finish setup.
              </SizableText>
            </YStack>

            {visibleSteps.map((step, index) => (
              <Fragment key={step.id}>
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
                  {index < visibleSteps.length - 1 ? (
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
                      <Icon name={step.icon} size="$6" color="$iconActive" />
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
                      {step.description ? (
                        <SizableText color="$textSubdued">
                          {step.description}
                        </SizableText>
                      ) : null}
                    </YStack>
                  </XStack>

                  <HeightTransition initialHeight={0}>
                    {/* Info state - waiting for user action */}
                    {step.state === ECreationStepState.Info ? (
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
                          color="$textInfo"
                          flex={1}
                          textAlign="left"
                        >
                          {step.infoMessage}
                        </SizableText>
                        <Button
                          variant="primary"
                          onPress={() => handleStepAction(step.id)}
                        >
                          {getButtonText(step.id)}
                        </Button>
                      </XStack>
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
                        <Button
                          variant="primary"
                          onPress={() => handleStepAction(step.id)}
                        >
                          {intl.formatMessage({
                            id: ETranslations.global_retry,
                          })}
                        </Button>
                      </XStack>
                    ) : null}
                  </HeightTransition>
                </YStack>
              </Fragment>
            ))}
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
        <OnboardingLayout.Footer>
          <AnimatePresence initial={false} exitBeforeEnter>
            {!isCreationComplete ? (
              <Button
                key="progress-button"
                variant="secondary"
                size="large"
                disabled
                w="100%"
                maxWidth={400}
                animation="quick"
                animateOnly={['opacity', 'transform']}
                enterStyle={{
                  opacity: 0,
                  y: -16,
                  filter: 'blur(4px)',
                }}
                exitStyle={{
                  opacity: 0,
                  y: -16,
                  filter: 'blur(4px)',
                }}
              >
                Setup Progress ({successCount}/3)
              </Button>
            ) : (
              <Button
                key="complete-button"
                variant="primary"
                size="large"
                onPress={handleCompleteSetup}
                w="100%"
                maxWidth={400}
                animation="quick"
                animateOnly={['opacity', 'transform']}
                enterStyle={{
                  opacity: 0,
                  y: 16,
                  filter: 'blur(4px)',
                }}
                exitStyle={{
                  opacity: 0,
                  y: 16,
                  filter: 'blur(4px)',
                }}
              >
                Complete Setup
              </Button>
            )}
          </AnimatePresence>
        </OnboardingLayout.Footer>
      </OnboardingLayout>
    </Page>
  );
}

export default KeylessWalletCreation;
