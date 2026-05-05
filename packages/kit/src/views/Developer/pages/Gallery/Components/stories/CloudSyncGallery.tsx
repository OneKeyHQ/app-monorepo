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
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';

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
}

const defaultCallerName = 'CloudSyncGallery';

export function CloudSyncApiTests() {
  const navigation = useAppNavigation();
  const [callerName, setCallerName] = useState(defaultCallerName);
  const [encryptedPassword, setEncryptedPassword] = useState('');

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

  const buildParams = (overrides: Record<string, unknown> = {}) => ({
    callerName: callerName?.trim() || defaultCallerName,
    encryptedSecurityPasswordR1ForServer: encryptedPassword.trim() || undefined,
    ...overrides,
  });

  return (
    <Stack gap="$4">
      <Stack gap="$3">
        <SizableText size="$bodyLg" fontWeight="600">
          Params
        </SizableText>

        <Stack gap="$2">
          <SizableText size="$bodySm" fontWeight="bold">
            Caller Name
          </SizableText>
          <Input
            value={callerName}
            onChangeText={setCallerName}
            placeholder={defaultCallerName}
            allowPaste
            allowClear
          />
        </Stack>

        <Stack gap="$2">
          <SizableText size="$bodySm" fontWeight="bold">
            Encrypted Password (R1)
          </SizableText>
          <Input
            value={encryptedPassword}
            onChangeText={setEncryptedPassword}
            placeholder="Optional"
            allowPaste
            allowClear
          />
        </Stack>
      </Stack>

      <Stack gap="$3">
        <SizableText size="$bodyLg" fontWeight="600">
          Actions
        </SizableText>

        <XStack gap="$2" flexWrap="wrap">
          <Button
            onPressLoadingEnabled
            onPress={() =>
              handleApiCall(async () => {
                await backgroundApiProxy.servicePassword.promptPasswordVerify();
                await backgroundApiProxy.servicePrimeCloudSync.startServerSyncFlow(
                  buildParams(),
                );
              }, 'startServerSyncFlow')
            }
            variant="primary"
          >
            Start Sync
          </Button>

          <Button
            onPress={() =>
              handleApiCall(
                () =>
                  backgroundApiProxy.servicePrimeCloudSync.startServerSyncFlow(
                    buildParams({ isFlush: true }),
                  ),
                'startServerSyncFlow (flush)',
              )
            }
          >
            Start Sync (Flush)
          </Button>

          <Button
            onPress={() =>
              handleApiCall(
                () =>
                  backgroundApiProxy.servicePrimeCloudSync.startServerSyncFlow(
                    buildParams({ noDebounceUpload: true }),
                  ),
                'startServerSyncFlow (noDebounceUpload)',
              )
            }
          >
            Start Sync (No Debounce)
          </Button>

          <Button
            onPress={() =>
              handleApiCall(
                () =>
                  backgroundApiProxy.servicePrimeCloudSync.startServerSyncFlow(
                    buildParams({ setUndefinedTimeToNow: true }),
                  ),
                'startServerSyncFlow (setUndefinedTimeToNow)',
              )
            }
          >
            Start Sync (Set Undefined Time)
          </Button>
        </XStack>

        <XStack gap="$2" flexWrap="wrap">
          <Button
            onPressLoadingEnabled
            onPress={() =>
              handleApiCall(async () => {
                const { password } =
                  await backgroundApiProxy.servicePassword.promptPasswordVerify();

                const syncCredential =
                  await backgroundApiProxy.servicePrimeCloudSync.getSyncCredentialSafe();
                if (!syncCredential) {
                  throw new OneKeyLocalError('No sync credential');
                }

                return backgroundApiProxy.servicePrimeCloudSync.initLocalSyncItemsDB(
                  {
                    syncCredential,
                    password,
                  },
                );
              }, 'initLocalSyncItemsDB')
            }
            variant="secondary"
          >
            Init Local Sync Items DB
          </Button>

          <Button
            onPressLoadingEnabled
            onPress={() =>
              handleApiCall(async () => {
                const syncCredential =
                  await backgroundApiProxy.servicePrimeCloudSync.getSyncCredentialSafe();
                if (!syncCredential) {
                  throw new OneKeyLocalError('No sync credential');
                }
                return backgroundApiProxy.servicePrimeCloudSync.initLocalSyncItemsDB(
                  {
                    syncCredential,
                  },
                );
              }, 'initLocalSyncItemsDB (no password)')
            }
            variant="secondary"
          >
            Init Local Sync Items DB (No Password)
          </Button>

          <Button
            onPressLoadingEnabled
            onPress={() =>
              handleApiCall(async () => {
                await backgroundApiProxy.servicePassword.promptPasswordVerify();
                const syncCredential =
                  await backgroundApiProxy.servicePrimeCloudSync.getSyncCredentialSafe();
                return syncCredential;
              }, 'initLocalSyncItemsDB (no password)')
            }
            variant="secondary"
          >
            syncCredential
          </Button>

          <Button
            onPressLoadingEnabled
            onPress={() =>
              handleApiCall(async () => {
                await backgroundApiProxy.servicePassword.promptPasswordVerify();
                await backgroundApiProxy.servicePrimeCloudSync.resetServerData({
                  skipPrimeStatusCheck: true,
                });
              }, 'resetServerData (flush)')
            }
            variant="secondary"
          >
            Flush Server Data
          </Button>

          <Button
            onPress={() => {
              navigation.pushModal(EModalRoutes.PrimeModal, {
                screen: EPrimePages.PrimeCloudSyncDebug,
              });
            }}
            variant="primary"
          >
            打开云同步调试页面
          </Button>
        </XStack>
      </Stack>
    </Stack>
  );
}

const CloudSyncGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="CloudSyncGallery"
    elements={[
      {
        title: 'Prime Cloud Sync API Tests',
        element: <CloudSyncApiTests />,
      },
    ]}
  />
);

export default CloudSyncGallery;
