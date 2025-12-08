import { useCallback, useRef, useState } from 'react';

import { cloneDeep, isEqual, isPlainObject } from 'lodash';

import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  Icon,
  IconButton,
  Input,
  SizableText,
  Stack,
  Table,
  TextAreaInput,
  Toast,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type {
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IKeylessMnemonicInfo,
  IKeylessWalletPacks,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import secureStorage from '@onekeyhq/shared/src/storage/secureStorage';
import { EPrimeTransferDataType } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { Layout } from './utils/Layout';

function findMismatchedPaths(
  obj1: unknown,
  obj2: unknown,
  path = '',
): { path: string; value1: unknown; value2: unknown }[] {
  const mismatches: { path: string; value1: unknown; value2: unknown }[] = [];

  if (isEqual(obj1, obj2)) {
    return mismatches;
  }

  if (!isPlainObject(obj1) || !isPlainObject(obj2)) {
    mismatches.push({ path: path || 'root', value1: obj1, value2: obj2 });
    return mismatches;
  }

  const allKeys = new Set([
    ...Object.keys(obj1 as object),
    ...Object.keys(obj2 as object),
  ]);

  for (const key of allKeys) {
    const currentPath = path ? `${path}.${key}` : key;
    const value1 = (obj1 as Record<string, unknown>)[key];
    const value2 = (obj2 as Record<string, unknown>)[key];

    if (!isEqual(value1, value2)) {
      if (isPlainObject(value1) && isPlainObject(value2)) {
        mismatches.push(...findMismatchedPaths(value1, value2, currentPath));
      } else {
        mismatches.push({
          path: currentPath,
          value1: value1 ? `${value1.toString().slice(0, 11)}...` : '',
          value2: value2 ? `${value2.toString().slice(0, 11)}...` : '',
        });
      }
    }
  }

  return mismatches;
}

// Helper function to compare packs with stable fields only
function isPacksEqual(
  packs1: IKeylessWalletPacks,
  packs2: IKeylessWalletPacks,
): boolean {
  const normalize = (packsToNormalize: IKeylessWalletPacks) => {
    const cloned = cloneDeep(packsToNormalize);
    cloned.authKeyPack.encrypted = 'encrypted';
    cloned.cloudKeyPack.encrypted = 'encrypted';
    cloned.deviceKeyPack.encrypted = 'encrypted';
    return cloned;
  };
  return isEqual(normalize(packs1), normalize(packs2));
}

const KeylessWalletGallery = () => {
  const navigation = useAppNavigation();
  const { copyText } = useClipboard();
  const [mnemonic, setMnemonic] = useState('');
  const [shares, setShares] = useState<IKeylessMnemonicInfo | null>(null);
  const [packs, setPacks] = useState<IKeylessWalletPacks | null>(null);

  // Device Transfer States
  const [deviceTransferResult, setDeviceTransferResult] = useState('');

  const [restoreDeviceKey, setRestoreDeviceKey] = useState('');
  const [restoreCloudKey, setRestoreCloudKey] = useState('');
  const [restoreAuthKey, setRestoreAuthKey] = useState('');

  const [useDeviceKey, setUseDeviceKey] = useState(true);
  const [useCloudKey, setUseCloudKey] = useState(true);
  const [useAuthKey, setUseAuthKey] = useState(true);

  const [restoredMnemonic, setRestoredMnemonic] = useState('');
  const [restoredShares, setRestoredShares] = useState<string[]>([]);

  const [selectedPacks, setSelectedPacks] = useState<Set<string>>(new Set());

  const [recoverAuthKeyResult, setRecoverAuthKeyResult] = useState('');
  const [recoverCloudKeyResult, setRecoverCloudKeyResult] = useState('');
  const [recoverDeviceKeyResult, setRecoverDeviceKeyResult] = useState('');

  // Cloud Backup States
  const [cloudBackupResult, setCloudBackupResult] = useState('');
  const [cloudRestoreResult, setCloudRestoreResult] = useState('');
  const [allowDuplicate, setAllowDuplicate] = useState(true);

  // Restore result with decrypted data
  const [restoredDecryptedData, setRestoredDecryptedData] = useState<{
    authKeyPackData?: any;
    deviceKeyPackData?: any;
    cloudKeyPackData?: any;
    packs?: any;
  } | null>(null);

  // Secure Storage Demo States
  const [secureStorageKey, setSecureStorageKey] = useState('test_secure_key');
  const [secureStorageValue, setSecureStorageValue] =
    useState('test_secure_value');
  const [secureStorageResult, setSecureStorageResult] = useState('');

  // Created Wallet States
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

    // Add restored decrypted data if available
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

      // Verify restored packs match original packs
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
        // if (!isEqual(result, packs)) {
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

      // Save decrypted data to state
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

  // create keyless wallet
  const createKeylessWallet = useCallback(async () => {
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
    }
  }, [packs]);

  const generateKeylessWalletPacks = useCallback(async () => {
    const result =
      await backgroundApiProxy.serviceKeylessWallet.generateKeylessWalletPacks();
    setPacks(result);

    setMnemonic(result.mnemonic);
    setShares(result);

    // Auto fill restore inputs for convenience
    setRestoreDeviceKey(result.deviceKey);
    setRestoreCloudKey(result.cloudKey);
    setRestoreAuthKey(result.authKey);
  }, []);

  const generateMnemonic = useCallback(async () => {
    const result =
      await backgroundApiProxy.serviceKeylessWallet.generateKeylessMnemonic();
    // const result =
    //   await backgroundApiProxy.serviceKeylessWallet.generateKeylessWallet({
    //     onekeyIdEmail: 'test@onekey.so',
    //     onekeyIdUserId: 'user_123',
    //     cloudKeyProvider: 'icloud',
    //     cloudUID: 'cloud_user_123',
    //     mnemonicInfo,
    //   });

    setPacks(null);

    setMnemonic(result.mnemonic);
    setShares(result);

    // Auto fill restore inputs for convenience
    setRestoreDeviceKey(result.deviceKey);
    setRestoreCloudKey(result.cloudKey);
    setRestoreAuthKey(result.authKey);
  }, []);

  const restore = useCallback(async () => {
    try {
      const result =
        await backgroundApiProxy.serviceKeylessWallet.restoreMnemonicFromShareKey(
          {
            deviceKey: useDeviceKey ? restoreDeviceKey : undefined,
            cloudKey: useCloudKey ? restoreCloudKey : undefined,
            authKey: useAuthKey ? restoreAuthKey : undefined,
          },
        );
      setRestoredMnemonic(result.mnemonic);
      setRestoredShares(result.shares);
    } catch (e: any) {
      setRestoredMnemonic(`Error: ${(e as Error)?.message}`);
      setRestoredShares([]);
    }
  }, [
    restoreAuthKey,
    restoreCloudKey,
    restoreDeviceKey,
    useDeviceKey,
    useCloudKey,
    useAuthKey,
  ]);
  const restoreRef = useRef<() => void>(null);
  restoreRef.current = restore;

  return (
    <Layout
      description="Keyless Wallet Generation & Restoration"
      suggestions={['Generate Wallet', 'Restore Mnemonic']}
      boundaryConditions={['Needs 2 of 3 keys to restore']}
      elements={[
        {
          title: 'Generate Keyless Wallet',
          element: (
            <YStack gap="$4">
              <Button onPress={generateMnemonic} variant="primary">
                Generate Mnemonic
              </Button>
              {mnemonic ? (
                <YStack gap="$2">
                  <SizableText size="$headingMd">Mnemonic:</SizableText>
                  <SizableText>{mnemonic}</SizableText>

                  <SizableText size="$headingMd">Shares:</SizableText>
                  <Table
                    dataSource={[
                      { key: 'Device Key', value: shares?.deviceKey },
                      { key: 'Cloud Key', value: shares?.cloudKey },
                      { key: 'Auth Key', value: shares?.authKey },
                      {
                        key: 'Device Key Pwd Slice',
                        value: shares?.deviceKeyPwdSlice,
                      },
                      {
                        key: 'Cloud Key Pwd Slice',
                        value: shares?.cloudKeyPwdSlice,
                      },
                      {
                        key: 'Auth Key Pwd Slice',
                        value: shares?.authKeyPwdSlice,
                      },
                    ]}
                    columns={[
                      { title: 'Key', dataIndex: 'key', columnWidth: 160 },
                      { title: 'Value', dataIndex: 'value', columnWidth: 300 },
                    ]}
                    keyExtractor={(item: { key: string; value?: string }) =>
                      item.key
                    }
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
                </YStack>
              ) : null}
            </YStack>
          ),
        },
        {
          title: 'Restore Mnemonic from Shares',
          element: (
            <YStack gap="$4">
              <Checkbox
                label="Device Key"
                value={useDeviceKey}
                onChange={(v) => {
                  setUseDeviceKey(!!v);
                  setTimeout(() => {
                    void restoreRef.current?.();
                  }, 300);
                }}
              />
              <TextAreaInput
                numberOfLines={2}
                value={restoreDeviceKey}
                onChangeText={setRestoreDeviceKey}
                placeholder="Device Key Hex"
              />
              <Checkbox
                label="Cloud Key"
                value={useCloudKey}
                onChange={(v) => {
                  setUseCloudKey(!!v);
                  setTimeout(() => {
                    void restoreRef.current?.();
                  }, 300);
                }}
              />
              <TextAreaInput
                numberOfLines={2}
                value={restoreCloudKey}
                onChangeText={setRestoreCloudKey}
                placeholder="Cloud Key Hex"
              />
              <Checkbox
                label="Auth Key"
                value={useAuthKey}
                onChange={(v) => {
                  setUseAuthKey(!!v);
                  setTimeout(() => {
                    void restoreRef.current?.();
                  }, 300);
                }}
              />
              <TextAreaInput
                numberOfLines={2}
                value={restoreAuthKey}
                onChangeText={setRestoreAuthKey}
                placeholder="Auth Key Hex"
              />
              <Button onPress={restore} variant="primary">
                Restore Mnemonic
              </Button>

              {restoredMnemonic ? (
                <YStack gap="$2">
                  <SizableText
                    size="$headingMd"
                    color={
                      restoredMnemonic.startsWith('Error') ||
                      (mnemonic && restoredMnemonic !== mnemonic)
                        ? '$textCritical'
                        : '$textSuccess'
                    }
                  >
                    Result:
                  </SizableText>
                  <SizableText selectable>{restoredMnemonic}</SizableText>
                  {mnemonic &&
                  restoredMnemonic !== mnemonic &&
                  !restoredMnemonic.startsWith('Error') ? (
                    <Alert type="danger" title="Mnemonic mismatch!" />
                  ) : null}
                </YStack>
              ) : null}
              {restoredShares.length > 0 ? (
                <YStack gap="$2">
                  <SizableText size="$headingMd">Restored Shares:</SizableText>
                  {restoredShares.map((share, index) => (
                    <SizableText key={index} size="$bodySm" numberOfLines={10}>
                      {share}
                    </SizableText>
                  ))}
                </YStack>
              ) : null}

              <YStack gap="$2">
                <Button
                  onPress={async () => {
                    if (shares?.deviceKeyX === undefined) {
                      setRecoverDeviceKeyResult(
                        'Error: deviceKeyX is undefined',
                      );
                      return;
                    }
                    try {
                      const result =
                        await backgroundApiProxy.serviceKeylessWallet.recoverMissingShare(
                          {
                            mnemonic,
                            shareBase64: restoreAuthKey,
                            missingX: shares.deviceKeyX,
                          },
                        );
                      setRecoverDeviceKeyResult(
                        JSON.stringify(result, null, 2),
                      );
                    } catch (e: any) {
                      setRecoverDeviceKeyResult(
                        `Error: ${(e as Error)?.message}`,
                      );
                    }
                  }}
                >
                  Recover DeviceKey (missingX: {shares?.deviceKeyX})
                </Button>
                {recoverDeviceKeyResult ? (
                  <SizableText size="$bodySm" color="$textSubdued">
                    {recoverDeviceKeyResult}
                  </SizableText>
                ) : null}
              </YStack>

              <YStack gap="$2">
                <Button
                  onPress={async () => {
                    if (shares?.cloudKeyX === undefined) {
                      setRecoverCloudKeyResult('Error: cloudKeyX is undefined');
                      return;
                    }
                    try {
                      const result =
                        await backgroundApiProxy.serviceKeylessWallet.recoverMissingShare(
                          {
                            mnemonic,
                            shareBase64: restoreDeviceKey,
                            missingX: shares.cloudKeyX,
                          },
                        );
                      setRecoverCloudKeyResult(JSON.stringify(result, null, 2));
                    } catch (e: any) {
                      setRecoverCloudKeyResult(
                        `Error: ${(e as Error)?.message}`,
                      );
                    }
                  }}
                >
                  Recover CloudKey (missingX: {shares?.cloudKeyX})
                </Button>
                {recoverCloudKeyResult ? (
                  <SizableText size="$bodySm" color="$textSubdued">
                    {recoverCloudKeyResult}
                  </SizableText>
                ) : null}
              </YStack>

              <YStack gap="$2">
                <Button
                  onPress={async () => {
                    if (shares?.authKeyX === undefined) {
                      setRecoverAuthKeyResult('Error: authKeyX is undefined');
                      return;
                    }
                    try {
                      const result =
                        await backgroundApiProxy.serviceKeylessWallet.recoverMissingShare(
                          {
                            mnemonic,
                            shareBase64: restoreDeviceKey,
                            missingX: shares.authKeyX,
                          },
                        );
                      setRecoverAuthKeyResult(JSON.stringify(result, null, 2));
                    } catch (e: any) {
                      setRecoverAuthKeyResult(
                        `Error: ${(e as Error)?.message}`,
                      );
                    }
                  }}
                >
                  Recover AuthKey (missingX: {shares?.authKeyX})
                </Button>
                {recoverAuthKeyResult ? (
                  <SizableText size="$bodySm" color="$textSubdued">
                    {recoverAuthKeyResult}
                  </SizableText>
                ) : null}
              </YStack>
            </YStack>
          ),
        },
        {
          title: 'Packs',
          element: (
            <YStack gap="$4">
              <Button onPress={generateKeylessWalletPacks} variant="primary">
                Generate Wallet Packs
              </Button>
              <Button onPress={createKeylessWallet} variant="primary">
                Create Wallet
              </Button>
              <Button
                onPress={async () => {
                  const result =
                    await backgroundApiProxy.serviceKeylessWallet.buildKeylessWalletUserInfo();
                  Dialog.debugMessage({
                    debugMessage: result,
                  });
                }}
              >
                Keyless Wallet User Info
              </Button>

              {/* Created Wallet Display */}
              {createWalletError ? (
                <YStack
                  gap="$2"
                  p="$3"
                  borderRadius="$2"
                  bg="$bgCriticalSubdued"
                >
                  <SizableText size="$headingSm" color="$textCritical">
                    Create Wallet Error:
                  </SizableText>
                  <SizableText size="$bodyMd" color="$textCritical" selectable>
                    {createWalletError}
                  </SizableText>
                </YStack>
              ) : null}

              {createdWallet ? (
                <YStack
                  gap="$2"
                  p="$3"
                  borderRadius="$2"
                  bg="$bgSuccessSubdued"
                >
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
                    keyExtractor={(item: { key: string; value?: string }) =>
                      item.key
                    }
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
              <Button onPress={handleCopyAllToClipboard}>
                CopyAllToClipboard
              </Button>
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
                            debugMessage:
                              restoredDecryptedData.deviceKeyPackData,
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
                            debugMessage:
                              restoredDecryptedData.cloudKeyPackData,
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
          ),
        },
        {
          title: 'Cloud Backup (CloudKeyPack)',
          element: (
            <YStack gap="$4">
              <SizableText size="$bodyMd" color="$textSubdued">
                Backup and restore CloudKeyPack to/from cloud storage (iCloud /
                Google Drive)
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
                      setCloudBackupResult(
                        `❌ Error: ${(e as Error)?.message}`,
                      );
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

                      // Verify restored cloudKeyPack matches current UI state
                      const isMatch = isEqual(
                        result.cloudKeyPack,
                        packs.cloudKeyPack,
                      );

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
                      setCloudRestoreResult(
                        `❌ Error: ${(e as Error)?.message}`,
                      );
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
          ),
        },
        {
          title: 'Device Transfer (DeviceKeyPack)',
          element: (
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
                      // Store deviceKeyPack to globalThis
                      (
                        globalThis as Record<string, unknown>
                      ).$pendingDeviceKeyPackForTransfer = packs.deviceKeyPack;
                      setDeviceTransferResult(
                        '⏳ DeviceKeyPack stored. Opening transfer page...',
                      );

                      // Navigate to PrimeTransfer page with Links tab
                      navigation.pushModal(EModalRoutes.PrimeModal, {
                        screen: EPrimePages.PrimeTransfer,
                        params: {
                          defaultTab: 'enter-link',
                          transferType: EPrimeTransferDataType.keylessWallet,
                        },
                      });
                    } catch (e: unknown) {
                      setDeviceTransferResult(
                        `❌ Error: ${(e as Error)?.message}`,
                      );
                    }
                  }}
                >
                  Send DeviceKeyPack
                </Button>

                <Button
                  size="small"
                  onPress={async () => {
                    try {
                      setDeviceTransferResult(
                        '⏳ Opening QR code for receiving...',
                      );

                      // Navigate to PrimeTransfer page to display QR code
                      navigation.pushModal(EModalRoutes.PrimeModal, {
                        screen: EPrimePages.PrimeTransfer,
                        params: {
                          defaultTab: 'qr-code',
                          transferType: EPrimeTransferDataType.keylessWallet,
                        },
                      });
                    } catch (e: unknown) {
                      setDeviceTransferResult(
                        `❌ Error: ${(e as Error)?.message}`,
                      );
                    }
                  }}
                >
                  Receive DeviceKeyPack
                </Button>

                <Button
                  size="small"
                  variant="tertiary"
                  onPress={() => {
                    const pendingPack = (globalThis as Record<string, unknown>)
                      .$pendingDeviceKeyPackForTransfer;
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
                    (
                      globalThis as Record<string, unknown>
                    ).$pendingDeviceKeyPackForTransfer = undefined;
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
          ),
        },
        {
          title: 'Secure Storage Demo',
          element: (
            <YStack gap="$4">
              <SizableText size="$bodyMd" color="$textSubdued">
                Support Secure Storage:{' '}
              </SizableText>

              <YStack gap="$2">
                <SizableText size="$bodyMd">Key:</SizableText>
                <Input
                  value={secureStorageKey}
                  onChangeText={setSecureStorageKey}
                  placeholder="Enter key"
                />
              </YStack>

              <YStack gap="$2">
                <SizableText size="$bodyMd">Value:</SizableText>
                <Input
                  value={secureStorageValue}
                  onChangeText={setSecureStorageValue}
                  placeholder="Enter value"
                />
              </YStack>

              <XStack gap="$2" flexWrap="wrap">
                <Button
                  size="small"
                  onPress={async () => {
                    try {
                      await secureStorage.setSecureItemWithBiometrics(
                        secureStorageKey,
                        secureStorageValue,
                        {
                          authenticationPrompt:
                            'Authenticate to save secure item',
                        },
                      );
                      setSecureStorageResult(
                        `✅ Set with biometrics success: ${secureStorageKey}`,
                      );
                    } catch (e: any) {
                      setSecureStorageResult(
                        `❌ Error: ${(e as Error)?.message}`,
                      );
                    }
                  }}
                >
                  Set with Biometrics
                </Button>
                <Button
                  size="small"
                  onPress={async () => {
                    try {
                      await secureStorage.setSecureItemWithBiometrics(
                        secureStorageKey,
                        secureStorageValue,
                      );
                      setSecureStorageResult(
                        `✅ Set with biometrics success: ${secureStorageKey}`,
                      );
                    } catch (e: any) {
                      setSecureStorageResult(
                        `❌ Error: ${(e as Error)?.message}`,
                      );
                    }
                  }}
                >
                  Set with Biometrics(No Prompt)
                </Button>

                <Button
                  size="small"
                  onPress={async () => {
                    try {
                      await secureStorage.setSecureItem(
                        secureStorageKey,
                        secureStorageValue,
                      );
                      setSecureStorageResult(
                        `✅ Set success: ${secureStorageKey}`,
                      );
                    } catch (e: any) {
                      setSecureStorageResult(
                        `❌ Error: ${(e as Error)?.message}`,
                      );
                    }
                  }}
                >
                  Set (No Biometrics)
                </Button>

                <Button
                  size="small"
                  onPress={async () => {
                    try {
                      const result = await secureStorage.getSecureItem(
                        secureStorageKey,
                      );
                      setSecureStorageResult(
                        result !== null
                          ? `✅ Get success: ${result}`
                          : `⚠️ Key not found: ${secureStorageKey}`,
                      );
                    } catch (e: any) {
                      setSecureStorageResult(
                        `❌ Error: ${(e as Error)?.message}`,
                      );
                    }
                  }}
                >
                  Get Item
                </Button>

                <Button
                  size="small"
                  variant="destructive"
                  onPress={async () => {
                    try {
                      await secureStorage.removeSecureItem(secureStorageKey);
                      setSecureStorageResult(`✅ Removed: ${secureStorageKey}`);
                    } catch (e: any) {
                      setSecureStorageResult(
                        `❌ Error: ${(e as Error)?.message}`,
                      );
                    }
                  }}
                >
                  Remove Item
                </Button>
              </XStack>

              {secureStorageResult ? (
                <YStack gap="$2" p="$3" borderRadius="$2" bg="$bgSubdued">
                  <SizableText size="$bodyMd" selectable>
                    {secureStorageResult}
                  </SizableText>
                </YStack>
              ) : null}
            </YStack>
          ),
        },
      ]}
    />
  );
};

export default KeylessWalletGallery;
