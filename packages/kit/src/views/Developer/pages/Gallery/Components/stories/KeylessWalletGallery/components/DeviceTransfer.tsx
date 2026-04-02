import { useState } from 'react';

import {
  Button,
  Dialog,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IKeylessWalletPacks } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { EPrimeTransferDataType } from '@onekeyhq/shared/types/prime/primeTransferTypes';

interface IDeviceTransferProps {
  packs: IKeylessWalletPacks | null;
}

export const DeviceTransfer = ({ packs }: IDeviceTransferProps) => {
  const navigation = useAppNavigation();
  const [deviceTransferResult, setDeviceTransferResult] = useState('');

  return (
    <YStack gap="$4">
      <SizableText size="$bodyMd" color="$textSubdued">
        Transfer DeviceKeyPack between devices via QR code pairing
      </SizableText>

      <XStack gap="$2" flexWrap="wrap">
        <Button
          size="small"
          variant="primary"
          disabled={!packs?.deviceKeyPack?.packSetId}
          onPress={async () => {
            if (!packs?.deviceKeyPack) {
              setDeviceTransferResult(
                '❌ Error: No deviceKeyPack available. Create wallet first.',
              );
              return;
            }
            try {
              setDeviceTransferResult(
                '⏳ DeviceKeyPack stored. Opening transfer page...',
              );

              navigation.pushModal(EModalRoutes.PrimeModal, {
                screen: EPrimePages.PrimeTransfer,
                params: {
                  defaultTab: 'enter-link',
                  transferType: EPrimeTransferDataType.keylessWallet,
                },
              });
            } catch (e: unknown) {
              setDeviceTransferResult(`❌ Error: ${(e as Error)?.message}`);
            }
          }}
        >
          Send DeviceKeyPack
        </Button>

        <Button
          size="small"
          onPress={async () => {
            try {
              setDeviceTransferResult('⏳ Opening QR code for receiving...');

              navigation.pushModal(EModalRoutes.PrimeModal, {
                screen: EPrimePages.PrimeTransfer,
                params: {
                  defaultTab: 'qr-code',
                  transferType: EPrimeTransferDataType.keylessWallet,
                },
              });
            } catch (e: unknown) {
              setDeviceTransferResult(`❌ Error: ${(e as Error)?.message}`);
            }
          }}
        >
          Receive DeviceKeyPack
        </Button>

        <Button
          size="small"
          variant="tertiary"
          onPress={() => {
            const pendingPack = {};
            if (pendingPack) {
              Dialog.debugMessage({
                debugMessage: {
                  pendingDeviceKeyPack: pendingPack,
                },
              });
            } else {
              setDeviceTransferResult(
                '⚠️ No pending DeviceKeyPack in globalThis',
              );
            }
          }}
        >
          View Pending DeviceKeyPack
        </Button>

        <Button
          size="small"
          variant="tertiary"
          onPress={() => {
            setDeviceTransferResult('✅ Cleared pending DeviceKeyPack');
          }}
        >
          Clear Pending
        </Button>
      </XStack>

      {packs?.deviceKeyPack?.packSetId ? (
        <YStack gap="$1" p="$2" borderRadius="$2" bg="$bgSubdued">
          <SizableText size="$bodySm" color="$textSubdued">
            packSetId: {packs.deviceKeyPack.packSetId}
          </SizableText>
        </YStack>
      ) : (
        <SizableText size="$bodySm" color="$textCaution">
          No packs available. Click "Create Wallet" first.
        </SizableText>
      )}

      {deviceTransferResult ? (
        <YStack gap="$2" p="$3" borderRadius="$2" bg="$bgSubdued">
          <SizableText size="$headingSm">Transfer Result:</SizableText>
          <SizableText size="$bodyMd" selectable>
            {deviceTransferResult}
          </SizableText>
        </YStack>
      ) : null}
    </YStack>
  );
};
