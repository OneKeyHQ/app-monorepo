import { useCallback, useState } from 'react';

import {
  Alert,
  Button,
  Dialog,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useKeylessWallet } from '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import type { IKeylessWalletPacks } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';

import { StepRenderer } from './StepRenderer';

import type { IStepState } from './types';

export const KeylessWalletCreationFlow = () => {
  const { generatePacks, saveDevicePack, uploadCloudPack, uploadAuthPack } =
    useKeylessWallet();
  const { logout } = useOneKeyAuth();

  const [step1, setStep1] = useState<IStepState>({ status: 'pending' });
  const [step2, setStep2] = useState<IStepState>({ status: 'pending' });
  const [step3, setStep3] = useState<IStepState>({ status: 'pending' });
  const [step4, setStep4] = useState<IStepState>({ status: 'pending' });

  const [generatedPacks, setGeneratedPacks] =
    useState<IKeylessWalletPacks | null>(null);
  const [packSetIdFromDevicePack, setpackSetIdFromDevicePack] =
    useState<string>('');
  const [packSetIdFromCloudPack, setpackSetIdFromCloudPack] =
    useState<string>('');

  const handleStep1 = useCallback(async () => {
    try {
      setStep1({ status: 'loading' });
      const packs = await generatePacks();
      setGeneratedPacks(packs);
      setStep1({ status: 'success', result: packs });
    } catch (e: any) {
      const errorMessage = (e as Error)?.message ?? 'Unknown error';
      setStep1({ status: 'error', error: errorMessage });
    }
  }, [generatePacks]);

  const handleStep2 = useCallback(async () => {
    if (!generatedPacks) {
      setStep2({ status: 'error', error: 'No packs generated' });
      return;
    }
    try {
      setStep2({ status: 'loading' });
      const result = await saveDevicePack({
        devicePack: generatedPacks.deviceKeyPack,
      });
      setpackSetIdFromDevicePack(result.packSetIdFromDevicePack);
      setStep2({ status: 'success', result });
    } catch (e: any) {
      const errorMessage = (e as Error)?.message ?? 'Unknown error';
      setStep2({ status: 'error', error: errorMessage });
      console.error(e);
    }
  }, [generatedPacks, saveDevicePack]);

  const handleStep3 = useCallback(async () => {
    if (!generatedPacks) {
      setStep3({ status: 'error', error: 'No packs generated' });
      return;
    }
    try {
      setStep3({ status: 'loading' });
      const result = await uploadCloudPack({
        cloudPack: generatedPacks.cloudKeyPack,
      });
      setpackSetIdFromCloudPack(result.packSetIdFromCloudPack);
      setStep3({ status: 'success', result });
    } catch (e: any) {
      const errorMessage = (e as Error)?.message ?? 'Unknown error';
      setStep3({ status: 'error', error: errorMessage });
      console.error(e);
    }
  }, [generatedPacks, uploadCloudPack]);

  const handleStep4 = useCallback(async () => {
    if (!generatedPacks) {
      setStep4({ status: 'error', error: 'No packs generated' });
      return;
    }
    if (!packSetIdFromDevicePack || !packSetIdFromCloudPack) {
      setStep4({
        status: 'error',
        error: 'Previous steps not completed',
      });
      return;
    }
    try {
      setStep4({ status: 'loading' });
      const result = await uploadAuthPack({
        authPack: generatedPacks.authKeyPack,
        packSetIdFromCloudPack,
        packSetIdFromDevicePack,
      });
      setStep4({ status: 'success', result });
    } catch (e: any) {
      const errorMessage = (e as Error)?.message ?? 'Unknown error';
      setStep4({ status: 'error', error: errorMessage });
      console.error(e);
    }
  }, [
    generatedPacks,
    packSetIdFromCloudPack,
    packSetIdFromDevicePack,
    uploadAuthPack,
  ]);

  const resetFlowStatus = useCallback(() => {
    setStep1({ status: 'pending' });
    setStep2({ status: 'pending' });
    setStep3({ status: 'pending' });
    setStep4({ status: 'pending' });
    setGeneratedPacks(null);
    setpackSetIdFromDevicePack('');
    setpackSetIdFromCloudPack('');

    Toast.success({
      title: 'Flow Status Reset',
      message: 'Flow status has been reset.',
    });
  }, []);

  return (
    <YStack gap="$4">
      <SizableText size="$bodyMd" color="$textSubdued">
        Complete Keyless Wallet Creation Flow: Generate shares → Save device
        share → Upload cloud share → Upload auth share
      </SizableText>

      <XStack gap="$2" flexWrap="wrap">
        <Button size="small" variant="secondary" onPress={resetFlowStatus}>
          Reset Flow Status
        </Button>

        <Button
          size="small"
          variant="secondary"
          onPress={async () => {
            await backgroundApiProxy.servicePassword.clearCachedPassword();
            Toast.success({
              title: 'Memory Passcode Cleared',
              message: 'Memory passcode has been cleared.',
            });
          }}
        >
          Clear Memory Passcode
        </Button>

        <Button
          size="small"
          variant="secondary"
          onPress={async () => {
            await logout();
            Toast.success({
              title: 'OneKey ID Logged Out',
              message: 'OneKey ID has been logged out.',
            });
          }}
        >
          Logout OneKey ID
        </Button>
      </XStack>

      <YStack gap="$3">
        <StepRenderer
          stepNumber={1}
          title="Generate shares"
          state={step1}
          onPress={handleStep1}
          disabled={false}
        />
        <StepRenderer
          stepNumber={2}
          title="Save Device Share"
          state={step2}
          onPress={handleStep2}
          disabled={step1.status !== 'success'}
        />
        <StepRenderer
          stepNumber={3}
          title="Upload Cloud Share"
          state={step3}
          onPress={handleStep3}
          disabled={step2.status !== 'success'}
        />
        <StepRenderer
          stepNumber={4}
          title="Upload Auth Share"
          state={step4}
          onPress={handleStep4}
          disabled={step3.status !== 'success'}
        />
      </YStack>

      {step4.status === 'success' ? (
        <Alert
          type="success"
          title="Complete!"
          description="All steps completed successfully. Keyless wallet creation flow is done."
        />
      ) : null}

      {generatedPacks ? (
        <YStack gap="$2" p="$3" borderRadius="$2" bg="$bgSubdued">
          <SizableText size="$headingSm">Generated Packs Info:</SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            packSetId: {generatedPacks.deviceKeyPack.packSetId}
          </SizableText>
          {packSetIdFromDevicePack ? (
            <SizableText size="$bodySm" color="$textSubdued">
              packSetIdFromDevicePack: {packSetIdFromDevicePack}
            </SizableText>
          ) : null}
          {packSetIdFromCloudPack ? (
            <SizableText size="$bodySm" color="$textSubdued">
              packSetIdFromCloudPack: {packSetIdFromCloudPack}
            </SizableText>
          ) : null}
          <Button
            size="small"
            variant="secondary"
            onPress={() => {
              Dialog.debugMessage({
                debugMessage: {
                  generatedPacks,
                  step1: step1.result,
                  step2: step2.result,
                  step3: step3.result,
                  step4: step4.result,
                },
              });
            }}
          >
            View All Results
          </Button>
        </YStack>
      ) : null}
    </YStack>
  );
};
