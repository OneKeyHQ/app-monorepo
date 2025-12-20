import { useCallback, useMemo } from 'react';

import { SizableText } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOnboardingV2KeylessWalletCreationMode } from '@onekeyhq/shared/src/routes/onboardingv2';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useKeylessWallet } from '../../../components/KeylessWallet/useKeylessWallet';

import {
  ECreationStepId,
  type ICreationStep,
  type IKeylessShareCardProps,
} from './keylessOnboardingTypes';
import { KeylessShareCard } from './KeylessShareCard';
import { useKeylessShareCardsContext } from './KeylessShareCardsContext';

export function KeylessShareCardDeviceKey({
  step,
  index,
  isLastStep,
}: IKeylessShareCardProps) {
  const {
    saveDevicePack,
    getDevicePack,
    receiveDevicePackByQrCode,
    sendDevicePackByQrCode,
  } = useKeylessWallet();
  const { mode, handleSaveShare, handleRestoreOrCheckShare } =
    useKeylessShareCardsContext();

  const handleCreate = useCallback(async () => {
    await handleSaveShare({
      stepId: ECreationStepId.DeviceShare,
      fn: async ({ generatedPacks }) => {
        await backgroundApiProxy.servicePassword.promptPasswordVerify();
        const result = await saveDevicePack({
          devicePack: generatedPacks.deviceKeyPack,
        });
        if (!result?.success) {
          throw new OneKeyLocalError('Failed to save device share');
        }
        return {
          devicePackSetId: result.packSetIdFromDevicePack,
          cloudPackSetId: undefined,
          authPackSetId: undefined,
        };
      },
    });
  }, [handleSaveShare, saveDevicePack]);

  const handleRestoreOrView = useCallback(async () => {
    await handleRestoreOrCheckShare({
      stepId: ECreationStepId.DeviceShare,
      restoreTarget: 'device',
      fn: async () => {
        const pack = await getDevicePack();
        if (!pack) {
          throw new OneKeyLocalError(
            'Device key restore failed. Tap to try again.',
          );
        }
        return { pack, packSetId: pack.packSetId };
      },
    });
  }, [getDevicePack, handleRestoreOrCheckShare]);

  const onStepAction =
    mode === EOnboardingV2KeylessWalletCreationMode.Restore ||
    mode === EOnboardingV2KeylessWalletCreationMode.View
      ? () => void handleRestoreOrView()
      : () => void handleCreate();

  let buttonText = 'Save to Device';
  if (mode === EOnboardingV2KeylessWalletCreationMode.View) {
    buttonText = 'Check';
  } else if (mode === EOnboardingV2KeylessWalletCreationMode.Restore) {
    buttonText = 'Restore from Device';
  }

  let onSecondaryAction: (() => void) | undefined;
  let secondaryButtonText: string | undefined;
  if (mode === EOnboardingV2KeylessWalletCreationMode.Restore) {
    onSecondaryAction = receiveDevicePackByQrCode;
    secondaryButtonText = 'Restore from another device';
  } else if (mode === EOnboardingV2KeylessWalletCreationMode.View) {
    onSecondaryAction = sendDevicePackByQrCode;
    // TODO: Replace with i18n key once available.
    secondaryButtonText = 'Send to another device';
  }

  return (
    <KeylessShareCard
      step={step}
      securityKeyType="device"
      title="Device Key"
      description={
        <>
          Encrypted with your{' '}
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            passcode
          </SizableText>
          .
        </>
      }
      index={index}
      isLastStep={isLastStep}
      onStepAction={onStepAction}
      buttonText={buttonText}
      onSecondaryAction={onSecondaryAction}
      secondaryButtonText={secondaryButtonText}
      mode={mode}
    />
  );
}
