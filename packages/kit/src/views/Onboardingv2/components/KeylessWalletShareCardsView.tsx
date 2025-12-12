import { useCallback, useMemo, useRef, useState } from 'react';

import { SizableText, YStack } from '@onekeyhq/components';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type {
  IAuthKeyPack,
  ICloudKeyPack,
  IDeviceKeyPack,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import {
  EOnboardingPagesV2,
  EOnboardingV2KeylessWalletCreationMode,
} from '@onekeyhq/shared/src/routes/onboardingv2';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useKeylessWallet } from '../../../components/KeylessWallet/useKeylessWallet';
import useAppNavigation from '../../../hooks/useAppNavigation';

import {
  ECreationStepId,
  ECreationStepState,
  type ICreationStep,
} from './keylessWalletOnboardingTypes';
import { KeylessWalletShareCardAuthKey } from './KeylessWalletShareCardAuthKey';
import { KeylessWalletShareCardCloudKey } from './KeylessWalletShareCardCloudKey';
import { KeylessWalletShareCardDeviceKey } from './KeylessWalletShareCardDeviceKey';
import {
  type IKeylessWalletShareCardsCardContextValue,
  type IKeylessWalletShareCardsRefs,
  KeylessWalletShareCardsCardContext,
} from './KeylessWalletShareCardsCardContext';
import { KeylessWalletShareCardsEffects } from './KeylessWalletShareCardsEffects';
import { OnboardingLayout } from './OnboardingLayout';

// Step order constant - defined outside component to avoid recreation
const STEP_ORDER = [
  ECreationStepId.DeviceShare,
  ECreationStepId.CloudShare,
  ECreationStepId.AuthShare,
] as const;

function getRestorePackCount(refs: IKeylessWalletShareCardsRefs): number {
  return [
    refs.restorePacks.device,
    refs.restorePacks.cloud,
    refs.restorePacks.auth,
  ].filter(Boolean).length;
}

export interface IKeylessWalletShareCardsViewProps {
  mode: EOnboardingV2KeylessWalletCreationMode;
}

type IStepRuntimeState = Pick<ICreationStep, 'id' | 'state' | 'infoMessage'>;

type IHandleSaveShareParams = Parameters<
  IKeylessWalletShareCardsCardContextValue['handleSaveShare']
>[0];

