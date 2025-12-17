import { useCallback, useMemo } from 'react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOnboardingV2KeylessWalletCreationMode } from '@onekeyhq/shared/src/routes/onboardingv2';

import { useKeylessWallet } from '../../../components/KeylessWallet/useKeylessWallet';

import {
  ECreationStepId,
  type ICreationStep,
  type IKeylessShareCardProps,
} from './keylessOnboardingTypes';
import { KeylessShareCard } from './KeylessShareCard';
import { useKeylessShareCardsContext } from './KeylessShareCardsContext';

export function KeylessShareCardCloudKey({
  step,
  index,
  isLastStep,
}: IKeylessShareCardProps) {
  const { uploadCloudPack, getCloudPack } = useKeylessWallet();
  const {
    mode,
    cloudProviderType,
    handleSaveShare,
    handleRestoreOrCheckShare,
  } = useKeylessShareCardsContext();

  const handleCreate = useCallback(async () => {
    await handleSaveShare({
      stepId: ECreationStepId.CloudShare,
      fn: async ({ generatedPacks }) => {
        const result = await uploadCloudPack({
          cloudPack: generatedPacks.cloudKeyPack,
        });
        if (!result?.success) {
          throw new OneKeyLocalError('Failed to upload cloud share');
        }
        return {
          devicePackSetId: undefined,
          cloudPackSetId: result.packSetIdFromCloudPack,
          authPackSetId: undefined,
        };
      },
    });
  }, [handleSaveShare, uploadCloudPack]);

  const handleRestoreOrView = useCallback(async () => {
    await handleRestoreOrCheckShare({
      stepId: ECreationStepId.CloudShare,
      restoreTarget: 'cloud',
      fn: async () => {
        const pack = await getCloudPack();
        if (!pack) {
          throw new OneKeyLocalError(
            'Cloud backup restore failed. Tap to try again.',
          );
        }
        return { pack, packSetId: pack.packSetId };
      },
    });
  }, [getCloudPack, handleRestoreOrCheckShare]);

  const onStepAction =
    mode === EOnboardingV2KeylessWalletCreationMode.Restore ||
    mode === EOnboardingV2KeylessWalletCreationMode.View
      ? () => void handleRestoreOrView()
      : () => void handleCreate();

  let buttonText = 'Backup to Cloud';
  if (mode === EOnboardingV2KeylessWalletCreationMode.View) {
    buttonText = 'Check';
  } else if (mode === EOnboardingV2KeylessWalletCreationMode.Restore) {
    buttonText = 'Restore from Cloud';
  }

  return (
    <KeylessShareCard
      step={step}
      securityKeyType="cloud"
      title="Cloud Key"
      description={`Encrypted backup to ${cloudProviderType ?? ''}`}
      index={index}
      isLastStep={isLastStep}
      onStepAction={onStepAction}
      buttonText={buttonText}
      mode={mode}
    />
  );
}
