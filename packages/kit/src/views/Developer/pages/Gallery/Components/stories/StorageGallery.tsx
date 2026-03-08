import { useState } from 'react';

import { Button, Dialog, Stack, Toast, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Layout } from './utils/Layout';

function demoLog(data: unknown, apiName: string) {
  Dialog.debugMessage({
    title: `API Response: ${apiName}`,
    debugMessage: data,
  });
  Toast.success({
    title: `${apiName} Success`,
    message: 'Check debug dialog for full response',
  });
  if (!platformEnv.isNative) {
    console.log('Storage API Response:', data);
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
    console.error('Storage API Error:', error);
  }
}

function demoClear(apiName: string) {
  Toast.success({
    title: `${apiName} Success`,
    message: 'Data cleared successfully',
  });
  if (!platformEnv.isNative) {
    console.log('Storage API Clear:', apiName);
  }
}

function StorageApiTests() {
  const [loading, setLoading] = useState<string | null>(null);

  return (
    <YStack gap="$4" padding="$4">
      <Stack gap="$2">
        <Button
          variant="destructive"
          loading={loading === 'clearAppStorage'}
          onPress={async () => {
            try {
              setLoading('clearAppStorage');
              await backgroundApiProxy.serviceApp.clearAppStorage();
              demoClear('clearAppStorage');
            } catch (e) {
              demoError(e, 'clearAppStorage');
            } finally {
              setLoading(null);
            }
          }}
        >
          Clear AppStorage
        </Button>

        <Button
          loading={loading === 'getAppStorageFirstItem'}
          onPress={async () => {
            try {
              setLoading('getAppStorageFirstItem');
              const result =
                await backgroundApiProxy.serviceApp.getAppStorageFirstItem();
              demoLog(result, 'getAppStorageFirstItem');
            } catch (e) {
              demoError(e, 'getAppStorageFirstItem');
            } finally {
              setLoading(null);
            }
          }}
        >
          Query AppStorage First Item
        </Button>

        <Button
          variant="destructive"
          loading={loading === 'clearSimpleDB'}
          onPress={async () => {
            try {
              setLoading('clearSimpleDB');
              await backgroundApiProxy.serviceApp.clearSimpleDB();
              demoClear('clearSimpleDB');
            } catch (e) {
              demoError(e, 'clearSimpleDB');
            } finally {
              setLoading(null);
            }
          }}
        >
          Clear SimpleDB
        </Button>

        <Button
          loading={loading === 'getSimpleDBFirstItem'}
          onPress={async () => {
            try {
              setLoading('getSimpleDBFirstItem');
              const result =
                await backgroundApiProxy.serviceApp.getSimpleDBFirstItem();
              demoLog(result, 'getSimpleDBFirstItem');
            } catch (e) {
              demoError(e, 'getSimpleDBFirstItem');
            } finally {
              setLoading(null);
            }
          }}
        >
          Query SimpleDB First Item
        </Button>

        <Button
          variant="destructive"
          loading={loading === 'clearGlobalStatus'}
          onPress={async () => {
            try {
              setLoading('clearGlobalStatus');
              await backgroundApiProxy.serviceApp.clearGlobalStatus();
              demoClear('clearGlobalStatus');
            } catch (e) {
              demoError(e, 'clearGlobalStatus');
            } finally {
              setLoading(null);
            }
          }}
        >
          Clear Global Status
        </Button>

        <Button
          loading={loading === 'getGlobalStatusFirstItem'}
          onPress={async () => {
            try {
              setLoading('getGlobalStatusFirstItem');
              const result =
                await backgroundApiProxy.serviceApp.getGlobalStatusFirstItem();
              demoLog(result, 'getGlobalStatusFirstItem');
            } catch (e) {
              demoError(e, 'getGlobalStatusFirstItem');
            } finally {
              setLoading(null);
            }
          }}
        >
          Query Global Status First Item
        </Button>
      </Stack>
    </YStack>
  );
}

const StorageGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    description="Storage management APIs for testing"
    suggestions={[
      'Clear AppStorage: Clears all appStorage data (works on Web and Native)',
      'Query AppStorage First Item: Get the first item from appStorage to verify if cleared',
      'Clear SimpleDB: Clears all simpleDB entities (Web: clears OneKeySimpleDB IndexedDB, Native: filters keys)',
      'Query SimpleDB First Item: Get the first item from simpleDB to verify if cleared',
      'Clear Global Status: Clears all global states/Jotai persist data (Web: clears OneKeyGlobalStates IndexedDB, Native: filters keys)',
      'Query Global Status First Item: Get the first item from globalStatus to verify if cleared',
      'Note: These methods are only available when devSettings is enabled',
    ]}
    boundaryConditions={[
      'Requires devSettings to be enabled',
      'These operations are destructive and cannot be undone',
    ]}
  >
    <StorageApiTests />
  </Layout>
);

export default StorageGallery;
