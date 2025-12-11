import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IKeyOfIcons, IPageScreenProps } from '@onekeyhq/components';
import {
  AnimatePresence,
  Badge,
  Button,
  Dialog,
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
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { EPrimeTransferDataType } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { showOneKeyIDLoginDialog } from '../../Prime/components/OneKeyIDLoginDialog';
import { OnboardingLayout } from '../components/OnboardingLayout';
import {
  type ISecurityKeyType,
  SecurityKeyIcon,
} from '../components/SecurityKeyIcon';

enum ERecoveryStepState {
  Idle = 'idle',
  InProgress = 'inProgress',
  Info = 'info',
  Success = 'success',
  Error = 'error',
}

enum ERecoveryStepId {
  AuthShare = 'auth-share',
  DeviceShare = 'device-share',
  CloudShare = 'cloud-share',
  QRMigration = 'qr-migration',
}

enum ERecoveryFlow {
  AuthPlusDevice = 'auth-device', // Device share on this device
  AuthPlusCloud = 'auth-cloud', // Device share not here, cloud accessible
  AuthPlusTransfer = 'auth-transfer', // Device share not here, no cloud access
}

interface IRecoveryStep {
  id: ERecoveryStepId;
  icon: IKeyOfIcons;
  securityKeyType: ISecurityKeyType;
  title: string;
  description?: string;
  state: ERecoveryStepState;
  infoMessage?: string;
}

// ============ STEP CONFIGURATION ============
// Platform-specific cloud provider name
const cloudProviderName =
  platformEnv.isNativeIOS || platformEnv.isMas ? 'iCloud' : 'Google Drive';

// Centralized text configuration for all steps
const STEP_CONFIG: Record<
  ERecoveryStepId,
  {
    icon: IKeyOfIcons;
    securityKeyType: ISecurityKeyType;
    title: string;
    description: string;
    infoMessage?: string;
    buttonText: string;
  }
> = {
  [ERecoveryStepId.AuthShare]: {
    icon: 'EmailOutline',
    securityKeyType: 'auth',
    title: 'Auth Key',
    description: 'Linked to your OneKey ID',
    buttonText: 'Verify via email',
  },
  [ERecoveryStepId.DeviceShare]: {
    icon: 'PasswordOutline',
    securityKeyType: 'device',
    title: 'Device Key',
    description: 'Stored securely on this device',
    buttonText: 'Unlock with passcode',
  },
  [ERecoveryStepId.CloudShare]: {
    icon: 'CloudOutline',
    securityKeyType: 'cloud',
    title: 'Cloud Key',
    description: `Backed up to ${cloudProviderName}`,
    buttonText: `Get from ${cloudProviderName}`,
  },
  [ERecoveryStepId.QRMigration]: {
    icon: 'MultipleDevicesOutline',
    securityKeyType: 'device',
    title: 'Device Transfer',
    description: 'Scan QR from another device',
    buttonText: 'Start Transfer',
  },
};
// ============================================

export default function KeylessWalletRecovery({
  route,
}: IPageScreenProps<
  IOnboardingParamListV2,
  EOnboardingPagesV2.KeylessWalletRecovery
>) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const email = route.params?.email ?? '';

  // ============ MOCK CONTROLS FOR TESTING ============
  // TODO: @zuo Remove these mock controls before production
  const MOCK_MODE = true; // Set to false to use real verification
  const [mockFlow, setMockFlow] = useState<ERecoveryFlow>(
    ERecoveryFlow.AuthPlusDevice,
  );

  // Derived values from flow
  const hasLocalDeviceShare = mockFlow === ERecoveryFlow.AuthPlusDevice;
  const isCloudAccessible = mockFlow === ERecoveryFlow.AuthPlusCloud;
  // ====================================================

  // Helper to create a step from config
  const createStep = useCallback(
    (id: ERecoveryStepId): IRecoveryStep => ({
      id,
      icon: STEP_CONFIG[id].icon,
      securityKeyType: STEP_CONFIG[id].securityKeyType,
      title: STEP_CONFIG[id].title,
      description: STEP_CONFIG[id].description,
      state: ERecoveryStepState.Idle,
    }),
    [],
  );

  // Build steps dynamically based on conditions
  const buildInitialSteps = useCallback((): IRecoveryStep[] => {
    // Auth Share is always required, starts in Info state for manual trigger
    const authStep = createStep(ERecoveryStepId.AuthShare);
    authStep.state = ERecoveryStepState.Info;
    const initialSteps: IRecoveryStep[] = [authStep];

    if (hasLocalDeviceShare) {
      // Device has local Device Share, add it as second step
      initialSteps.push(createStep(ERecoveryStepId.DeviceShare));
    } else if (isCloudAccessible) {
      // No local Device Share, but cloud is accessible
      initialSteps.push(createStep(ERecoveryStepId.CloudShare));
    } else {
      // No local Device Share and cloud not accessible, use QR migration
      initialSteps.push(createStep(ERecoveryStepId.QRMigration));
    }

    return initialSteps;
  }, [hasLocalDeviceShare, isCloudAccessible, createStep]);

  const [steps, setSteps] = useState<IRecoveryStep[]>(buildInitialSteps);

  const [successCount, setSuccessCount] = useState(0);

  // Track if fallback options have been shown
  const [fallbacksRevealed, setFallbacksRevealed] = useState(false);

  // Check if recovery is complete (2 shares obtained = Auth + one other)
  const isRecoveryComplete = successCount >= 2;

  // Filter visible steps - hide remaining steps after 2 successes
  const visibleSteps = useMemo(() => {
    if (isRecoveryComplete) {
      return steps.filter((step) => step.state === ERecoveryStepState.Success);
    }
    return steps;
  }, [steps, isRecoveryComplete]);

  // Get the second step type for conditional logic
  const _secondStepId = steps[1]?.id;

  // Get available fallback options based on current flow
  const getAvailableFallbacks = useCallback(() => {
    const currentSecondStepId = steps[1]?.id;
    const fallbacks: ERecoveryStepId[] = [];

    // Only add fallbacks that are not already the current step
    if (
      hasLocalDeviceShare &&
      currentSecondStepId !== ERecoveryStepId.DeviceShare
    ) {
      fallbacks.push(ERecoveryStepId.DeviceShare);
    }
    if (
      isCloudAccessible &&
      currentSecondStepId !== ERecoveryStepId.CloudShare
    ) {
      fallbacks.push(ERecoveryStepId.CloudShare);
    }
    if (currentSecondStepId !== ERecoveryStepId.QRMigration) {
      fallbacks.push(ERecoveryStepId.QRMigration);
    }

    return fallbacks;
  }, [steps, hasLocalDeviceShare, isCloudAccessible]);

  // Check if fallback options are available
  const availableFallbacks = getAvailableFallbacks();
  const hasFallbackOptions = availableFallbacks.length > 0;

  // Get dynamic text for "try another method" button based on available fallbacks
  const tryAnotherMethodText = useMemo(() => {
    if (availableFallbacks.length === 1) {
      switch (availableFallbacks[0]) {
        case ERecoveryStepId.CloudShare:
          return `Or try ${cloudProviderName} backup`;
        case ERecoveryStepId.QRMigration:
          return 'Or transfer from another device';
        case ERecoveryStepId.DeviceShare:
          return 'Or try Device key';
        default:
          return 'Try another method';
      }
    }
    return 'Show other options';
  }, [availableFallbacks]);

  // Reset steps and state when switching flows
  const resetToFlow = useCallback((flow: ERecoveryFlow) => {
    setMockFlow(flow);
    setSuccessCount(0);
    setFallbacksRevealed(false);
    // Steps will rebuild via useEffect below
  }, []);

  // Rebuild steps when flow changes
  useEffect(() => {
    setSteps(buildInitialSteps());
  }, [buildInitialSteps]);

  // Helper: Mark Auth Share as success and enable step 2
  const onAuthShareSuccess = useCallback(() => {
    setSteps((prev) => {
      const newSteps = [...prev];
      newSteps[0] = { ...newSteps[0], state: ERecoveryStepState.Success };
      // Enable the second step for manual trigger (Info state shows action button)
      if (newSteps[1]) {
        newSteps[1] = {
          ...newSteps[1],
          state: ERecoveryStepState.Info,
        };
      }
      return newSteps;
    });
    setSuccessCount((prev) => prev + 1);
  }, []);

  // Helper: Mark Auth Share as warning (waiting for verification)
  const onAuthShareInfo = useCallback((message?: string) => {
    setSteps((prev) => {
      const newSteps = [...prev];
      // If step was previously Success, decrement successCount
      if (newSteps[0].state === ERecoveryStepState.Success) {
        setSuccessCount((c) => Math.max(0, c - 1));
      }
      newSteps[0] = {
        ...newSteps[0],
        state: ERecoveryStepState.Info,
        infoMessage: message,
      };
      return newSteps;
    });
  }, []);

  // Step 1: Verify Auth Share (OTP)
  const handleAuthShareVerification = useCallback(() => {
    setSteps((prev) => {
      const newSteps = [...prev];
      newSteps[0] = { ...newSteps[0], state: ERecoveryStepState.InProgress };
      return newSteps;
    });

    showOneKeyIDLoginDialog({
      initialView: 'verify',
      email,
      onLoginSuccess: async () => {
        onAuthShareSuccess();
      },
      onDismiss: () => {
        // User closed dialog without completing verification
        // Set to Info state so user can retry
        onAuthShareInfo();
      },
    });
  }, [email, onAuthShareSuccess, onAuthShareInfo]);

  // Handle Device Share verification (biometric/passcode)
  const handleDeviceShareVerification = useCallback(async () => {
    try {
      // Prompt user for biometric/passcode verification
      await backgroundApiProxy.servicePassword.promptPasswordVerify();

      setSteps((prev) => {
        const newSteps = [...prev];
        const deviceStepIndex = newSteps.findIndex(
          (s) => s.id === ERecoveryStepId.DeviceShare,
        );
        if (deviceStepIndex !== -1) {
          newSteps[deviceStepIndex] = {
            ...newSteps[deviceStepIndex],
            state: ERecoveryStepState.Success,
          };
        }
        return newSteps;
      });
      setSuccessCount((prev) => prev + 1);
    } catch {
      // User cancelled or verification failed - set to warning state
      setSteps((prev) => {
        const newSteps = [...prev];
        const deviceStepIndex = newSteps.findIndex(
          (s) => s.id === ERecoveryStepId.DeviceShare,
        );
        if (deviceStepIndex !== -1) {
          newSteps[deviceStepIndex] = {
            ...newSteps[deviceStepIndex],
            state: ERecoveryStepState.Info,
            infoMessage: undefined,
          };
        }
        return newSteps;
      });
    }
  }, []);

  // Handle Cloud Share retrieval
  const handleCloudShareRetrieval = useCallback(() => {
    // TODO: @zuo Replace with actual cloud share retrieval
    // Mock: Simulate cloud share retrieval
    setTimeout(() => {
      setSteps((prev) => {
        const newSteps = [...prev];
        const cloudStepIndex = newSteps.findIndex(
          (s) => s.id === ERecoveryStepId.CloudShare,
        );
        if (cloudStepIndex !== -1) {
          newSteps[cloudStepIndex] = {
            ...newSteps[cloudStepIndex],
            state: ERecoveryStepState.Success,
          };
        }
        return newSteps;
      });
      setSuccessCount((prev) => prev + 1);
    }, 1500);
  }, []);

  // Track if Transfer modal is open
  const isTransferModalOpenRef = useRef(false);

  // Handle QR Migration - opens the transfer modal
  const handleQRMigration = useCallback(() => {
    isTransferModalOpenRef.current = true;
    navigation.pushModal(EModalRoutes.PrimeModal, {
      screen: EPrimePages.PrimeTransfer,
      params: {
        transferType: EPrimeTransferDataType.keylessWallet,
      },
    });
  }, [navigation]);

  // Helper: Mark second step as success
  const onSecondStepSuccess = useCallback(() => {
    setSteps((prev) => {
      const newSteps = [...prev];
      if (newSteps[1]) {
        newSteps[1] = { ...newSteps[1], state: ERecoveryStepState.Success };
      }
      return newSteps;
    });
    setSuccessCount((prev) => prev + 1);
  }, []);

  // Helper: Mark second step as warning (waiting for verification)
  const onSecondStepInfo = useCallback((message?: string) => {
    setSteps((prev) => {
      const newSteps = [...prev];
      if (newSteps[1]) {
        // If step was previously Success, decrement successCount
        if (newSteps[1].state === ERecoveryStepState.Success) {
          setSuccessCount((c) => Math.max(0, c - 1));
        }
        newSteps[1] = {
          ...newSteps[1],
          state: ERecoveryStepState.Info,
          infoMessage: message,
        };
      }
      return newSteps;
    });
  }, []);

  // Handle "Try another method" - add fallback steps in Info state
  const handleTryAnotherMethod = useCallback(() => {
    const fallbacks = getAvailableFallbacks();
    if (fallbacks.length === 0) return;

    // Check which steps already exist
    const existingStepIds = new Set(steps.map((s) => s.id));

    // Create new steps for fallbacks that don't already exist
    const newFallbackSteps: IRecoveryStep[] = fallbacks
      .filter((id) => !existingStepIds.has(id))
      .map((id) => ({
        id,
        icon: STEP_CONFIG[id].icon,
        securityKeyType: STEP_CONFIG[id].securityKeyType,
        title: STEP_CONFIG[id].title,
        description: STEP_CONFIG[id].description,
        state: ERecoveryStepState.Info, // Start in Info state (waiting for user)
        infoMessage: STEP_CONFIG[id].infoMessage,
      }));

    if (newFallbackSteps.length > 0) {
      setSteps((prev) => [...prev, ...newFallbackSteps]);
      setFallbacksRevealed(true);
    }
  }, [getAvailableFallbacks, steps]);

  // Handle returning from Transfer modal - set QRMigration step to Info if not completed
  useFocusEffect(
    useCallback(() => {
      if (isTransferModalOpenRef.current) {
        isTransferModalOpenRef.current = false;
        // Check if QRMigration step exists and was in progress (meaning user exited without completing)
        setSteps((prev) => {
          const qrStepIndex = prev.findIndex(
            (s) => s.id === ERecoveryStepId.QRMigration,
          );
          if (
            qrStepIndex !== -1 &&
            prev[qrStepIndex].state === ERecoveryStepState.InProgress
          ) {
            const newSteps = [...prev];
            newSteps[qrStepIndex] = {
              ...newSteps[qrStepIndex],
              state: ERecoveryStepState.Info,
              infoMessage: undefined,
            };
            return newSteps;
          }
          return prev;
        });
      }
    }, []),
  );

  // Handle "Continue" button - show remaining steps dialog
  const handleShowRemainingSteps = useCallback(() => {
    const remainingCount = 2 - successCount;
    const pluralSuffix = remainingCount > 1 ? 's' : '';
    Dialog.show({
      icon: 'InfoCircleOutline',
      title: 'Complete All Steps',
      description: `${remainingCount} more step${pluralSuffix} required to restore your wallet.`,
      onConfirmText: intl.formatMessage({ id: ETranslations.global_got_it }),
      showCancelButton: false,
    });
  }, [successCount, intl]);

  // Handle "Restore Wallet" button - finalize wallet setup
  const handleRestoreWallet = useCallback(() => {
    navigation.push(EOnboardingPagesV2.FinalizeWalletSetup, {});
  }, [navigation]);

  // Retry handlers
  const handleRetryStep = useCallback(
    (stepId: ERecoveryStepId) => {
      if (stepId === ERecoveryStepId.AuthShare) {
        handleAuthShareVerification();
      } else if (stepId === ERecoveryStepId.DeviceShare) {
        void handleDeviceShareVerification();
      } else if (stepId === ERecoveryStepId.CloudShare) {
        handleCloudShareRetrieval();
      } else if (stepId === ERecoveryStepId.QRMigration) {
        handleQRMigration();
      }
    },
    [
      handleAuthShareVerification,
      handleDeviceShareVerification,
      handleCloudShareRetrieval,
      handleQRMigration,
    ],
  );

  // Get button text and info message from centralized config
  const getRetryButtonText = useCallback(
    (stepId: ERecoveryStepId) => STEP_CONFIG[stepId]?.buttonText ?? 'Retry',
    [],
  );

  const getDefaultInfoMessage = useCallback(
    (stepId: ERecoveryStepId) =>
      STEP_CONFIG[stepId]?.infoMessage ?? 'Not completed',
    [],
  );

  // Icon is now read directly from step.icon (via STEP_CONFIG)

  const renderStepStatusIcon = useCallback((state: ERecoveryStepState) => {
    switch (state) {
      case ERecoveryStepState.InProgress:
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
      case ERecoveryStepState.Success:
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
      case ERecoveryStepState.Error:
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
      case ERecoveryStepState.Info:
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
  }, []);

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header title="Restore your wallet" />
        <OnboardingLayout.Body constrained={false}>
          <OnboardingLayout.ConstrainedContent
            gap="$10"
            $platform-native={{
              py: '$5',
            }}
          >
            <YStack gap="$2">
              <SizableText color="$textDisabled">
                Restore by{' '}
                <SizableText color="$textSubdued" size="$bodyMdMedium">
                  2 security keys
                </SizableText>
                .
              </SizableText>
            </YStack>

            {visibleSteps.map((step, index) => (
              <Fragment key={step.id}>
                {/* Show "or" above each alternative step (except the first one) */}
                {index > 1 && visibleSteps.length > 2 ? (
                  <SizableText
                    size="$bodyMd"
                    color="$textDisabled"
                    my="$-4"
                    textAlign="center"
                  >
                    or
                  </SizableText>
                ) : null}

                <YStack>
                  {/* Highlight background */}
                  <AnimatePresence>
                    {step.state !== ERecoveryStepState.Success &&
                    step.state !== ERecoveryStepState.Idle ? (
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

                  {/* Connected line */}
                  {index === 0 ? (
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

                  <XStack
                    animation="quick"
                    animateOnly={['opacity']}
                    alignItems="center"
                    gap="$5"
                    opacity={step.state === ERecoveryStepState.Idle ? 0.5 : 1}
                  >
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
                    >
                      <SecurityKeyIcon
                        type={step.securityKeyType}
                        muted={step.state === ERecoveryStepState.Idle}
                      />
                      {step.state !== ERecoveryStepState.Idle ? (
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
                    <YStack gap="$1" flex={1}>
                      <SizableText size="$headingSm">{step.title}</SizableText>
                      <HeightTransition initialHeight={0}>
                        {step.description &&
                        (step.state === ERecoveryStepState.Info ||
                          step.state === ERecoveryStepState.InProgress) ? (
                          <SizableText color="$textDisabled">
                            {step.description}
                          </SizableText>
                        ) : null}
                      </HeightTransition>
                    </YStack>
                  </XStack>

                  <HeightTransition initialHeight={0}>
                    {/* Info state - waiting for user action */}
                    {step.state === ERecoveryStepState.Info ? (
                      <YStack gap="$3">
                        <XStack
                          gap="$2"
                          mt="$4"
                          pt="$4"
                          borderWidth={0}
                          borderTopWidth={StyleSheet.hairlineWidth}
                          borderTopColor="$neutral3"
                          alignItems="center"
                        >
                          {step.infoMessage ? (
                            <SizableText
                              size="$bodyMdMedium"
                              color="$textInfo"
                              flex={1}
                              textAlign="left"
                            >
                              {step.infoMessage ??
                                getDefaultInfoMessage(step.id)}
                            </SizableText>
                          ) : null}
                          <Button
                            variant="primary"
                            w="100%"
                            onPress={() => handleRetryStep(step.id)}
                          >
                            {getRetryButtonText(step.id)}
                          </Button>
                        </XStack>
                      </YStack>
                    ) : null}

                    {/* Error state */}
                    {step.state === ERecoveryStepState.Error ? (
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
                          {step.infoMessage ?? 'Verification failed'}
                        </SizableText>
                        <Button
                          variant="primary"
                          onPress={() => handleRetryStep(step.id)}
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

            {/* Show "Try another method" link below all steps when step 2 is active and fallbacks available */}
            {hasFallbackOptions &&
            !fallbacksRevealed &&
            visibleSteps[1]?.state !== ERecoveryStepState.Idle ? (
              <Button
                variant="tertiary"
                size="small"
                alignSelf="center"
                m="$0"
                onPress={handleTryAnotherMethod}
              >
                {tryAnotherMethodText}
              </Button>
            ) : null}

            {/* ============ MOCK CONTROLS FOR TESTING ============ */}
            {MOCK_MODE ? (
              <YStack
                gap="$4"
                mt="$8"
                p="$4"
                borderRadius="$3"
                bg="$bgCautionSubdued"
                borderWidth={1}
                borderColor="$borderCautionSubdued"
                borderStyle="dashed"
                // display="none"
              >
                <XStack alignItems="center" gap="$2">
                  <Icon name="BugOutline" size="$5" color="$iconCaution" />
                  <SizableText size="$headingSm" color="$textCaution">
                    Mock Controls (Dev Only)
                  </SizableText>
                </XStack>

                {/* Flow Selection */}
                <YStack gap="$3">
                  <SizableText size="$bodySmMedium" color="$text">
                    Select Flow:
                  </SizableText>
                  <YStack
                    gap="$1"
                    p="$3"
                    borderRadius="$2"
                    borderWidth={1}
                    borderColor={
                      mockFlow === ERecoveryFlow.AuthPlusDevice
                        ? '$borderActive'
                        : '$borderSubdued'
                    }
                    bg={
                      mockFlow === ERecoveryFlow.AuthPlusDevice
                        ? '$bgActive'
                        : '$bg'
                    }
                    hoverStyle={{ bg: '$bgHover' }}
                    pressStyle={{ bg: '$bgActive' }}
                    onPress={() => resetToFlow(ERecoveryFlow.AuthPlusDevice)}
                  >
                    <SizableText size="$bodyMdMedium">
                      Auth + Device
                    </SizableText>
                    <SizableText size="$bodySm" color="$textSubdued">
                      Device share is on this device
                    </SizableText>
                  </YStack>
                  <YStack
                    gap="$1"
                    p="$3"
                    borderRadius="$2"
                    borderWidth={1}
                    borderColor={
                      mockFlow === ERecoveryFlow.AuthPlusCloud
                        ? '$borderActive'
                        : '$borderSubdued'
                    }
                    bg={
                      mockFlow === ERecoveryFlow.AuthPlusCloud
                        ? '$bgActive'
                        : '$bg'
                    }
                    hoverStyle={{ bg: '$bgHover' }}
                    pressStyle={{ bg: '$bgActive' }}
                    onPress={() => resetToFlow(ERecoveryFlow.AuthPlusCloud)}
                  >
                    <SizableText size="$bodyMdMedium">Auth + Cloud</SizableText>
                    <SizableText size="$bodySm" color="$textSubdued">
                      Device share is not on this device, cloud is accessible
                    </SizableText>
                  </YStack>
                  <YStack
                    gap="$1"
                    p="$3"
                    borderRadius="$2"
                    borderWidth={1}
                    borderColor={
                      mockFlow === ERecoveryFlow.AuthPlusTransfer
                        ? '$borderActive'
                        : '$borderSubdued'
                    }
                    bg={
                      mockFlow === ERecoveryFlow.AuthPlusTransfer
                        ? '$bgActive'
                        : '$bg'
                    }
                    hoverStyle={{ bg: '$bgHover' }}
                    pressStyle={{ bg: '$bgActive' }}
                    onPress={() => resetToFlow(ERecoveryFlow.AuthPlusTransfer)}
                  >
                    <SizableText size="$bodyMdMedium">
                      Auth + Transfer
                    </SizableText>
                    <SizableText size="$bodySm" color="$textSubdued">
                      Device share is not on this device, cloud is not
                      accessible
                    </SizableText>
                  </YStack>
                </YStack>

                {/* Step Controls */}
                <YStack gap="$3">
                  <SizableText size="$bodySmMedium" color="$text">
                    Step Controls:
                  </SizableText>
                  <YStack
                    gap="$3"
                    p="$3"
                    borderRadius="$2"
                    bg="$bg"
                    borderWidth={1}
                    borderColor="$borderSubdued"
                  >
                    {/* Auth Share */}
                    <XStack alignItems="center" gap="$3">
                      <XStack
                        alignItems="center"
                        gap="$2"
                        w={120}
                        flexShrink={0}
                      >
                        <Icon
                          name="EmailOutline"
                          size="$4"
                          color="$iconSubdued"
                        />
                        <SizableText size="$bodySm" color="$textSubdued">
                          Auth Share
                        </SizableText>
                      </XStack>
                      <XStack gap="$1.5" flexWrap="wrap" flex={1}>
                        <Badge onPress={handleAuthShareVerification}>
                          Start
                        </Badge>
                        <Badge onPress={onAuthShareSuccess}>Success</Badge>
                        <Badge onPress={() => onAuthShareInfo()}>Info</Badge>
                      </XStack>
                    </XStack>

                    <YStack h={1} bg="$borderSubdued" />

                    {/* Device Share */}
                    <XStack alignItems="center" gap="$3">
                      <XStack
                        alignItems="center"
                        gap="$2"
                        w={120}
                        flexShrink={0}
                      >
                        <Icon
                          name="PasswordOutline"
                          size="$4"
                          color="$iconSubdued"
                        />
                        <SizableText size="$bodySm" color="$textSubdued">
                          Device Share
                        </SizableText>
                      </XStack>
                      <XStack gap="$1.5" flexWrap="wrap" flex={1}>
                        <Badge
                          onPress={() => void handleDeviceShareVerification()}
                        >
                          Start
                        </Badge>
                        <Badge onPress={onSecondStepSuccess}>Success</Badge>
                        <Badge onPress={() => onSecondStepInfo()}>Info</Badge>
                      </XStack>
                    </XStack>

                    <YStack h={1} bg="$borderSubdued" />

                    {/* Cloud Share */}
                    <XStack alignItems="center" gap="$3">
                      <XStack
                        alignItems="center"
                        gap="$2"
                        w={120}
                        flexShrink={0}
                      >
                        <Icon
                          name="CloudOutline"
                          size="$4"
                          color="$iconSubdued"
                        />
                        <SizableText size="$bodySm" color="$textSubdued">
                          Cloud Share
                        </SizableText>
                      </XStack>
                      <XStack gap="$1.5" flexWrap="wrap" flex={1}>
                        <Badge onPress={handleCloudShareRetrieval}>Start</Badge>
                        <Badge onPress={onSecondStepSuccess}>Success</Badge>
                        <Badge onPress={() => onSecondStepInfo()}>Info</Badge>
                      </XStack>
                    </XStack>

                    <YStack h={1} bg="$borderSubdued" />

                    {/* QR Migration */}
                    <XStack alignItems="center" gap="$3">
                      <XStack
                        alignItems="center"
                        gap="$2"
                        w={120}
                        flexShrink={0}
                      >
                        <Icon
                          name="ScanOutline"
                          size="$4"
                          color="$iconSubdued"
                        />
                        <SizableText size="$bodySm" color="$textSubdued">
                          Transfer
                        </SizableText>
                      </XStack>
                      <XStack gap="$1.5" flexWrap="wrap" flex={1}>
                        <Badge onPress={handleQRMigration}>Start</Badge>
                        <Badge onPress={onSecondStepSuccess}>Success</Badge>
                        <Badge onPress={() => onSecondStepInfo()}>Info</Badge>
                      </XStack>
                    </XStack>
                  </YStack>
                </YStack>
              </YStack>
            ) : null}
            {/* ==================================================== */}
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
        <OnboardingLayout.Footer>
          <AnimatePresence initial={false} exitBeforeEnter>
            {!isRecoveryComplete ? (
              <Button
                key="continue-button"
                variant="secondary"
                size="large"
                onPress={handleShowRemainingSteps}
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
                Continue ({successCount}/2)
              </Button>
            ) : (
              <Button
                key="restore-wallet-button"
                variant="primary"
                size="large"
                onPress={handleRestoreWallet}
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
                Restore Wallet
              </Button>
            )}
          </AnimatePresence>
        </OnboardingLayout.Footer>
      </OnboardingLayout>
    </Page>
  );
}
