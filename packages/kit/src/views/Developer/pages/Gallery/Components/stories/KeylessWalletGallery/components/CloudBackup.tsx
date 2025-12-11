import { useState } from 'react';

import { isEqual } from 'lodash';

import {
  Button,
  Checkbox,
  Dialog,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IKeylessWalletPacks } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { findMismatchedPaths } from '@onekeyhq/shared/src/utils/miscUtils';

interface ICloudBackupProps {
  packs: IKeylessWalletPacks | null;
}

export const CloudBackup = ({ packs }: ICloudBackupProps) => {
  const [cloudBackupResult, setCloudBackupResult] = useState('');
  const [cloudRestoreResult, setCloudRestoreResult] = useState('');
  const [allowDuplicate, setAllowDuplicate] = useState(true);

  return (
    <YStack gap="$4">
      <SizableText size="$bodyMd" color="$textSubdued">
        Backup and restore CloudKeyPack to/from cloud storage (iCloud / Google
        Drive)
      </SizableText>

      <Checkbox
        label="Allow Duplicate Backup"
        value={allowDuplicate}
        onChange={(v) => setAllowDuplicate(!!v)}
      />

      <XStack gap="$2" flexWrap="wrap">
        <Button
          size="small"
          variant="primary"
          disabled={!packs?.cloudKeyPack?.packSetId}
          onPress={async () => {
            if (!packs?.cloudKeyPack) {
              setCloudBackupResult(
                '❌ Error: No cloudKeyPack available. Create wallet first.',
              );
              return;
            }
            try {
              setCloudBackupResult('⏳ Backing up...');
              const result =
                await backgroundApiProxy.serviceKeylessWallet.backupCloudKeyPack(
                  {
                    payload: {
                      cloudKeyPack: packs.cloudKeyPack,
                    },
                    allowDuplicate,
                  },
                );
              setCloudBackupResult(
                `✅ Backup success!\nrecordID: ${result.recordID}\nmeta: ${result.meta}`,
              );
            } catch (e: any) {
              setCloudBackupResult(`❌ Error: ${(e as Error)?.message}`);
            }
          }}
        >
          Backup CloudKeyPack
        </Button>

        <Button
          size="small"
          disabled={!packs?.cloudKeyPack?.packSetId}
          onPress={async () => {
            if (!packs?.cloudKeyPack?.packSetId) {
              setCloudRestoreResult(
                '❌ Error: No packSetId available. Create wallet first.',
              );
              return;
            }
            try {
              setCloudRestoreResult('⏳ Restoring...');
              const result =
                await backgroundApiProxy.serviceKeylessWallet.restoreCloudKeyPack(
                  {
                    packSetId: packs.cloudKeyPack.packSetId,
                  },
                );

              const isMatch = isEqual(result.cloudKeyPack, packs.cloudKeyPack);

              if (isMatch) {
                setCloudRestoreResult(
                  `✅ Restore success! CloudKeyPack matches.\npackSetId: ${
                    result.cloudKeyPack?.packSetId ?? 'N/A'
                  }`,
                );
              } else {
                const mismatchedPaths = findMismatchedPaths(
                  result.cloudKeyPack,
                  packs.cloudKeyPack,
                );
                setCloudRestoreResult(
                  `⚠️ Restore completed but CloudKeyPack mismatch!\npackSetId: ${
                    result.cloudKeyPack?.packSetId ?? 'N/A'
                  }`,
                );
                Dialog.debugMessage({
                  debugMessage: {
                    isMatch,
                    mismatchedPaths,
                    restored: result.cloudKeyPack,
                    expected: packs.cloudKeyPack,
                  },
                });
              }
            } catch (e: any) {
              setCloudRestoreResult(`❌ Error: ${(e as Error)?.message}`);
            }
          }}
        >
          Restore CloudKeyPack
        </Button>

        <Button
          size="small"
          variant="tertiary"
          disabled={!packs?.cloudKeyPack}
          onPress={() => {
            if (packs?.cloudKeyPack) {
              Dialog.debugMessage({
                debugMessage: {
                  packSetId: packs.cloudKeyPack.packSetId,
                  cloudKeyPack: packs.cloudKeyPack,
                },
              });
            }
          }}
        >
          View CloudKeyPack
        </Button>
      </XStack>

      {packs?.cloudKeyPack?.packSetId ? (
        <YStack gap="$1" p="$2" borderRadius="$2" bg="$bgSubdued">
          <SizableText size="$bodySm" color="$textSubdued">
            packSetId: {packs.cloudKeyPack.packSetId}
          </SizableText>
        </YStack>
      ) : (
        <SizableText size="$bodySm" color="$textCaution">
          No packs available. Click "Create Wallet" first.
        </SizableText>
      )}

      {cloudBackupResult ? (
        <YStack gap="$2" p="$3" borderRadius="$2" bg="$bgSubdued">
          <SizableText size="$headingSm">Backup Result:</SizableText>
          <SizableText size="$bodyMd" selectable>
            {cloudBackupResult}
          </SizableText>
        </YStack>
      ) : null}

      {cloudRestoreResult ? (
        <YStack gap="$2" p="$3" borderRadius="$2" bg="$bgSubdued">
          <SizableText size="$headingSm">Restore Result:</SizableText>
          <SizableText size="$bodyMd" selectable>
            {cloudRestoreResult}
          </SizableText>
        </YStack>
      ) : null}
    </YStack>
  );
};
