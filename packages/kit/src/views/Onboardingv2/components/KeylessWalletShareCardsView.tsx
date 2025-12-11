import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SizableText, Toast, YStack } from '@onekeyhq/components';
import type { IBackupProviderAccountInfo } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  IAuthKeyPack,
  ICloudKeyPack,
  IDeviceKeyPack,
  IKeylessWalletPacks,
  IKeylessWalletRestoredData,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import {
  EOnboardingPagesV2,
  EOnboardingV2KeylessWalletCreationMode,
} from '@onekeyhq/shared/src/routes/onboardingv2';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { EPrimeTransferDataType } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useKeylessWallet } from '../../../components/KeylessWallet/useKeylessWallet';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import {
  ECreationStepId,
  ECreationStepState,
  type ICreationStep,
} from './keylessWalletOnboardingTypes';
import { KeylessWalletShareCard } from './KeylessWalletShareCard';

import type { ISecurityKeyType } from './SecurityKeyIcon';

export interface IKeylessWalletShareCardsViewProps {
  mode: EOnboardingV2KeylessWalletCreationMode;
}

export function KeylessWalletShareCardsView({
  mode,
}: IKeylessWalletShareCardsViewProps) {
  const navigation = useAppNavigation();
  const {
    generatePacks,
    saveDevicePack,
    uploadCloudPack,
    uploadAuthPack,
    getDevicePack,
    getAuthPackFromCache,
    getAuthPackFromServer,
    getCloudPack,
    receiveDevicePackByQrCode,
  } = useKeylessWallet();

  // Store generated packs in ref to persist across re-renders
  const packsRef = useRef<IKeylessWalletPacks | null>(null);
  const isGeneratingPacksRef = useRef(false);
  // Store packSetIds from device and cloud operations for auth pack upload
  const devicePackSetIdRef = useRef<string | null>(null);
  const cloudPackSetIdRef = useRef<string | null>(null);
  const authPackSetIdRef = useRef<string | null>(null);
  // Store restored packs for validation
  const devicePackRef = useRef<IDeviceKeyPack | null>(null);
  const cloudPackRef = useRef<ICloudKeyPack | null>(null);
  const authPackRef = useRef<IAuthKeyPack | null>(null);
  // Store restore validation result
  const restoreValidationResultRef = useRef<
    IKeylessWalletRestoredData | undefined
  >(undefined);

  const { result: keylessWalletCreationConfig } = usePromiseResult(async () => {
    let cloudAccountInfo: IBackupProviderAccountInfo | undefined;

    const isSupportCloudBackup =
      await backgroundApiProxy.serviceCloudBackupV2.supportCloudBackup();
    if (isSupportCloudBackup) {
      cloudAccountInfo =
        await backgroundApiProxy.serviceCloudBackupV2.getCloudAccountInfo();
    }
    const cloudProviderType = cloudAccountInfo?.providerType;

    const isRestoreMode =
      mode === EOnboardingV2KeylessWalletCreationMode.Restore;

    // Centralized text configuration for all steps
    const STEP_CONFIG: Record<
      ECreationStepId,
      {
        securityKeyType: ISecurityKeyType;
        title: string;
        description: ReactNode;
        infoMessage?: string;
        buttonText: string;
      }
    > = {
      [ECreationStepId.DeviceShare]: {
        securityKeyType: 'device',
        title: 'Device Key',
        description: (
          <>
            Encrypted with your{' '}
            <SizableText size="$bodyMdMedium" color="$textSubdued">
              passcode
            </SizableText>
            .
          </>
        ),
        // infoMessage: 'Tap to save the key to your device',
        buttonText: isRestoreMode ? 'Restore from Device' : 'Save to Device',
      },
      [ECreationStepId.CloudShare]: {
        securityKeyType: 'cloud',
        title: 'Cloud Key',
        description: `Encrypted backup to ${cloudProviderType ?? ''}`,
        // infoMessage: `Tap to backup the key to ${cloudProviderName}`,
        buttonText: isRestoreMode
          ? `Restore from ${cloudProviderType ?? ''}`
          : `Backup to ${cloudProviderType ?? ''}`,
      },
      [ECreationStepId.AuthShare]: {
        securityKeyType: 'auth',
        title: 'Auth Key',
        description: 'Protected by your OneKey ID',
        // infoMessage: 'Tap to save the key to OneKey server',
        buttonText: isRestoreMode ? 'Restore from Server' : 'Save to Server',
      },
    };

    return {
      STEP_CONFIG,
      isSupportCloudBackup,
      cloudAccountInfo,
    };
  }, [mode]);

  // Helper to create a step from config
  const createStep = useCallback(
    (id: ECreationStepId, state: ECreationStepState): ICreationStep => ({
      id,
      securityKeyType:
        keylessWalletCreationConfig?.STEP_CONFIG?.[id].securityKeyType,
      title: keylessWalletCreationConfig?.STEP_CONFIG?.[id].title,
      description: keylessWalletCreationConfig?.STEP_CONFIG?.[id].description,
      state,
      infoMessage:
        state === ECreationStepState.Info
          ? keylessWalletCreationConfig?.STEP_CONFIG?.[id].infoMessage
          : undefined,
    }),
    [keylessWalletCreationConfig?.STEP_CONFIG],
  );

  // Build initial steps - all start in Idle state except first one
  const buildInitialSteps = useCallback((): ICreationStep[] => {
    const isRestoreMode =
      mode === EOnboardingV2KeylessWalletCreationMode.Restore;
    const isViewMode = mode === EOnboardingV2KeylessWalletCreationMode.View;
    if (isRestoreMode || isViewMode) {
      // Restore/View mode: all steps start with Info state (all visible at once)
      return [
        createStep(ECreationStepId.DeviceShare, ECreationStepState.Info),
        createStep(ECreationStepId.CloudShare, ECreationStepState.Info),
        createStep(ECreationStepId.AuthShare, ECreationStepState.Info),
      ];
    }
    // Create mode: first step starts with Info, others are Idle
    return [
      createStep(ECreationStepId.DeviceShare, ECreationStepState.Info), // First step starts with Info state
      createStep(ECreationStepId.CloudShare, ECreationStepState.Idle),
      createStep(ECreationStepId.AuthShare, ECreationStepState.Idle),
    ];
  }, [createStep, mode]);

  const [steps, setSteps] = useState<ICreationStep[]>(buildInitialSteps);
  const [successCount, setSuccessCount] = useState(0);

  const isRestoreMode = mode === EOnboardingV2KeylessWalletCreationMode.Restore;
  const isViewMode = mode === EOnboardingV2KeylessWalletCreationMode.View;

  // Check if all steps are complete
  let isCreationComplete = false;
  if (isViewMode) {
    // View mode: disable auto-complete
    isCreationComplete = false;
  } else if (isRestoreMode) {
    isCreationComplete =
      successCount >= 2 && restoreValidationResultRef.current !== undefined;
  } else {
    isCreationComplete = successCount >= 3;
  }
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
                ? infoMessage ??
                  keylessWalletCreationConfig?.STEP_CONFIG?.[stepId].infoMessage
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
    [keylessWalletCreationConfig?.STEP_CONFIG],
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
    if (!packsRef.current) {
      updateStepState(
        ECreationStepId.DeviceShare,
        ECreationStepState.Error,
        'Packs not generated. Please wait.',
      );
      return;
    }

    updateStepState(ECreationStepId.DeviceShare, ECreationStepState.InProgress);

    try {
      // Prompt user for biometric/passcode verification to save device share
      await backgroundApiProxy.servicePassword.promptPasswordVerify();

      const result = await saveDevicePack({
        devicePack: packsRef.current.deviceKeyPack,
      });

      if (result.success) {
        // Store packSetId for later use in auth pack upload
        devicePackSetIdRef.current = result.packSetInFromDevicePack;
        updateStepState(
          ECreationStepId.DeviceShare,
          ECreationStepState.Success,
        );
        moveToNextStep(ECreationStepId.DeviceShare);
      } else {
        throw new OneKeyLocalError('Failed to save device pack');
      }
    } catch {
      // User cancelled or verification failed
      updateStepState(
        ECreationStepId.DeviceShare,
        ECreationStepState.Info,
        'Device key not saved. Tap to try again.',
      );
    }
  }, [updateStepState, moveToNextStep, saveDevicePack]);

  // Step 2: Save Cloud Share
  const handleCloudShareSave = useCallback(async () => {
    if (!packsRef.current) {
      updateStepState(
        ECreationStepId.CloudShare,
        ECreationStepState.Error,
        'Packs not generated. Please wait.',
      );
      return;
    }

    updateStepState(ECreationStepId.CloudShare, ECreationStepState.InProgress);

    try {
      const result = await uploadCloudPack({
        cloudPack: packsRef.current.cloudKeyPack,
      });

      if (result.success) {
        // Store packSetId for later use in auth pack upload
        cloudPackSetIdRef.current = result.packSetInFromCloudPack;
        updateStepState(ECreationStepId.CloudShare, ECreationStepState.Success);
        moveToNextStep(ECreationStepId.CloudShare);
      } else {
        throw new OneKeyLocalError('Failed to upload cloud pack');
      }
    } catch {
      updateStepState(
        ECreationStepId.CloudShare,
        ECreationStepState.Info,
        'Cloud backup failed. Tap to try again.',
      );
    }
  }, [updateStepState, moveToNextStep, uploadCloudPack]);

  // Check restore validation when we have 2+ packs
  const checkRestoreValidation = useCallback(async () => {
    const packs: {
      deviceKeyPack?: IDeviceKeyPack;
      cloudKeyPack?: ICloudKeyPack;
      authKeyPack?: IAuthKeyPack;
    } = {};

    if (devicePackRef.current) {
      packs.deviceKeyPack = devicePackRef.current;
    }
    if (cloudPackRef.current) {
      packs.cloudKeyPack = cloudPackRef.current;
    }
    if (authPackRef.current) {
      packs.authKeyPack = authPackRef.current;
    }

    const packCount =
      (packs.deviceKeyPack ? 1 : 0) +
      (packs.cloudKeyPack ? 1 : 0) +
      (packs.authKeyPack ? 1 : 0);

    if (packCount >= 2) {
      try {
        const result =
          await backgroundApiProxy.serviceKeylessWallet.restoreKeylessWalletSafe(
            packs,
          );
        if (result) {
          restoreValidationResultRef.current = result;
          return true;
        }
        // Validation failed - packs cannot restore mnemonic
        restoreValidationResultRef.current = undefined;
        return false;
      } catch (error) {
        restoreValidationResultRef.current = undefined;
        return false;
      }
    }
    return false;
  }, []);

  // Restore handlers
  const handleDeviceShareRestore = useCallback(async () => {
    updateStepState(ECreationStepId.DeviceShare, ECreationStepState.InProgress);

    try {
      const devicePack = await getDevicePack();
      if (!devicePack) {
        throw new OneKeyLocalError('Failed to restore device pack');
      }

      devicePackRef.current = devicePack;
      devicePackSetIdRef.current = devicePack.packSetId;

      const isValid = await checkRestoreValidation();
      if (isValid) {
        updateStepState(
          ECreationStepId.DeviceShare,
          ECreationStepState.Success,
        );
        return;
      }
      // If we have 2 packs but validation failed, show error
      if (
        (devicePackRef.current ? 1 : 0) +
          (cloudPackRef.current ? 1 : 0) +
          (authPackRef.current ? 1 : 0) >=
        2
      ) {
        updateStepState(
          ECreationStepId.DeviceShare,
          ECreationStepState.Error,
          'Cannot restore wallet with these packs. Please try other packs.',
        );
        // Reset other successful steps that might be part of invalid combination
        // Need to reset state and success count for other steps
        if (cloudPackRef.current) {
          cloudPackRef.current = null;
          updateStepState(ECreationStepId.CloudShare, ECreationStepState.Info);
        }
        if (authPackRef.current) {
          authPackRef.current = null;
          updateStepState(ECreationStepId.AuthShare, ECreationStepState.Info);
        }
        restoreValidationResultRef.current = undefined;
        return;
      }
      updateStepState(ECreationStepId.DeviceShare, ECreationStepState.Success);
    } catch {
      updateStepState(
        ECreationStepId.DeviceShare,
        ECreationStepState.Info,
        'Device key restore failed. Tap to try again.',
      );
    }
  }, [updateStepState, getDevicePack, checkRestoreValidation]);

  const handleCloudShareRestore = useCallback(async () => {
    updateStepState(ECreationStepId.CloudShare, ECreationStepState.InProgress);

    try {
      const cloudPack = await getCloudPack();
      if (!cloudPack) {
        throw new OneKeyLocalError('Failed to restore cloud pack');
      }

      cloudPackRef.current = cloudPack;
      cloudPackSetIdRef.current = cloudPack.packSetId;

      const isValid = await checkRestoreValidation();
      if (isValid) {
        updateStepState(ECreationStepId.CloudShare, ECreationStepState.Success);
        return;
      }
      // If we have 2 packs but validation failed, show error
      if (
        (devicePackRef.current ? 1 : 0) +
          (cloudPackRef.current ? 1 : 0) +
          (authPackRef.current ? 1 : 0) >=
        2
      ) {
        updateStepState(
          ECreationStepId.CloudShare,
          ECreationStepState.Error,
          'Cannot restore wallet with these packs. Please try other packs.',
        );
        // Reset other successful steps that might be part of invalid combination
        if (devicePackRef.current) {
          devicePackRef.current = null;
          updateStepState(ECreationStepId.DeviceShare, ECreationStepState.Info);
        }
        if (authPackRef.current) {
          authPackRef.current = null;
          updateStepState(ECreationStepId.AuthShare, ECreationStepState.Info);
        }
        restoreValidationResultRef.current = undefined;
        return;
      }
      updateStepState(ECreationStepId.CloudShare, ECreationStepState.Success);
    } catch {
      updateStepState(
        ECreationStepId.CloudShare,
        ECreationStepState.Info,
        'Cloud backup restore failed. Tap to try again.',
      );
    }
  }, [updateStepState, getCloudPack, checkRestoreValidation]);

  const handleAuthShareRestore = useCallback(async () => {
    Toast.success({
      title: 'handleAuthShareRestore',
    });
    updateStepState(ECreationStepId.AuthShare, ECreationStepState.InProgress);
    let authPack: IAuthKeyPack | null = null;

    try {
      // Try cache first, then server
      authPack = await getAuthPackFromCache();
    } catch (error) {
      console.error('Failed to get auth pack from cache:', error);
    }

    try {
      if (!authPack) {
        authPack = await getAuthPackFromServer();
      }

      if (!authPack) {
        throw new OneKeyLocalError('Failed to restore auth pack');
      }

      authPackRef.current = authPack;
      authPackSetIdRef.current = authPack.packSetId;

      const isValid = await checkRestoreValidation();
      if (isValid) {
        updateStepState(ECreationStepId.AuthShare, ECreationStepState.Success);
        return;
      }
      // If we have 2 packs but validation failed, show error
      if (
        (devicePackRef.current ? 1 : 0) +
          (cloudPackRef.current ? 1 : 0) +
          (authPackRef.current ? 1 : 0) >=
        2
      ) {
        updateStepState(
          ECreationStepId.AuthShare,
          ECreationStepState.Error,
          'Cannot restore wallet with these packs. Please try other packs.',
        );
        // Reset other successful steps that might be part of invalid combination
        if (devicePackRef.current) {
          devicePackRef.current = null;
          updateStepState(ECreationStepId.DeviceShare, ECreationStepState.Info);
        }
        if (cloudPackRef.current) {
          cloudPackRef.current = null;
          updateStepState(ECreationStepId.CloudShare, ECreationStepState.Info);
        }
        restoreValidationResultRef.current = undefined;
        return;
      }
      updateStepState(ECreationStepId.AuthShare, ECreationStepState.Success);
    } catch {
      updateStepState(
        ECreationStepId.AuthShare,
        ECreationStepState.Info,
        'Server restore failed. Tap to try again.',
      );
    }
  }, [
    updateStepState,
    getAuthPackFromCache,
    getAuthPackFromServer,
    checkRestoreValidation,
  ]);

  // Step 3: Save Auth Share
  const handleAuthShareSave = useCallback(async () => {
    if (!packsRef.current) {
      updateStepState(
        ECreationStepId.AuthShare,
        ECreationStepState.Error,
        'Packs not generated. Please wait.',
      );
      return;
    }

    if (!devicePackSetIdRef.current || !cloudPackSetIdRef.current) {
      updateStepState(
        ECreationStepId.AuthShare,
        ECreationStepState.Error,
        'Please complete device and cloud steps first.',
      );
      return;
    }

    updateStepState(ECreationStepId.AuthShare, ECreationStepState.InProgress);

    try {
      const result = await uploadAuthPack({
        authPack: packsRef.current.authKeyPack,
        packSetIdFromCloudPack: cloudPackSetIdRef.current,
        packSetIdFromDevicePack: devicePackSetIdRef.current,
      });

      if (result.success) {
        updateStepState(ECreationStepId.AuthShare, ECreationStepState.Success);
      } else {
        throw new OneKeyLocalError('Failed to upload auth pack');
      }
    } catch {
      updateStepState(
        ECreationStepId.AuthShare,
        ECreationStepState.Info,
        'Server save failed. Tap to try again.',
      );
    }
  }, [updateStepState, uploadAuthPack]);

  // Handle step action based on step type and mode
  const handleStepAction = useCallback(
    (stepId: ECreationStepId) => {
      if (isRestoreMode || isViewMode) {
        if (stepId === ECreationStepId.DeviceShare) {
          void handleDeviceShareRestore();
        } else if (stepId === ECreationStepId.CloudShare) {
          void handleCloudShareRestore();
        } else if (stepId === ECreationStepId.AuthShare) {
          void handleAuthShareRestore();
        }
        return;
      }
      if (stepId === ECreationStepId.DeviceShare) {
        void handleDeviceShareSave();
      } else if (stepId === ECreationStepId.CloudShare) {
        void handleCloudShareSave();
      } else if (stepId === ECreationStepId.AuthShare) {
        void handleAuthShareSave();
      }
    },
    [
      isRestoreMode,
      isViewMode,
      handleDeviceShareSave,
      handleCloudShareSave,
      handleAuthShareSave,
      handleDeviceShareRestore,
      handleCloudShareRestore,
      handleAuthShareRestore,
    ],
  );

  // Get button text from config
  const getButtonText = useCallback(
    (stepId: ECreationStepId) => {
      if (isViewMode) {
        return 'Check';
      }
      return (
        keylessWalletCreationConfig?.STEP_CONFIG?.[stepId]?.buttonText ??
        'Continue'
      );
    },
    [keylessWalletCreationConfig?.STEP_CONFIG, isViewMode],
  );

  // Handle "Complete Setup" - navigate to finalize wallet setup
  const handleCompleteSetup = useCallback(async () => {
    // Priority: Auth > Cloud > Device
    const packSetId =
      authPackSetIdRef.current ??
      cloudPackSetIdRef.current ??
      devicePackSetIdRef.current;

    // If restore mode, save device pack
    if (isRestoreMode) {
      try {
        // Save device pack if available
        if (devicePackRef.current) {
          try {
            await saveDevicePack({
              devicePack: devicePackRef.current,
            });
          } catch (error) {
            console.error('Failed to save device pack:', error);
          }
        }
      } catch (error) {
        console.error('Failed to save/upload restored packs:', error);
      }
    }

    navigation.push(EOnboardingPagesV2.FinalizeWalletSetup, {
      keylessPackSetId: packSetId,
    });
  }, [navigation, isRestoreMode, saveDevicePack]);

  // Auto-navigate when all steps are complete
  useEffect(() => {
    if (isCreationComplete && !isViewMode) {
      // Small delay to let user see the final success state
      const timer = setTimeout(() => {
        void handleCompleteSetup();
      }, 800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isCreationComplete, handleCompleteSetup, isViewMode]);

  // Reset steps when component mounts
  useEffect(() => {
    setSteps(buildInitialSteps());
  }, [buildInitialSteps]);

  // Generate packs on mount if they don't exist (only in Create mode)
  useEffect(() => {
    // Skip in Restore/View mode
    if (isRestoreMode || isViewMode) {
      return;
    }

    const generatePacksOnMount = async () => {
      // Skip if packs already exist
      if (packsRef.current) {
        return;
      }

      // Skip if already generating
      if (isGeneratingPacksRef.current) {
        return;
      }

      isGeneratingPacksRef.current = true;
      try {
        const packs = await generatePacks();
        packsRef.current = packs;
      } catch (error) {
        // Handle error silently or show error state if needed
        console.error('Failed to generate packs:', error);
      } finally {
        isGeneratingPacksRef.current = false;
      }
    };

    void generatePacksOnMount();
  }, [generatePacks, isRestoreMode, isViewMode]);

  // Listen for deviceKeyPack received from PrimeTransfer
  useEffect(() => {
    if (!isRestoreMode) {
      return;
    }

    const fn = (
      data: IAppEventBusPayload[EAppEventBusNames.PrimeTransferDataReceived],
    ) => {
      const receivedDeviceKeyPack = data.data?.privateData?.deviceKeyPack;
      if (!receivedDeviceKeyPack) {
        return;
      }

      // Handle deviceKeyPack restore
      void (async () => {
        try {
          updateStepState(
            ECreationStepId.DeviceShare,
            ECreationStepState.InProgress,
          );

          // Save deviceKeyPack to ref
          devicePackRef.current = receivedDeviceKeyPack;
          devicePackSetIdRef.current = receivedDeviceKeyPack.packSetId;

          // Check if we can restore with current packs
          const isValid = await checkRestoreValidation();
          if (isValid) {
            updateStepState(
              ECreationStepId.DeviceShare,
              ECreationStepState.Success,
            );
            return;
          }

          // If we have 2 packs but validation failed, show error
          if (
            (devicePackRef.current ? 1 : 0) +
              (cloudPackRef.current ? 1 : 0) +
              (authPackRef.current ? 1 : 0) >=
            2
          ) {
            updateStepState(
              ECreationStepId.DeviceShare,
              ECreationStepState.Error,
              'Cannot restore wallet with these packs. Please try other packs.',
            );
            // Reset other successful steps that might be part of invalid combination
            if (cloudPackRef.current) {
              cloudPackRef.current = null;
              updateStepState(
                ECreationStepId.CloudShare,
                ECreationStepState.Info,
              );
            }
            if (authPackRef.current) {
              authPackRef.current = null;
              updateStepState(
                ECreationStepId.AuthShare,
                ECreationStepState.Info,
              );
            }
            restoreValidationResultRef.current = undefined;
            return;
          }

          // Only one pack so far, mark as success
          updateStepState(
            ECreationStepId.DeviceShare,
            ECreationStepState.Success,
          );
        } catch (error) {
          console.error('Failed to restore deviceKeyPack:', error);
          updateStepState(
            ECreationStepId.DeviceShare,
            ECreationStepState.Info,
            'Device key restore failed. Tap to try again.',
          );
        }
      })();
    };

    appEventBus.on(EAppEventBusNames.PrimeTransferDataReceived, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeTransferDataReceived, fn);
    };
  }, [isRestoreMode, updateStepState, checkRestoreValidation]);

  // Clear packs on component cleanup
  useEffect(() => {
    return () => {
      packsRef.current = null;
      devicePackSetIdRef.current = null;
      cloudPackSetIdRef.current = null;
      authPackSetIdRef.current = null;
      devicePackRef.current = null;
      cloudPackRef.current = null;
      authPackRef.current = null;
      restoreValidationResultRef.current = undefined;
    };
  }, []);

  // Get visible steps (all steps are always visible in creation flow)
  const visibleSteps = useMemo(() => steps, [steps]);

  return (
    <>
      <YStack gap="$2">
        <SizableText color="$textDisabled">
          Secure by{' '}
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            3 security keys
          </SizableText>
          .
        </SizableText>
      </YStack>

      {visibleSteps.map((step, index) => {
        const isLastStep = index === visibleSteps.length - 1;
        const commonProps = {
          step,
          index,
          isLastStep,
          onStepAction: () => handleStepAction(step.id),
          buttonText: getButtonText(step.id),
        };

        if (step.id === ECreationStepId.DeviceShare) {
          let onSecondaryAction: (() => void) | undefined;
          let secondaryButtonText: string | undefined;
          if (isRestoreMode) {
            onSecondaryAction = receiveDevicePackByQrCode;
            secondaryButtonText = 'Restore from another device';
          } else if (isViewMode) {
            onSecondaryAction = () => {
              navigation.pushModal(EModalRoutes.PrimeModal, {
                screen: EPrimePages.PrimeTransfer,
                params: {
                  defaultTab: 'enter-link',
                  transferType: EPrimeTransferDataType.keylessWallet,
                },
              });
            };
            secondaryButtonText = '发送到其他设备';
          }
          return (
            <KeylessWalletShareCard
              key={step.id}
              {...commonProps}
              onSecondaryAction={onSecondaryAction}
              secondaryButtonText={secondaryButtonText}
            />
          );
        }
        if (step.id === ECreationStepId.CloudShare) {
          return <KeylessWalletShareCard key={step.id} {...commonProps} />;
        }
        if (step.id === ECreationStepId.AuthShare) {
          return <KeylessWalletShareCard key={step.id} {...commonProps} />;
        }
        return null;
      })}
    </>
  );
}
