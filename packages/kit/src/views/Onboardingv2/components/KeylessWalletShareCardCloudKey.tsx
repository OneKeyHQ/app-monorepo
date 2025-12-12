import { useCallback, useMemo } from 'react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOnboardingV2KeylessWalletCreationMode } from '@onekeyhq/shared/src/routes/onboardingv2';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useKeylessWallet } from '../../../components/KeylessWallet/useKeylessWallet';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import { useKeylessWalletShareCardsCardContext } from './KeylessWalletShareCardsCardContext';
import type { IKeylessWalletShareCardProps } from './KeylessWalletShareCardsCardContext';
import type { ICreationStep } from './keylessWalletOnboardingTypes';
import { ECreationStepId } from './keylessWalletOnboardingTypes';
import { KeylessWalletShareCard } from './KeylessWalletShareCard';

export function KeylessWalletShareCardCloudKey({
  step,
  index,
  isLastStep,
}: IKeylessWalletShareCardProps) {
  const { uploadCloudPack, getCloudPack } = useKeylessWallet();
  const { mode, handleSaveShare, handleRestoreOrCheckShare } =
    useKeylessWalletShareCardsCardContext();

  const { result: cloudProviderType } = usePromiseResult(async () => {
    const isSupportCloudBackup =
      await backgroundApiProxy.serviceCloudBackupV2.supportCloudBackup();
    if (!isSupportCloudBackup) {
      return undefined;
    }
    const cloudAccountInfo =
      await backgroundApiProxy.serviceCloudBackupV2.getCloudAccountInfo();
    return cloudAccountInfo?.providerType;
  }, []);

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
          cloudPackSetId: result.packSetInFromCloudPack,
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
          throw new OneKeyLocalError('Cloud backup restore failed. Tap to try again.');
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

  const stepWithConfig = useMemo<ICreationStep>(
    () => ({
      id: step.id,
      state: step.state,
      infoMessage: step.infoMessage,
      securityKeyType: 'cloud',
      title: 'Cloud Key',
      description: `Encrypted backup to ${cloudProviderType ?? ''}`,
    }),
    [cloudProviderType, step.id, step.infoMessage, step.state],
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
