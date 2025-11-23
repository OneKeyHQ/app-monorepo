import { useState } from 'react';

import {
  Button,
  Dialog,
  Input,
  SizableText,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import { decryptAsync } from '@onekeyhq/core/src/secret/encryptors/aes256';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { showBatchCreateAccountProcessingDialog } from '@onekeyhq/kit/src/views/AccountManagerStacks/pages/BatchCreateAccount/ProcessingDialog';
import { showPrimeTransferImportProcessingDialog } from '@onekeyhq/kit/src/views/Prime/pages/PagePrimeTransfer/components/PrimeTransferImportProcessingDialog';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { Layout } from './utils/Layout';

function demoLog(data: any, apiName: string) {
  Dialog.debugMessage({
    title: `API Response: ${apiName}`,
    debugMessage: data,
  });
  Toast.success({
    title: `${apiName} Success`,
    message: 'Check debug dialog for full response',
  });
  if (!platformEnv.isNative) {
    console.log('Cloud Backup API Response:', data);
  }
}

function demoError(error: unknown, apiName: string) {
  const e = error as Error;
  Dialog.debugMessage({
    title: `API Error: ${apiName}`,
    debugMessage: error,
  });
  Toast.error({
    title: 'API Error',
    message: e?.message || 'Unknown error',
  });
  if (!platformEnv.isNative) {
    console.error('Cloud Backup API Error:', error);
  }
}

let lastRecordId = '';
const password = '123456';

export function CloudBackupApiTests() {
  const [recordId, setRecordId] = useState('123');
  const [backupsList, setBackupsList] = useState<any[]>([]);

  const handleApiCall = async (
    apiCall: () => Promise<unknown>,
    apiName: string,
  ) => {
    try {
      const result = await apiCall();
      demoLog({ api: apiName, result }, apiName);
      return result;
    } catch (error) {
      demoError(error, apiName);
      throw error;
    }
  };

  const getCurrentPlatformLabel = () => {
    if (platformEnv.isNativeIOS) return 'iOS (iCloud Available)';
    if (platformEnv.isNativeAndroid) return 'Android (Not Supported)';
    if (platformEnv.isDesktop) return 'Desktop (Not Supported)';
    return 'Web (Not Supported)';
  };

  return (
    <Stack gap="$4">
      <Stack gap="$3">
        <SizableText size="$bodyLg" fontWeight="600">
          Platform Information
        </SizableText>

        <Stack gap="$2">
          <XStack gap="$4">
            <Stack gap="$1">
              <SizableText size="$bodySm" fontWeight="500">
                Current Platform:
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {getCurrentPlatformLabel()}
              </SizableText>
            </Stack>
            <Stack gap="$1">
              <SizableText size="$bodySm" fontWeight="500">
                Backup Support:
              </SizableText>
              <SizableText
                size="$bodySm"
                color={
                  platformEnv.isNativeIOS ? '$textSuccess' : '$textCritical'
                }
              >
                {platformEnv.isNativeIOS ? 'Supported' : 'Not Supported'}
              </SizableText>
            </Stack>
          </XStack>
        </Stack>
      </Stack>

      <Stack gap="$3">
        <SizableText size="$bodyLg" fontWeight="600">
          Basic Operations
        </SizableText>

        <XStack gap="$2" flexWrap="wrap">
          <Button
            onPress={() => showPrimeTransferImportProcessingDialog({})}
            variant="secondary"
          >
            ShowImportProcessingDialog
          </Button>
          <Button
            onPress={() => showBatchCreateAccountProcessingDialog({})}
            variant="secondary"
          >
            ShowBatchCreateAccountProcessingDialog
          </Button>
          <Button
            onPress={() =>
              handleApiCall(
                () =>
                  backgroundApiProxy.serviceCloudBackupV2.getCloudAccountInfo(),
                'getCloudAccountInfo',
              )
            }
            variant="secondary"
          >
            Get Cloud Account Info
          </Button>

          <Button
            onPress={() =>
              handleApiCall(async () => {
                const data =
                  await backgroundApiProxy.serviceCloudBackupV2.buildBackupData();
                const result =
                  await backgroundApiProxy.serviceCloudBackupV2.backup({
                    password,
                    data,
                  });
                lastRecordId = result.recordID;
                setRecordId(result.recordID);
                return result;
              }, 'backup')
            }
            variant="primary"
          >
            Backup Data
          </Button>

          <Button
            onPress={() =>
              handleApiCall(async () => {
                const result =
                  await backgroundApiProxy.serviceCloudBackupV2.download({
                    recordId: lastRecordId,
                  });
                return result;
              }, 'download')
            }
            variant="primary"
          >
            Download Data
          </Button>

          <Button
            onPress={() =>
              handleApiCall(async () => {
                const result =
                  await backgroundApiProxy.serviceCloudBackupV2.prepareEncryptionKey(
                    {
                      password,
                    },
                  );
                return result;
              }, 'prepareEncryptionKey')
            }
          >
            Prepare Encryption Key
          </Button>

          <Button
            onPress={() =>
              handleApiCall(async () => {
                const result =
                  await backgroundApiProxy.serviceCloudBackupV2.restore({
                    password,
                    payload: {} as any,
                  });
                return result;
              }, 'restore')
            }
            variant="primary"
          >
            Restore Data
          </Button>
          <Button
            onPress={() =>
              handleApiCall(
                () =>
                  backgroundApiProxy.serviceCloudBackupV2.getICloudKeyChainEncryptionKey(),
                'getICloudKeyChainEncryptionKey',
              )
            }
          >
            Get iCloud Keychain Encryption Key
          </Button>
          <SizableText size="$bodyLg" fontWeight="600">
            sVKTRz****SYCsE=
          </SizableText>
        </XStack>
      </Stack>

      <Stack gap="$3">
        <SizableText size="$bodyLg" fontWeight="600">
          Backup Management
        </SizableText>

        <Stack gap="$2">
          <SizableText size="$bodySm" fontWeight="bold">
            Record ID (for delete operation)
          </SizableText>
          <Input
            value={recordId}
            onChangeText={setRecordId}
            placeholder="123"
            allowPaste
            allowClear
          />
        </Stack>

        <XStack gap="$2" flexWrap="wrap">
          <Button
            onPress={() => {
              void handleApiCall(async () => {
                const result =
                  await backgroundApiProxy.serviceCloudBackupV2.restore({
                    payload: {
                      recordId,
                    } as any,
                    password,
                  });
                return result;
              }, 'restore');
            }}
          >
            Get backup
          </Button>
          <Button
            onPress={async () => {
              try {
                const result = await handleApiCall(
                  () => backgroundApiProxy.serviceCloudBackupV2.getAllBackups(),
                  'getAllBackups',
                );
                setBackupsList(result as any[]);
              } catch (error) {
                // Error already handled by handleApiCall
              }
            }}
          >
            Get All Backups
          </Button>

          <Button
            onPress={() =>
              handleApiCall(
                () =>
                  backgroundApiProxy.serviceCloudBackupV2.delete({
                    recordId: '123',
                  }),
                'deleteBackup',
              )
            }
            variant="destructive"
          >
            Delete Backup
          </Button>

          <Button
            onPress={() =>
              handleApiCall(async () => {
                // Decrypt backup data with MEK
                try {
                  const encryptionKey = '100712566165846102393___123456';
                  const content =
                    'alZpZVpoWDQrc0h1aEQ0Q0xMd1owS0Z4dmhGemZrOCtwcjNtOEN5dWhheTQxQTVlbTJrMTA5NHdrOGl3c2VNaVZkcEpXMGxQSHYyL003dnJBbzFNTWhsZFd1VjBldUhySS8wOUpJTGtQTFBlRkhNbkpLN0FybHJxVExlMTk2dzZQMWpna1RVVVNrMGN1aDROWDUzckpQVERFV1N1WGR5anVGR0ZRS1E1R2k2SzFhYkZCYlJ5Y0RkUldYN0F0TC9OYXRuSU9WRldhQ3NtbHVsY3B3bzVnYzFpK3oxWDF4WURUQjI1eEtrSUZlYmgrZ094dldPZ0UyN1oxWVVmTjYyQ3Y5OC9FTUFEWjlFQzZvYzRFODllNEE9PQ==';
                  const encryptedData = Buffer.from(content, 'base64');
                  const decryptedData = await decryptAsync({
                    data: encryptedData,
                    password: encryptionKey,
                    allowRawPassword: true,
                  });

                  const dataJson = decryptedData.toString('utf8');
                  return JSON.parse(dataJson) as IPrimeTransferData;
                } catch (error) {
                  throw new OneKeyLocalError(
                    `Failed to decrypt backup data. The backup may be corrupted: ${
                      (error as Error)?.message
                    }`,
                  );
                }
              }, 'decryptDataTest')
            }
          >
            Decrypt Data Test
          </Button>
        </XStack>

        {backupsList.length > 0 ? (
          <Stack gap="$2">
            <SizableText size="$bodySm" fontWeight="bold">
              Found {backupsList.length} Backup(s)
            </SizableText>
            <Stack gap="$1">
              {backupsList.map((backup, index) => (
                <SizableText key={index} size="$bodySm" color="$textSubdued">
                  {JSON.stringify(backup, null, 2)}
                </SizableText>
              ))}
            </Stack>
          </Stack>
        ) : null}
      </Stack>

      <Stack gap="$3">
        <SizableText size="$bodyLg" fontWeight="600">
          Auto Backup Settings
        </SizableText>

        <Stack gap="$2">
          <SizableText size="$bodySm" color="$textSubdued">
            Note: Auto-backup feature is not yet implemented
          </SizableText>
        </Stack>

        <XStack gap="$2" flexWrap="wrap">
          <Button
            onPress={() =>
              handleApiCall(
                () =>
                  backgroundApiProxy.serviceCloudBackupV2.enableAutoBackup(),
                'enableAutoBackup',
              )
            }
            disabled
          >
            Enable Auto Backup
          </Button>

          <Button
            onPress={() =>
              handleApiCall(
                () =>
                  backgroundApiProxy.serviceCloudBackupV2.disableAutoBackup(),
                'disableAutoBackup',
              )
            }
            disabled
          >
            Disable Auto Backup
          </Button>
        </XStack>
      </Stack>

      <Stack gap="$3">
        <SizableText size="$bodyLg" fontWeight="600">
          Testing Guidelines
        </SizableText>

        <Stack gap="$2">
          <SizableText size="$bodySm" color="$textSubdued">
            1. This feature only works on iOS devices/simulators
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            2. Ensure you're signed in to iCloud on the test device
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            3. iCloud Drive must be enabled for the app
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            4. Check CloudKit Console for backup records
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            5. Restore operations will show data in debug dialog
          </SizableText>
        </Stack>
      </Stack>

      <Stack gap="$3">
        <SizableText size="$bodyLg" fontWeight="600">
          Quick Actions
        </SizableText>

        <XStack gap="$2" flexWrap="wrap">
          <Button
            variant="secondary"
            onPress={() => {
              setRecordId('123');
              setBackupsList([]);
              Toast.success({ title: 'Reset to default values' });
            }}
          >
            Reset to Defaults
          </Button>

          <Button
            variant="secondary"
            onPress={() => {
              setBackupsList([]);
              Toast.success({ title: 'Cleared backups list' });
            }}
          >
            Clear Backups List
          </Button>
        </XStack>
      </Stack>
    </Stack>
  );
}

const CloudBackupGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="CloudBackupGallery"
    elements={[
      {
        title: 'iCloud Backup API Tests',
        element: <CloudBackupApiTests />,
      },
    ]}
  />
);

export default CloudBackupGallery;
