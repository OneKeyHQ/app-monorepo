import { useCallback, useMemo } from 'react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IAuthKeyPack } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { EOnboardingV2KeylessWalletCreationMode } from '@onekeyhq/shared/src/routes/onboardingv2';

import { useKeylessWallet } from '../../../components/KeylessWallet/useKeylessWallet';

import { useKeylessWalletShareCardsCardContext } from './KeylessWalletShareCardsCardContext';
import type { IKeylessWalletShareCardProps } from './KeylessWalletShareCardsCardContext';
import type { ICreationStep } from './keylessWalletOnboardingTypes';
import { ECreationStepId } from './keylessWalletOnboardingTypes';
import { KeylessWalletShareCard } from './KeylessWalletShareCard';

export function KeylessWalletShareCardAuthKey({
  step,
  index,
  isLastStep,
}: IKeylessWalletShareCardProps) {
  const { uploadAuthPack, getAuthPackFromCache, getAuthPackFromServer } =
    useKeylessWallet();
  const { mode, refs, handleSaveShare, handleRestoreOrCheckShare } =
    useKeylessWalletShareCardsCardContext();

  const handleCreate = useCallback(async () => {
    await handleSaveShare({
      stepId: ECreationStepId.AuthShare,
      shouldMoveToNextStep: false,
      fn: async ({ generatedPacks }) => {
        if (!refs.current.packSetIds.device || !refs.current.packSetIds.cloud) {
          throw new OneKeyLocalError('Please complete device and cloud steps first.');
        }
        const result = await uploadAuthPack({
          authPack: generatedPacks.authKeyPack,
          packSetIdFromCloudPack: refs.current.packSetIds.cloud,
          packSetIdFromDevicePack: refs.current.packSetIds.device,
        });
        if (!result?.success) {
          throw new OneKeyLocalError('Failed to upload auth share');
        }
        return {
          devicePackSetId: undefined,
          cloudPackSetId: undefined,
          authPackSetId: generatedPacks.authKeyPack.packSetId,
        };
      },
    });
  }, [handleSaveShare, refs, uploadAuthPack]);

  const handleRestoreOrView = useCallback(async () => {
    await handleRestoreOrCheckShare({
      stepId: ECreationStepId.AuthShare,
      restoreTarget: 'auth',
      fn: async () => {
        let authPack: IAuthKeyPack | null = null;
        try {
          authPack = await getAuthPackFromCache();
        } catch (error) {
          console.error('Failed to get auth pack from cache:', error);
        }
        if (!authPack) {
          authPack = await getAuthPackFromServer();
        }
        if (!authPack) {
          throw new OneKeyLocalError('Server restore failed. Tap to try again.');
        }
        return { pack: authPack, packSetId: authPack.packSetId };
      },
    });
  }, [getAuthPackFromCache, getAuthPackFromServer, handleRestoreOrCheckShare]);

  const onStepAction =
    mode === EOnboardingV2KeylessWalletCreationMode.Restore ||
    mode === EOnboardingV2KeylessWalletCreationMode.View
      ? () => void handleRestoreOrView()
      : () => void handleCreate();

  let buttonText = 'Save to Server';
  if (mode === EOnboardingV2KeylessWalletCreationMode.View) {
    buttonText = 'Check';
  } else if (mode === EOnboardingV2KeylessWalletCreationMode.Restore) {
    buttonText = 'Restore from Server';
  }

  const stepWithConfig = useMemo<ICreationStep>(
    () => ({
      id: step.id,
      state: step.state,
      infoMessage: step.infoMessage,
      securityKeyType: 'auth',
      title: 'Auth Key',
      description: 'Protected by your OneKey ID',
    }),
    [step.id, step.infoMessage, step.state],
  );

  return (
    <KeylessWalletShareCard
      step={stepWithConfig}
      index={index}
      isLastStep={isLastStep}
      onStepAction={onStepAction}
      buttonText={buttonText}
    />
  );
}
