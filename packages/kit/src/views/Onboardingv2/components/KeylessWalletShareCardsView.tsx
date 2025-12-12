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
import { OnboardingLayout } from './OnboardingLayout';

import type { ISecurityKeyType } from './SecurityKeyIcon';

// Step order constant - defined outside component to avoid recreation
const STEP_ORDER = [
  ECreationStepId.DeviceShare,
  ECreationStepId.CloudShare,
  ECreationStepId.AuthShare,
] as const;

// Helper function: Calculate current pack count
// Extracted outside component since it has no dependencies
function getPackCount({
  restoreDevicePackRef,
  restoreCloudPackRef,
  restoreAuthPackRef,
}: {
  restoreDevicePackRef: { current: IDeviceKeyPack | null };
  restoreCloudPackRef: { current: ICloudKeyPack | null };
  restoreAuthPackRef: { current: IAuthKeyPack | null };
}): number {
  return [
    restoreDevicePackRef.current,
    restoreCloudPackRef.current,
    restoreAuthPackRef.current,
  ].filter(Boolean).length;
}

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

  // Define mode flags at the beginning for reuse throughout the component
  const isRestoreMode = useMemo(
    () => mode === EOnboardingV2KeylessWalletCreationMode.Restore,
    [mode],
  );
  const isViewMode = useMemo(
    () => mode === EOnboardingV2KeylessWalletCreationMode.View,
    [mode],
  );

  // Store generated packs in ref to persist across re-renders (only used in create mode)
  const generatePacksRef = useRef<IKeylessWalletPacks | null>(null);
  const isGeneratingPacksRef = useRef(false);
  // Store packSetIds from device and cloud operations for auth pack upload
  const devicePackSetIdRef = useRef<string | null>(null);
  const cloudPackSetIdRef = useRef<string | null>(null);
  const authPackSetIdRef = useRef<string | null>(null);
  // Store restored packs for validation (only used in restore mode)
  const restoreDevicePackRef = useRef<IDeviceKeyPack | null>(null);
  const restoreCloudPackRef = useRef<ICloudKeyPack | null>(null);
  const restoreAuthPackRef = useRef<IAuthKeyPack | null>(null);
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
  }, [isRestoreMode]);

  // Helper to create a step from config
  const createStep = useCallback(
    ({
      id,
      state,
    }: {
      id: ECreationStepId;
      state: ECreationStepState;
    }): ICreationStep => ({
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
    if (isRestoreMode || isViewMode) {
      // Restore/View mode: all steps start with Info state (all visible at once)
      return [
        createStep({
          id: ECreationStepId.DeviceShare,
          state: ECreationStepState.Info,
        }),
        createStep({
          id: ECreationStepId.CloudShare,
          state: ECreationStepState.Info,
        }),
        createStep({
          id: ECreationStepId.AuthShare,
          state: ECreationStepState.Info,
        }),
      ];
    }
    // Create mode: first step starts with Info, others are Idle
    return [
      createStep({
        id: ECreationStepId.DeviceShare,
        state: ECreationStepState.Info,
      }), // First step starts with Info state
      createStep({
        id: ECreationStepId.CloudShare,
        state: ECreationStepState.Idle,
      }),
      createStep({
        id: ECreationStepId.AuthShare,
        state: ECreationStepState.Idle,
      }),
    ];
  }, [createStep, isRestoreMode, isViewMode]);

  const [steps, setSteps] = useState<ICreationStep[]>(buildInitialSteps);
  const [successCount, setSuccessCount] = useState(0);

  // Check if all steps are complete
  const isCreationComplete = useMemo(() => {
    if (isViewMode) {
      // View mode: disable auto-complete
      return false;
    }
    if (isRestoreMode) {
      return (
        successCount >= 2 && restoreValidationResultRef.current !== undefined
      );
    }
    return successCount >= 3;
  }, [isViewMode, isRestoreMode, successCount]);

  // Helper: Update step state
  const updateStepState = useCallback(
    ({
      stepId,
      newState,
      infoMessage,
    }: {
      stepId: ECreationStepId;
      newState: ECreationStepState;
      infoMessage?: string;
    }) => {
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
    ({ completedStepId }: { completedStepId: ECreationStepId }) => {
      const currentIndex = STEP_ORDER.indexOf(completedStepId);
      if (currentIndex < STEP_ORDER.length - 1) {
        const nextStepId = STEP_ORDER[currentIndex + 1];
        updateStepState({
          stepId: nextStepId,
          newState: ECreationStepState.Info,
        });
      }
    },
    [updateStepState],
  );
  // Helper: Reset other packs when validation fails
  const resetOtherPacksOnValidationFailure = useCallback(
    ({ currentStepId }: { currentStepId: ECreationStepId }) => {
      if (
        currentStepId !== ECreationStepId.DeviceShare &&
        restoreDevicePackRef.current
      ) {
        restoreDevicePackRef.current = null;
        updateStepState({
          stepId: ECreationStepId.DeviceShare,
          newState: ECreationStepState.Info,
        });
      }
      if (
        currentStepId !== ECreationStepId.CloudShare &&
        restoreCloudPackRef.current
      ) {
        restoreCloudPackRef.current = null;
        updateStepState({
          stepId: ECreationStepId.CloudShare,
          newState: ECreationStepState.Info,
        });
      }
      if (
        currentStepId !== ECreationStepId.AuthShare &&
        restoreAuthPackRef.current
      ) {
        restoreAuthPackRef.current = null;
        updateStepState({
          stepId: ECreationStepId.AuthShare,
          newState: ECreationStepState.Info,
        });
      }
      restoreValidationResultRef.current = undefined;
    },
    [updateStepState],
  );

  // Check restore validation when we have 2+ packs
  const checkRestoreValidation = useCallback(async () => {
    const packs: {
      deviceKeyPack?: IDeviceKeyPack;
      cloudKeyPack?: ICloudKeyPack;
      authKeyPack?: IAuthKeyPack;
    } = {};

    if (restoreDevicePackRef.current) {
      packs.deviceKeyPack = restoreDevicePackRef.current;
    }
    if (restoreCloudPackRef.current) {
      packs.cloudKeyPack = restoreCloudPackRef.current;
    }
    if (restoreAuthPackRef.current) {
      packs.authKeyPack = restoreAuthPackRef.current;
    }

    const packCount = getPackCount({
      restoreDevicePackRef,
      restoreCloudPackRef,
      restoreAuthPackRef,
    });

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

  // Generic restore handler
  const handleRestoreShare = useCallback(
    async ({
      stepId,
      getPack,
      setPackRef,
      setPackSetIdRef,
      errorMessage,
    }: {
      stepId: ECreationStepId;
      getPack: () => Promise<{
        pack: IDeviceKeyPack | ICloudKeyPack | IAuthKeyPack;
        packSetId: string;
      } | null>;
      setPackRef: (
        pack: IDeviceKeyPack | ICloudKeyPack | IAuthKeyPack | null,
      ) => void;
      setPackSetIdRef: (id: string | null) => void;
      errorMessage: string;
    }) => {
      updateStepState({ stepId, newState: ECreationStepState.InProgress });

      try {
        const result = await getPack();
        if (!result) {
          throw new OneKeyLocalError(errorMessage);
        }

        setPackRef(result.pack);
        setPackSetIdRef(result.packSetId);

        const isValid = await checkRestoreValidation();
        if (isValid) {
          updateStepState({ stepId, newState: ECreationStepState.Success });
          return;
        }

        // If we have 2 packs but validation failed, show error
        if (
          getPackCount({
            restoreDevicePackRef,
            restoreCloudPackRef,
            restoreAuthPackRef,
          }) >= 2
        ) {
          updateStepState({
            stepId,
            newState: ECreationStepState.Error,
            infoMessage:
              'Cannot restore wallet with these packs. Please try other packs.',
          });
          resetOtherPacksOnValidationFailure({ currentStepId: stepId });
          return;
        }

        // Only one pack so far, mark as success
        updateStepState({ stepId, newState: ECreationStepState.Success });
      } catch {
        updateStepState({
          stepId,
          newState: ECreationStepState.Info,
          infoMessage: errorMessage,
        });
      }
    },
    [
      updateStepState,
      checkRestoreValidation,
      resetOtherPacksOnValidationFailure,
    ],
  );

  // Generic save handler
  const handleSaveShare = useCallback(
    async ({
      stepId,
      validateBeforeSave,
      saveFunction,
      onSuccess,
      errorMessage,
      shouldMoveToNextStep = true,
    }: {
      stepId: ECreationStepId;
      validateBeforeSave?: () => Promise<void> | void;
      saveFunction: () => Promise<{ success: boolean; [key: string]: unknown }>;
      onSuccess: (result: { success: boolean; [key: string]: unknown }) => void;
      errorMessage: string;
      shouldMoveToNextStep?: boolean;
    }) => {
      if (!generatePacksRef.current) {
        updateStepState({
          stepId,
          newState: ECreationStepState.Error,
          infoMessage: 'Packs not generated. Please wait.',
        });
        return;
      }

      if (validateBeforeSave) {
        try {
          await validateBeforeSave();
        } catch (error) {
          // Validation failed, error should be handled by validateBeforeSave
          return;
        }
      }

      updateStepState({ stepId, newState: ECreationStepState.InProgress });

      try {
        const result = await saveFunction();

        if (result.success) {
          onSuccess(result);
          updateStepState({ stepId, newState: ECreationStepState.Success });
          if (shouldMoveToNextStep) {
            moveToNextStep({ completedStepId: stepId });
          }
        } else {
          throw new OneKeyLocalError(`Failed to save ${stepId}`);
        }
      } catch {
        updateStepState({
          stepId,
          newState: ECreationStepState.Info,
          infoMessage: errorMessage,
        });
      }
    },
    [updateStepState, moveToNextStep],
  );

  // Step 1: Save Device Share
  const handleDeviceShareSave = useCallback(async () => {
    await handleSaveShare({
      stepId: ECreationStepId.DeviceShare,
      validateBeforeSave: async () => {
        // Prompt user for biometric/passcode verification to save device share
        await backgroundApiProxy.servicePassword.promptPasswordVerify();
      },
      saveFunction: async () => {
        if (!generatePacksRef.current) {
          throw new OneKeyLocalError('Packs not generated');
        }
        return saveDevicePack({
          devicePack: generatePacksRef.current.deviceKeyPack,
        });
      },
      onSuccess: (result) => {
        devicePackSetIdRef.current = result.packSetInFromDevicePack as string;
      },
      errorMessage: 'Device key not saved. Tap to try again.',
    });
  }, [handleSaveShare, saveDevicePack]);

  // Step 2: Save Cloud Share
  const handleCloudShareSave = useCallback(async () => {
    await handleSaveShare({
      stepId: ECreationStepId.CloudShare,
      saveFunction: async () => {
        if (!generatePacksRef.current) {
          throw new OneKeyLocalError('Packs not generated');
        }
        return uploadCloudPack({
          cloudPack: generatePacksRef.current.cloudKeyPack,
        });
      },
      onSuccess: (result) => {
        cloudPackSetIdRef.current = result.packSetInFromCloudPack as string;
      },
      errorMessage: 'Cloud backup failed. Tap to try again.',
    });
  }, [handleSaveShare, uploadCloudPack]);

  // Restore handlers
  const handleDeviceShareRestore = useCallback(async () => {
    await handleRestoreShare({
      stepId: ECreationStepId.DeviceShare,
      getPack: async () => {
        const pack = await getDevicePack();
        if (!pack) return null;
        return { pack, packSetId: pack.packSetId };
      },
      setPackRef: (pack) => {
        restoreDevicePackRef.current = pack as IDeviceKeyPack | null;
      },
      setPackSetIdRef: (id) => {
        devicePackSetIdRef.current = id;
      },
      errorMessage: 'Device key restore failed. Tap to try again.',
    });
  }, [handleRestoreShare, getDevicePack]);

  const handleCloudShareRestore = useCallback(async () => {
    await handleRestoreShare({
      stepId: ECreationStepId.CloudShare,
      getPack: async () => {
        const pack = await getCloudPack();
        if (!pack) return null;
        return { pack, packSetId: pack.packSetId };
      },
      setPackRef: (pack) => {
        restoreCloudPackRef.current = pack as ICloudKeyPack | null;
      },
      setPackSetIdRef: (id) => {
        cloudPackSetIdRef.current = id;
      },
      errorMessage: 'Cloud backup restore failed. Tap to try again.',
    });
  }, [handleRestoreShare, getCloudPack]);

  const handleAuthShareRestore = useCallback(async () => {
    Toast.success({
      title: 'handleAuthShareRestore',
    });
    await handleRestoreShare({
      stepId: ECreationStepId.AuthShare,
      getPack: async () => {
        // Try cache first, then server
        let authPack: IAuthKeyPack | null = null;
        try {
          authPack = await getAuthPackFromCache();
        } catch (error) {
          console.error('Failed to get auth pack from cache:', error);
        }

        if (!authPack) {
          authPack = await getAuthPackFromServer();
        }

        if (!authPack) return null;
        return { pack: authPack, packSetId: authPack.packSetId };
      },
      setPackRef: (pack) => {
        restoreAuthPackRef.current = pack as IAuthKeyPack | null;
      },
      setPackSetIdRef: (id) => {
        authPackSetIdRef.current = id;
      },
      errorMessage: 'Server restore failed. Tap to try again.',
    });
  }, [handleRestoreShare, getAuthPackFromCache, getAuthPackFromServer]);

  // Step 3: Save Auth Share
  const handleAuthShareSave = useCallback(async () => {
    await handleSaveShare({
      stepId: ECreationStepId.AuthShare,
      validateBeforeSave: () => {
        if (!devicePackSetIdRef.current || !cloudPackSetIdRef.current) {
          updateStepState({
            stepId: ECreationStepId.AuthShare,
            newState: ECreationStepState.Error,
            infoMessage: 'Please complete device and cloud steps first.',
          });
          throw new OneKeyLocalError(
            'Please complete device and cloud steps first.',
          );
        }
      },
      saveFunction: async () => {
        if (!generatePacksRef.current) {
          throw new OneKeyLocalError('Packs not generated');
        }
        if (!cloudPackSetIdRef.current || !devicePackSetIdRef.current) {
          throw new OneKeyLocalError('Missing pack set IDs');
        }
        return uploadAuthPack({
          authPack: generatePacksRef.current.authKeyPack,
          packSetIdFromCloudPack: cloudPackSetIdRef.current,
          packSetIdFromDevicePack: devicePackSetIdRef.current,
        });
      },
      onSuccess: () => {
        // No additional action needed on success for auth share
      },
      errorMessage: 'Server save failed. Tap to try again.',
      shouldMoveToNextStep: false, // Don't move to next step for auth share
    });
  }, [handleSaveShare, updateStepState, uploadAuthPack]);

  // Handle step action based on step type and mode
  const handleStepAction = useCallback(
    ({ stepId }: { stepId: ECreationStepId }) => {
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
    ({ stepId }: { stepId: ECreationStepId }) => {
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

  // Memoize secondary action handler for DeviceShare in view mode
  const handleDeviceShareViewModeSecondaryAction = useCallback(() => {
    navigation.pushModal(EModalRoutes.PrimeModal, {
      screen: EPrimePages.PrimeTransfer,
      params: {
        defaultTab: 'enter-link',
        transferType: EPrimeTransferDataType.keylessWallet,
      },
    });
  }, [navigation]);

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
        if (restoreDevicePackRef.current) {
          try {
            await saveDevicePack({
              devicePack: restoreDevicePackRef.current,
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
      if (generatePacksRef.current) {
        return;
      }

      // Skip if already generating
      if (isGeneratingPacksRef.current) {
        return;
      }

      isGeneratingPacksRef.current = true;
      try {
        const packs = await generatePacks();
        generatePacksRef.current = packs;
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

      // Handle deviceKeyPack restore using the generic handler
      void handleRestoreShare({
        stepId: ECreationStepId.DeviceShare,
        getPack: async () => {
          return {
            pack: receivedDeviceKeyPack,
            packSetId: receivedDeviceKeyPack.packSetId,
          };
        },
        setPackRef: (pack) => {
          restoreDevicePackRef.current = pack as IDeviceKeyPack | null;
        },
        setPackSetIdRef: (id) => {
          devicePackSetIdRef.current = id;
        },
        errorMessage: 'Device key restore failed. Tap to try again.',
      });
    };

    appEventBus.on(EAppEventBusNames.PrimeTransferDataReceived, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeTransferDataReceived, fn);
    };
  }, [isRestoreMode, handleRestoreShare]);

  // Clear packs on component cleanup
  useEffect(() => {
    return () => {
      generatePacksRef.current = null;
      devicePackSetIdRef.current = null;
      cloudPackSetIdRef.current = null;
      authPackSetIdRef.current = null;
      restoreDevicePackRef.current = null;
      restoreCloudPackRef.current = null;
      restoreAuthPackRef.current = null;
      restoreValidationResultRef.current = undefined;
    };
  }, []);

  // Get visible steps (all steps are always visible in creation flow)
  // No need for useMemo here as steps is already a state variable
  const visibleSteps = steps;

  return (
    <OnboardingLayout.ConstrainedContent
      gap="$10"
      $platform-native={{
        py: '$5',
      }}
    >
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
          onStepAction: () => handleStepAction({ stepId: step.id }),
          buttonText: getButtonText({ stepId: step.id }),
        };

        if (step.id === ECreationStepId.DeviceShare) {
          let onSecondaryAction: (() => void) | undefined;
          let secondaryButtonText: string | undefined;
          if (isRestoreMode) {
            onSecondaryAction = receiveDevicePackByQrCode;
            secondaryButtonText = 'Restore from another device';
          } else if (isViewMode) {
            onSecondaryAction = handleDeviceShareViewModeSecondaryAction;
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
    </OnboardingLayout.ConstrainedContent>
  );
}
