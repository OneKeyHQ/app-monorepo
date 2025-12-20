import { useCallback, useState } from 'react';

import {
  Button,
  Dialog,
  Icon,
  IconButton,
  SizableText,
  Stack,
  Table,
  Toast,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IKeylessWalletPacks } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { findMismatchedPaths } from '@onekeyhq/shared/src/utils/miscUtils';

import { isPacksEqual } from '../utils';

interface IPacksManagementProps {
  packs: IKeylessWalletPacks | null;
  onPacksChange?: (packs: IKeylessWalletPacks) => void;
}

export const PacksManagement = ({
  packs,
  onPacksChange,
}: IPacksManagementProps) => {
  const { copyText } = useClipboard();

  const [isGeneratingPacks, setIsGeneratingPacks] = useState(false);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [isGettingUserInfo, setIsGettingUserInfo] = useState(false);

  const [selectedPacks, setSelectedPacks] = useState<Set<string>>(new Set());

  const [restoredDecryptedData, setRestoredDecryptedData] = useState<{
    authKeyPackData?: any;
    deviceKeyPackData?: any;
    cloudKeyPackData?: any;
    packs?: any;
  } | null>(null);

  const [createdWallet, setCreatedWallet] = useState<IDBWallet | null>(null);
  const [createdIndexedAccount, setCreatedIndexedAccount] =
    useState<IDBIndexedAccount | null>(null);
  const [createWalletError, setCreateWalletError] = useState<string>('');

  const togglePackSelection = useCallback((packName: string) => {
    setSelectedPacks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(packName)) {
        newSet.delete(packName);
      } else {
        newSet.add(packName);
      }
      return newSet;
    });
  }, []);

  const handleCopyAllToClipboard = useCallback(() => {
    if (!packs) {
      Toast.error({
        title: 'No packs available',
        message: 'Please generate wallet packs first.',
      });
      return;
    }

    const allPacksData: Record<string, any> = {
      DeviceKeyPack: packs.deviceKeyPack,
      CloudKeyPack: packs.cloudKeyPack,
      AuthKeyPack: packs.authKeyPack,
    };

    allPacksData.restoredDecryptedData = restoredDecryptedData;

    const jsonString = JSON.stringify(allPacksData, null, 2);
    void copyText(jsonString);
    Toast.success({
      title: 'Copied to clipboard',
      message: 'All packs data has been copied.',
    });
  }, [packs, restoredDecryptedData, copyText]);

  const handleRecovery = useCallback(async () => {
    if (selectedPacks.size !== 2) {
      Dialog.confirm({
        icon: 'ErrorOutline',
        tone: 'warning',
        title: 'Error',
        description: 'Please select exactly 2 packs for recovery',
      });
      return;
    }

    if (!packs) {
      Dialog.confirm({
        icon: 'ErrorOutline',
        tone: 'warning',
        title: 'Error',
        description: 'No packs available. Create wallet first.',
      });
      return;
    }

    try {
      const restoredResult =
        await backgroundApiProxy.serviceKeylessWallet.restoreKeylessWallet({
          deviceKeyPack: selectedPacks.has('DeviceKeyPack')
            ? packs.deviceKeyPack
            : undefined,
          cloudKeyPack: selectedPacks.has('CloudKeyPack')
            ? packs.cloudKeyPack
            : undefined,
          authKeyPack: selectedPacks.has('AuthKeyPack')
            ? packs.authKeyPack
            : undefined,
        });
      const result = restoredResult.packs;

      const errors: string[] = [];

      if (result.mnemonic !== packs.mnemonic) {
        errors.push('Mnemonic mismatch');
      }
      if (result.deviceKey !== packs.deviceKey) {
        errors.push('DeviceKey mismatch');
      }
      if (result.authKey !== packs.authKey) {
        errors.push(`AuthKey mismatch: ${result.authKey} !== ${packs.authKey}`);
      }
      if (result.cloudKey !== packs.cloudKey) {
        errors.push('CloudKey mismatch');
      }
      if (result.deviceKeyPwdSlice !== packs.deviceKeyPwdSlice) {
        errors.push('DeviceKeyPwdSlice mismatch');
      }
      if (result.cloudKeyPwdSlice !== packs.cloudKeyPwdSlice) {
        errors.push('CloudKeyPwdSlice mismatch');
      }
      if (result.authKeyPwdSlice !== packs.authKeyPwdSlice) {
        errors.push('AuthKeyPwdSlice mismatch');
      }

      if (!isPacksEqual(result, packs)) {
        const mismatchedPaths = findMismatchedPaths(result, packs);
        Dialog.debugMessage({
          debugMessage: {
            mismatchedPaths,
            result,
            packs,
          },
        });
        errors.push('Packs mismatch');
      }

      setRestoredDecryptedData({
        authKeyPackData: restoredResult.authKeyPackData,
        deviceKeyPackData: restoredResult.deviceKeyPackData,
        cloudKeyPackData: restoredResult.cloudKeyPackData,
        packs: restoredResult.packs,
      });

      if (errors.length > 0) {
        Dialog.confirm({
          icon: 'ErrorOutline',
          tone: 'destructive',
          title: 'Recovery Failed',
          description: `Verification errors:\n${errors.join('\n')}`,
        });
      } else {
        Dialog.confirm({
          icon: 'CheckLargeOutline',
          tone: 'success',
          title: 'Recovery Success',
          description:
            'All keys and password slices match! Recovery verified successfully. Click "View Decrypted Data" to see the decrypted pack data.',
        });
      }
    } catch (e: any) {
      Dialog.confirm({
        icon: 'ErrorOutline',
        tone: 'destructive',
        title: 'Recovery Error',
        description: (e as Error)?.message ?? 'Unknown error',
      });
    }
  }, [selectedPacks, packs]);

  const createKeylessWallet = useCallback(async () => {
    if (isCreatingWallet) return;
    const packSetId =
      packs?.deviceKeyPack?.packSetId ??
      packs?.cloudKeyPack?.packSetId ??
      packs?.authKeyPack?.packSetId;
    if (!packSetId) {
      Dialog.confirm({
        icon: 'ErrorOutline',
        tone: 'warning',
        title: 'Error',
        description: 'No packs available. Please generate wallet packs first.',
      });
      return;
    }

    try {
      setIsCreatingWallet(true);
      setCreateWalletError('');
      const result =
        await backgroundApiProxy.serviceKeylessWallet.createKeylessWallet({
          packSetId,
        });
      setCreatedWallet(result.wallet);
      setCreatedIndexedAccount(result.indexedAccount ?? null);
      Dialog.confirm({
        icon: 'CheckLargeOutline',
        tone: 'success',
        title: 'Wallet Created Successfully',
        description: `Wallet "${result.wallet.name}" has been created successfully!`,
      });
    } catch (e: any) {
      const errorMessage = (e as Error)?.message ?? 'Unknown error';
      setCreateWalletError(errorMessage);
      setCreatedWallet(null);
      setCreatedIndexedAccount(null);
      Dialog.confirm({
        icon: 'ErrorOutline',
        tone: 'destructive',
        title: 'Create Wallet Error',
        description: errorMessage,
      });
    } finally {
      setIsCreatingWallet(false);
    }
  }, [packs, isCreatingWallet]);

  const generateKeylessWalletPacks = useCallback(async () => {
    if (isGeneratingPacks) return;
    try {
      setIsGeneratingPacks(true);
      const result =
        await backgroundApiProxy.serviceKeylessWallet.generateKeylessWalletPacks();
      onPacksChange?.(result);
    } finally {
      setIsGeneratingPacks(false);
    }
  }, [isGeneratingPacks, onPacksChange]);

  return (
    <YStack gap="$4">
      <Button
        onPress={generateKeylessWalletPacks}
        variant="primary"
        loading={isGeneratingPacks}
        disabled={isGeneratingPacks}
      >
        Generate Wallet Packs
      </Button>
      <Button
        onPress={createKeylessWallet}
        variant="primary"
        loading={isCreatingWallet}
        disabled={isCreatingWallet}
      >
        Create Wallet
      </Button>
      <Button
        onPress={async () => {
          if (isGettingUserInfo) return;
          try {
            setIsGettingUserInfo(true);
            const result =
              await backgroundApiProxy.serviceKeylessWallet.buildKeylessWalletUserInfo();
            Dialog.debugMessage({
              debugMessage: result,
            });
          } finally {
            setIsGettingUserInfo(false);
          }
        }}
        loading={isGettingUserInfo}
        disabled={isGettingUserInfo}
      >
        Keyless Wallet User Info
      </Button>

      {createWalletError ? (
        <YStack gap="$2" p="$3" borderRadius="$2" bg="$bgCriticalSubdued">
          <SizableText size="$headingSm" color="$textCritical">
            Create Wallet Error:
          </SizableText>
          <SizableText size="$bodyMd" color="$textCritical" selectable>
            {createWalletError}
          </SizableText>
        </YStack>
      ) : null}

      {createdWallet ? (
        <YStack gap="$2" p="$3" borderRadius="$2" bg="$bgSuccessSubdued">
          <SizableText size="$headingSm" color="$textSuccess">
            ✅ Wallet Created Successfully
          </SizableText>
          <Table
            dataSource={[
              { key: 'Wallet ID', value: createdWallet.id },
              { key: 'Wallet Name', value: createdWallet.name },
              { key: 'Wallet Type', value: createdWallet.type },
              {
                key: 'Wallet No',
                value: String(createdWallet.walletNo ?? '-'),
              },
              {
                key: 'Backuped',
                value: createdWallet.backuped ? 'Yes' : 'No',
              },
              {
                key: 'Accounts Count',
                value: String(createdWallet.accounts?.length ?? 0),
              },
              {
                key: 'Avatar Info',
                value: createdWallet.avatarInfo
                  ? JSON.stringify(createdWallet.avatarInfo)
                  : '-',
              },
              {
                key: 'Indexed Account ID',
                value: createdIndexedAccount?.id ?? '-',
              },
              {
                key: 'Indexed Account Name',
                value: createdIndexedAccount?.name ?? '-',
              },
            ]}
            columns={[
              { title: 'Key', dataIndex: 'key', columnWidth: 160 },
              { title: 'Value', dataIndex: 'value', columnWidth: 300 },
            ]}
            keyExtractor={(item: { key: string; value?: string }) => item.key}
            rowProps={{
              borderBottomWidth: 1,
              borderColor: '$borderSubdued',
              borderRadius: 0,
              px: '$3',
              py: 0,
            }}
            headerRowProps={{
              bg: '$bgSubdued',
              borderRadius: 0,
              px: '$3',
              py: '$3',
            }}
          />
          <XStack gap="$2" flexWrap="wrap">
            <Button
              size="small"
              variant="secondary"
              onPress={() => {
                Dialog.debugMessage({
                  debugMessage: {
                    wallet: createdWallet,
                    indexedAccount: createdIndexedAccount,
                  },
                });
              }}
            >
              View Full Wallet Data
            </Button>
          </XStack>
        </YStack>
      ) : (
        <SizableText size="$bodySm" color="$textSubdued">
          No wallet created yet. Click "Create Wallet" to create one.
        </SizableText>
      )}

      <SizableText size="$headingMd">Recovery From Packs:</SizableText>
      <Button onPress={handleCopyAllToClipboard}>CopyAllToClipboard</Button>
      {packs ? (
        <YStack gap="$2">
          {[
            {
              name: 'DeviceKeyPack',
              pack: packs.deviceKeyPack,
            },
            {
              name: 'CloudKeyPack',
              pack: packs.cloudKeyPack,
            },
            {
              name: 'AuthKeyPack',
              pack: packs.authKeyPack,
            },
          ].map(({ name, pack }) => {
            const isSelected = selectedPacks.has(name);
            return (
              <XStack
                key={name}
                alignItems="center"
                justifyContent="space-between"
                gap="$3"
                px="$3"
                py="$2"
                borderRadius="$2"
                bg={isSelected ? '$bgActive' : '$bgSubdued'}
                pressStyle={{ opacity: 0.7 }}
                onPress={() => togglePackSelection(name)}
              >
                <Icon
                  name="CheckRadioSolid"
                  size="$5"
                  color={isSelected ? '$iconSuccess' : '$iconDisabled'}
                />
                <Stack flex={1}>
                  <SizableText size="$bodyMd">{name}</SizableText>
                  {Object.entries(pack).map(([key, value]) => (
                    <XStack key={key} gap="$1">
                      <SizableText
                        size="$bodySm"
                        color="$textSubdued"
                        fontWeight="bold"
                      >
                        {key}:
                      </SizableText>
                      <SizableText
                        size="$bodySm"
                        color="$textSubdued"
                        flexShrink={1}
                      >
                        {typeof value === 'string' && value.length > 20
                          ? `${value.slice(0, 30)}...`
                          : String(value ?? '-')}
                      </SizableText>
                    </XStack>
                  ))}
                </Stack>
                <IconButton
                  icon="EyeOutline"
                  size="small"
                  variant="tertiary"
                  onPress={(e) => {
                    e.stopPropagation();
                    Dialog.debugMessage({
                      debugMessage: pack,
                    });
                  }}
                />
              </XStack>
            );
          })}
          <XStack gap="$2" flexWrap="wrap">
            <Button
              variant="primary"
              disabled={selectedPacks.size !== 2}
              onPress={handleRecovery}
            >
              Recovery
            </Button>
            {restoredDecryptedData?.authKeyPackData ? (
              <Button
                variant="secondary"
                onPress={() => {
                  Dialog.debugMessage({
                    debugMessage: restoredDecryptedData.authKeyPackData,
                  });
                }}
              >
                View AuthKeyPack Data
              </Button>
            ) : null}
            {restoredDecryptedData?.deviceKeyPackData ? (
              <Button
                variant="secondary"
                onPress={() => {
                  Dialog.debugMessage({
                    debugMessage: restoredDecryptedData.deviceKeyPackData,
                  });
                }}
              >
                View DeviceKeyPack Data
              </Button>
            ) : null}
            {restoredDecryptedData?.cloudKeyPackData ? (
              <Button
                variant="secondary"
                onPress={() => {
                  Dialog.debugMessage({
                    debugMessage: restoredDecryptedData.cloudKeyPackData,
                  });
                }}
              >
                View CloudKeyPack Data
              </Button>
            ) : null}
          </XStack>
        </YStack>
      ) : (
        <SizableText size="$bodySm" color="$textSubdued">
          No packs generated yet. Click "Create Wallet" first.
        </SizableText>
      )}
    </YStack>
  );
};
