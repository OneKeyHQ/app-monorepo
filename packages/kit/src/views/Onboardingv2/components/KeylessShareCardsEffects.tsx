import { useEffect } from 'react';

import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import {
  ECreationStepId,
  type IKeylessShareCardsEffectsProps,
} from './keylessOnboardingTypes';

export function KeylessShareCardsEffects(
  props: IKeylessShareCardsEffectsProps,
) {
  const {
    isCreationComplete,
    isViewMode,
    handleCompleteSetup,
    isRestoreOrViewMode,
    generatePacks,
    refs,
    isRestoreMode,
    handleRestoreOrCheckShare,
  } = props;

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

  // Generate packs on mount if they don't exist (only in Create mode)
  useEffect(() => {
    // Skip in Restore/View mode
    if (isRestoreOrViewMode) {
      return;
    }

    const generatePacksOnMount = async () => {
      // Skip if packs already exist
      if (refs.current.generatedPacks) {
        return;
      }

      // Skip if already generating
      if (refs.current.isGeneratingPacks) {
        return;
      }

      refs.current.isGeneratingPacks = true;
      try {
        const packs = await generatePacks();
        refs.current.generatedPacks = packs;
      } catch (error) {
        // Handle error silently or show error state if needed
        console.error('Failed to generate packs:', error);
      } finally {
        refs.current.isGeneratingPacks = false;
      }
    };

    void generatePacksOnMount();
  }, [generatePacks, isRestoreOrViewMode, refs]);

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

      void handleRestoreOrCheckShare({
        stepId: ECreationStepId.DeviceShare,
        restoreTarget: 'device',
        fn: async () => ({
          pack: receivedDeviceKeyPack,
          packSetId: receivedDeviceKeyPack.packSetId,
        }),
      });
    };

    appEventBus.on(EAppEventBusNames.PrimeTransferDataReceived, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeTransferDataReceived, fn);
    };
  }, [handleRestoreOrCheckShare, isRestoreMode]);

  // Clear packs on component cleanup
  useEffect(() => {
    const currentRefs = refs.current;
    return () => {
      currentRefs.generatedPacks = null;
      currentRefs.isGeneratingPacks = false;
      currentRefs.packSetIds.device = null;
      currentRefs.packSetIds.cloud = null;
      currentRefs.packSetIds.auth = null;
      currentRefs.restorePacks.device = null;
      currentRefs.restorePacks.cloud = null;
      currentRefs.restorePacks.auth = null;
      currentRefs.restoreValidationResult = undefined;
    };
  }, [refs]);

  return null;
}