export function KeylessWalletShareCardsView({
  mode,
}: IKeylessWalletShareCardsViewProps) {
  const navigation = useAppNavigation();
  const { generatePacks, saveDevicePack } = useKeylessWallet();

  const isRestoreMode = mode === EOnboardingV2KeylessWalletCreationMode.Restore;
  const isViewMode = mode === EOnboardingV2KeylessWalletCreationMode.View;
  const isRestoreOrViewMode = isRestoreMode || isViewMode;

  const refs = useRef<IKeylessWalletShareCardsRefs>({
    generatedPacks: null,
    isGeneratingPacks: false,
    packSetIds: {
      device: null,
      cloud: null,
      auth: null,
    },
    restorePacks: {
      device: null,
      cloud: null,
      auth: null,
    },
    restoreValidationResult: undefined,
  });
  const [stepStates, setStepStates] = useState<IStepRuntimeState[]>(() =>
    STEP_ORDER.map((id, idx) => ({
      id,
      state:
        isRestoreOrViewMode || idx === 0
          ? ECreationStepState.Info
          : ECreationStepState.Idle,
      infoMessage: undefined,
    })),
  );

  const successCount = useMemo(
    () =>
      stepStates.filter((s) => s.state === ECreationStepState.Success).length,
    [stepStates],
  );

  // Check if all steps are complete
  const isCreationComplete = useMemo(() => {
    if (isViewMode) {
      // View mode: disable auto-complete
      return false;
    }
    if (isRestoreMode) {
      return (
        successCount >= 2 && refs.current.restoreValidationResult !== undefined
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
      setStepStates((prev) =>
        prev.map((s) => {
          if (s.id !== stepId) {
            return s;
          }
          let nextInfoMessage: string | undefined;
          if (newState === ECreationStepState.Info) {
            nextInfoMessage = infoMessage;
          } else if (newState === ECreationStepState.Error) {
            nextInfoMessage = infoMessage;
          }
          return {
            ...s,
            state: newState,
            infoMessage: nextInfoMessage,
          };
        }),
      );
    },
    [],
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
        refs.current.restorePacks.device
      ) {
        refs.current.restorePacks.device = null;
        refs.current.packSetIds.device = null;
        updateStepState({
          stepId: ECreationStepId.DeviceShare,
          newState: ECreationStepState.Info,
        });
      }
      if (
        currentStepId !== ECreationStepId.CloudShare &&
        refs.current.restorePacks.cloud
      ) {
        refs.current.restorePacks.cloud = null;
        refs.current.packSetIds.cloud = null;
        updateStepState({
          stepId: ECreationStepId.CloudShare,
          newState: ECreationStepState.Info,
        });
      }
      if (
        currentStepId !== ECreationStepId.AuthShare &&
        refs.current.restorePacks.auth
      ) {
        refs.current.restorePacks.auth = null;
        refs.current.packSetIds.auth = null;
        updateStepState({
          stepId: ECreationStepId.AuthShare,
          newState: ECreationStepState.Info,
        });
      }
      refs.current.restoreValidationResult = undefined;
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

    if (refs.current.restorePacks.device) {
      packs.deviceKeyPack = refs.current.restorePacks.device;
    }
    if (refs.current.restorePacks.cloud) {
      packs.cloudKeyPack = refs.current.restorePacks.cloud;
    }
    if (refs.current.restorePacks.auth) {
      packs.authKeyPack = refs.current.restorePacks.auth;
    }

    const packCount = getRestorePackCount(refs.current);

    if (packCount < 2) {
      refs.current.restoreValidationResult = undefined;
      return false;
    }

    try {
      const result =
        await backgroundApiProxy.serviceKeylessWallet.restoreKeylessWalletSafe(
          packs,
        );
      if (result) {
        refs.current.restoreValidationResult = result;
        return true;
      }
      // Validation failed - packs cannot restore mnemonic
      refs.current.restoreValidationResult = undefined;
      return false;
    } catch {
      refs.current.restoreValidationResult = undefined;
      return false;
    }
  }, []);

  const handleSaveShare = useCallback(
    async ({
      stepId,
      fn,
      shouldMoveToNextStep = true,
    }: IHandleSaveShareParams) => {
      if (!refs.current.generatedPacks) {
        updateStepState({
          stepId,
          newState: ECreationStepState.Error,
          infoMessage: 'Packs not generated. Please wait.',
        });
        return;
      }

      updateStepState({ stepId, newState: ECreationStepState.InProgress });

      const getDefaultErrorMessage = () => {
        switch (stepId) {
          case ECreationStepId.DeviceShare:
            return 'Device key not saved. Tap to try again.';
          case ECreationStepId.CloudShare:
            return 'Cloud backup failed. Tap to try again.';
          case ECreationStepId.AuthShare:
            return 'Server save failed. Tap to try again.';
          default:
            return 'Operation failed. Tap to try again.';
        }
      };

      try {
        const result = await fn({
          generatedPacks: refs.current.generatedPacks,
        });
        if (result?.devicePackSetId) {
          refs.current.packSetIds.device = result.devicePackSetId;
        }
        if (result?.cloudPackSetId) {
          refs.current.packSetIds.cloud = result.cloudPackSetId;
        }
        if (result?.authPackSetId) {
          refs.current.packSetIds.auth = result.authPackSetId;
        }

        updateStepState({ stepId, newState: ECreationStepState.Success });
        if (shouldMoveToNextStep) {
          moveToNextStep({ completedStepId: stepId });
        }
      } catch (error) {
        updateStepState({
          stepId,
          newState: ECreationStepState.Error,
          infoMessage:
            (error as IOneKeyError)?.message ?? getDefaultErrorMessage(),
        });
      }
    },
    [moveToNextStep, refs, updateStepState],
  );

  const handleRestoreOrCheckShare = useCallback(
    async ({
      stepId,
      restoreTarget,
      fn,
    }: Parameters<
      IKeylessWalletShareCardsCardContextValue['handleRestoreOrCheckShare']
    >[0]) => {
      updateStepState({ stepId, newState: ECreationStepState.InProgress });
      const defaultErrorMessage = () => {
        switch (stepId) {
          case ECreationStepId.DeviceShare:
            return 'Device key restore failed. Tap to try again.';
          case ECreationStepId.CloudShare:
            return 'Cloud backup restore failed. Tap to try again.';
          case ECreationStepId.AuthShare:
            return 'Server restore failed. Tap to try again.';
          default:
            return 'Operation failed. Tap to try again.';
        }
      };
      try {
        const result = await fn();
        switch (restoreTarget) {
          case 'device':
            refs.current.restorePacks.device = result.pack as IDeviceKeyPack;
            break;
          case 'cloud':
            refs.current.restorePacks.cloud = result.pack as ICloudKeyPack;
            break;
          case 'auth':
            refs.current.restorePacks.auth = result.pack as IAuthKeyPack;
            break;
          default:
            break;
        }
        refs.current.packSetIds[restoreTarget] = result.packSetId;

        const isValid = await checkRestoreValidation();
        if (isValid) {
          updateStepState({ stepId, newState: ECreationStepState.Success });
          return;
        }

        if (getRestorePackCount(refs.current) >= 2) {
          updateStepState({
            stepId,
            newState: ECreationStepState.Error,
            infoMessage:
              'Cannot restore wallet with these packs. Please try other packs.',
          });
          resetOtherPacksOnValidationFailure({ currentStepId: stepId });
          return;
        }

        updateStepState({ stepId, newState: ECreationStepState.Success });
      } catch (error) {
        updateStepState({
          stepId,
          newState: ECreationStepState.Error,
          infoMessage:
            (error as IOneKeyError)?.message ?? defaultErrorMessage(),
        });
      }
    },
    [
      checkRestoreValidation,
      refs,
      resetOtherPacksOnValidationFailure,
      updateStepState,
    ],
  );

  // NOTE: Per-component card handlers are now defined inside:
  // - KeylessWalletShareCardDeviceKey
  // - KeylessWalletShareCardCloudKey
  // - KeylessWalletShareCardAuthKey

  const cardContextValue = useMemo<IKeylessWalletShareCardsCardContextValue>(
    () => ({
      mode,
      refs,
      handleSaveShare,
      handleRestoreOrCheckShare,
    }),
    [handleRestoreOrCheckShare, handleSaveShare, mode, refs],
  );

  // Handle "Complete Setup" - navigate to finalize wallet setup
  const handleCompleteSetup = useCallback(async () => {
    // Priority: Auth > Cloud > Device
    const packSetId =
      refs.current.packSetIds.auth ??
      refs.current.packSetIds.cloud ??
      refs.current.packSetIds.device;

    // If restore mode, save device pack
    if (isRestoreMode) {
      try {
        // Save device pack if available
        if (refs.current.restorePacks.device) {
          try {
            await saveDevicePack({
              devicePack: refs.current.restorePacks.device,
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

  return (
    <>
      <KeylessWalletShareCardsEffects
        isCreationComplete={isCreationComplete}
        isViewMode={isViewMode}
        handleCompleteSetup={handleCompleteSetup}
        isRestoreOrViewMode={isRestoreOrViewMode}
        generatePacks={generatePacks}
        refs={refs}
        isRestoreMode={isRestoreMode}
        handleRestoreOrCheckShare={handleRestoreOrCheckShare}
      />
      <KeylessWalletShareCardsCardContext.Provider value={cardContextValue}>
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

          {stepStates.map((step, index) => {
            const isLastStep = index === stepStates.length - 1;
            if (step.id === ECreationStepId.DeviceShare) {
              return (
                <KeylessWalletShareCardDeviceKey
                  key={step.id}
                  step={step}
                  index={index}
                  isLastStep={isLastStep}
                />
              );
            }
            if (step.id === ECreationStepId.CloudShare) {
              return (
                <KeylessWalletShareCardCloudKey
                  key={step.id}
                  step={step}
                  index={index}
                  isLastStep={isLastStep}
                />
              );
            }
            if (step.id === ECreationStepId.AuthShare) {
              return (
                <KeylessWalletShareCardAuthKey
                  key={step.id}
                  step={step}
                  index={index}
                  isLastStep={isLastStep}
                />
              );
            }
            return null;
          })}
        </OnboardingLayout.ConstrainedContent>
      </KeylessWalletShareCardsCardContext.Provider>
    </>
  );
}
