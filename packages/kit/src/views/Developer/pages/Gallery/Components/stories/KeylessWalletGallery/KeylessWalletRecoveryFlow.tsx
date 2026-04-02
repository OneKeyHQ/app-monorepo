import { useCallback, useState } from 'react';

import {
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
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EKeylessWalletEnableScene } from '@onekeyhq/shared/src/keylessWallet/keylessWalletConsts';

import { StepRenderer } from './StepRenderer';

import type { IStepState } from './types';

export function KeylessWalletRecoveryFlow() {
  const { supabaseUser } = useOneKeyAuth();
  const { user } = useOneKeyAuth();
  const {
    getDevicePack,
    getAuthPackFromCache,
    getAuthPackFromServer,
    getCloudPack,
    enableKeylessWallet,
    enableKeylessWalletLoading,
  } = useKeylessWallet();

  const [getDevicePackStep, setGetDevicePackStep] = useState<IStepState>({
    status: 'pending',
  });
  const [getAuthPackFromCacheStep, setGetAuthPackFromCacheStep] =
    useState<IStepState>({ status: 'pending' });
  const [getAuthPackFromServerStep, setGetAuthPackFromServerStep] =
    useState<IStepState>({ status: 'pending' });
  const [getCloudPackStep, setGetCloudPackStep] = useState<IStepState>({
    status: 'pending',
  });

  // Delete states
  const [isDeletingAuthPackFromServer, setIsDeletingAuthPackFromServer] =
    useState(false);
  const [isDeletingDevicePack, setIsDeletingDevicePack] = useState(false);
  const [isDeletingAuthPackFromCache, setIsDeletingAuthPackFromCache] =
    useState(false);
  const [isDeletingWallet, setIsDeletingWallet] = useState(false);
  const [deleteAuthPackResult, setDeleteAuthPackResult] = useState('');
  const [deleteDevicePackResult, setDeleteDevicePackResult] = useState('');
  const [deleteAuthPackFromCacheResult, setDeleteAuthPackFromCacheResult] =
    useState('');
  const [deleteWalletResult, setDeleteWalletResult] = useState('');

  const packSetId = user?.keylessWalletId;

  const handleGetDevicePack = useCallback(async () => {
    try {
      setGetDevicePackStep({ status: 'loading' });
      const result = await getDevicePack();
      if (!result) {
        throw new OneKeyLocalError('Device pack not found');
      }
      setGetDevicePackStep({ status: 'success', result });
    } catch (e: any) {
      const errorMessage = (e as Error)?.message ?? 'Unknown error';
      setGetDevicePackStep({ status: 'error', error: errorMessage });
    }
  }, [getDevicePack]);

  const handleGetAuthPackFromCache = useCallback(async () => {
    try {
      setGetAuthPackFromCacheStep({ status: 'loading' });
      const result = await getAuthPackFromCache();
      if (!result) {
        throw new OneKeyLocalError('Auth pack not found');
      }
      setGetAuthPackFromCacheStep({ status: 'success', result });
    } catch (e: any) {
      const errorMessage = (e as Error)?.message ?? 'Unknown error';
      setGetAuthPackFromCacheStep({ status: 'error', error: errorMessage });
    }
  }, [getAuthPackFromCache]);

  const handleGetAuthPackFromServer = useCallback(async () => {
    try {
      setGetAuthPackFromServerStep({ status: 'loading' });
      const result = await getAuthPackFromServer();
      if (!result) {
        throw new OneKeyLocalError('Auth pack not found');
      }
      setGetAuthPackFromServerStep({ status: 'success', result });
    } catch (e: any) {
      const errorMessage = (e as Error)?.message ?? 'Unknown error';
      setGetAuthPackFromServerStep({ status: 'error', error: errorMessage });
    }
  }, [getAuthPackFromServer]);

  const handleGetCloudPack = useCallback(async () => {
    try {
      setGetCloudPackStep({ status: 'loading' });
      const result = await getCloudPack();
      if (!result) {
        throw new OneKeyLocalError('Cloud pack not found');
      }
      setGetCloudPackStep({ status: 'success', result });
    } catch (e: any) {
      const errorMessage = (e as Error)?.message ?? 'Unknown error';
      setGetCloudPackStep({ status: 'error', error: errorMessage });
    }
  }, [getCloudPack]);

  const handleResetSteps = useCallback(() => {
    setGetDevicePackStep({ status: 'pending' });
    setGetAuthPackFromCacheStep({ status: 'pending' });
    setGetAuthPackFromServerStep({ status: 'pending' });
    setGetCloudPackStep({ status: 'pending' });
  }, []);

  return (
    <YStack gap="$4">
      <SizableText size="$bodyMd" color="$textSubdued">
        Complete Keyless Wallet Recovery Flow: Generate shares → Save device
      </SizableText>
      <SizableText size="$bodyMd" color="$textSubdued">
        keylessWalletId: {user?.keylessWalletId}
      </SizableText>
      <SizableText size="$bodyMd" color="$textSubdued">
        supabaseUser: {supabaseUser?.email}
      </SizableText>
      <XStack gap="$3">
        <Button
          onPress={async () => {
            const result =
              await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
            Dialog.debugMessage({
              debugMessage: result,
            });
          }}
        >
          GetUserInfo
        </Button>
        <Button variant="secondary" onPress={handleResetSteps}>
          Reset Steps
        </Button>
      </XStack>

      <YStack gap="$3">
        <StepRenderer
          stepNumber={1}
          title="Get Device Pack"
          state={getDevicePackStep}
          onPress={handleGetDevicePack}
          disabled={false}
        />
        <StepRenderer
          stepNumber={2}
          title="Get Auth Pack From Cache"
          state={getAuthPackFromCacheStep}
          onPress={handleGetAuthPackFromCache}
          disabled={false}
        />
        <StepRenderer
          stepNumber={3}
          title="Get Auth Pack From Server"
          state={getAuthPackFromServerStep}
          onPress={handleGetAuthPackFromServer}
          disabled={false}
        />
        <StepRenderer
          stepNumber={4}
          title="Get Cloud Pack"
          state={getCloudPackStep}
          onPress={handleGetCloudPack}
          disabled={false}
        />
        <Button
          variant="destructive"
          disabled={!packSetId || isDeletingAuthPackFromServer}
          loading={isDeletingAuthPackFromServer}
          onPress={async () => {
            if (!packSetId) {
              setDeleteAuthPackResult(
                '❌ Error: No packSetId available. Please login first.',
              );
              return;
            }
            try {
              setIsDeletingAuthPackFromServer(true);
              setDeleteAuthPackResult('⏳ Deleting auth pack from server...');
              const result =
                await backgroundApiProxy.serviceKeylessWallet.deleteAuthPackFromServer();
              setDeleteAuthPackResult(
                `✅ Delete success!\n${JSON.stringify(result, null, 2)}`,
              );
              Toast.success({
                title: 'Delete Success',
                message: 'Auth pack has been deleted from server.',
              });
            } catch (e: any) {
              const errorMessage = (e as Error)?.message ?? 'Unknown error';
              setDeleteAuthPackResult(`❌ Error: ${errorMessage}`);
              Toast.error({
                title: 'Delete Failed',
                message: errorMessage,
              });
            } finally {
              setIsDeletingAuthPackFromServer(false);
            }
          }}
        >
          Delete Auth Pack From Server
        </Button>
        <Button
          variant="destructive"
          disabled={!packSetId || isDeletingDevicePack}
          loading={isDeletingDevicePack}
          onPress={async () => {
            if (!packSetId) {
              setDeleteDevicePackResult(
                '❌ Error: No packSetId available. Please login first.',
              );
              return;
            }
            try {
              setIsDeletingDevicePack(true);
              setDeleteDevicePackResult('⏳ Deleting device pack...');
              await backgroundApiProxy.serviceKeylessWallet.removeDevicePackFromStorage(
                {
                  packSetId,
                },
              );
              setDeleteDevicePackResult('✅ Device pack deleted successfully!');
              Toast.success({
                title: 'Delete Success',
                message: 'Device pack has been deleted from storage.',
              });
            } catch (e: any) {
              const errorMessage = (e as Error)?.message ?? 'Unknown error';
              setDeleteDevicePackResult(`❌ Error: ${errorMessage}`);
              Toast.error({
                title: 'Delete Failed',
                message: errorMessage,
              });
            } finally {
              setIsDeletingDevicePack(false);
            }
          }}
        >
          Delete Device Pack From Storage
        </Button>
        <Button
          variant="destructive"
          disabled={!packSetId || isDeletingAuthPackFromCache}
          loading={isDeletingAuthPackFromCache}
          onPress={async () => {
            if (!packSetId) {
              setDeleteAuthPackFromCacheResult(
                '❌ Error: No packSetId available. Please login first.',
              );
              return;
            }
            try {
              setIsDeletingAuthPackFromCache(true);
              setDeleteAuthPackFromCacheResult(
                '⏳ Deleting auth pack from cache...',
              );
              await backgroundApiProxy.serviceKeylessWallet.removeAuthPackFromCache(
                {
                  packSetId,
                },
              );
              setDeleteAuthPackFromCacheResult(
                '✅ Auth pack deleted from cache successfully!',
              );
              Toast.success({
                title: 'Delete Success',
                message: 'Auth pack has been deleted from cache.',
              });
            } catch (e: any) {
              const errorMessage = (e as Error)?.message ?? 'Unknown error';
              setDeleteAuthPackFromCacheResult(`❌ Error: ${errorMessage}`);
              Toast.error({
                title: 'Delete Failed',
                message: errorMessage,
              });
            } finally {
              setIsDeletingAuthPackFromCache(false);
            }
          }}
        >
          Delete Auth Pack From Cache
        </Button>
        <Button
          variant="destructive"
          disabled={!packSetId || isDeletingWallet}
          loading={isDeletingWallet}
          onPress={async () => {
            if (!packSetId) {
              setDeleteWalletResult(
                '❌ Error: No packSetId available. Please login first.',
              );
              return;
            }
            try {
              setIsDeletingWallet(true);
              setDeleteWalletResult('⏳ Deleting wallet...');
              await backgroundApiProxy.serviceKeylessWallet.removeKeylessWallet(
                {
                  packSetId,
                },
              );
              setDeleteWalletResult('✅ Wallet deleted successfully!');
              Toast.success({
                title: 'Delete Success',
                message: 'Wallet has been deleted.',
              });
            } catch (e: any) {
              const errorMessage = (e as Error)?.message ?? 'Unknown error';
              setDeleteWalletResult(`❌ Error: ${errorMessage}`);
              Toast.error({
                title: 'Delete Failed',
                message: errorMessage,
              });
            } finally {
              setIsDeletingWallet(false);
            }
          }}
        >
          Delete Wallet
        </Button>
        {deleteAuthPackResult ? (
          <YStack gap="$2" p="$3" borderRadius="$2" bg="$bgSubdued">
            <SizableText size="$headingSm">
              Delete Auth Pack From Server Result:
            </SizableText>
            <SizableText size="$bodyMd" selectable>
              {deleteAuthPackResult}
            </SizableText>
          </YStack>
        ) : null}
        {deleteDevicePackResult ? (
          <YStack gap="$2" p="$3" borderRadius="$2" bg="$bgSubdued">
            <SizableText size="$headingSm">
              Delete Device Pack Result:
            </SizableText>
            <SizableText size="$bodyMd" selectable>
              {deleteDevicePackResult}
            </SizableText>
          </YStack>
        ) : null}
        {deleteAuthPackFromCacheResult ? (
          <YStack gap="$2" p="$3" borderRadius="$2" bg="$bgSubdued">
            <SizableText size="$headingSm">
              Delete Auth Pack From Cache Result:
            </SizableText>
            <SizableText size="$bodyMd" selectable>
              {deleteAuthPackFromCacheResult}
            </SizableText>
          </YStack>
        ) : null}
        {deleteWalletResult ? (
          <YStack gap="$2" p="$3" borderRadius="$2" bg="$bgSubdued">
            <SizableText size="$headingSm">Delete Wallet Result:</SizableText>
            <SizableText size="$bodyMd" selectable>
              {deleteWalletResult}
            </SizableText>
          </YStack>
        ) : null}
        <Button
          variant="primary"
          disabled={enableKeylessWalletLoading}
          loading={enableKeylessWalletLoading}
          onPress={async () => {
            try {
              await enableKeylessWallet({
                fromScene: EKeylessWalletEnableScene.Onboarding,
              });
            } catch (e: any) {
              const errorMessage = (e as Error)?.message ?? 'Unknown error';
              Toast.error({
                title: 'Enable Wallet Error',
                message: errorMessage,
              });
            }
          }}
        >
          {enableKeylessWalletLoading ? 'Enabling...' : 'Enable Wallet'}
        </Button>
        <Button
          variant="primary"
          disabled={enableKeylessWalletLoading}
          loading={enableKeylessWalletLoading}
          onPress={async () => {
            try {
              await enableKeylessWallet({
                fromScene: EKeylessWalletEnableScene.Onboarding,
                restoreAuthPackFromServer: true,
              });
            } catch (e: any) {
              const errorMessage = (e as Error)?.message ?? 'Unknown error';
              Toast.error({
                title: 'Enable Wallet Error',
                message: errorMessage,
              });
            }
          }}
        >
          {enableKeylessWalletLoading
            ? 'Enabling...'
            : 'Enable Wallet (Restore AuthPack From Server)'}
        </Button>
      </YStack>

      {getDevicePackStep.status === 'success' ||
      getAuthPackFromCacheStep.status === 'success' ||
      getAuthPackFromServerStep.status === 'success' ||
      getCloudPackStep.status === 'success' ? (
        <YStack gap="$2" p="$3" borderRadius="$2" bg="$bgSubdued">
          <SizableText size="$headingSm">Results:</SizableText>
          {getDevicePackStep.status === 'success' ? (
            <Button
              size="small"
              variant="secondary"
              onPress={() => {
                Dialog.debugMessage({
                  debugMessage: {
                    getDevicePack: getDevicePackStep.result,
                  },
                });
              }}
            >
              View Device Pack Result
            </Button>
          ) : null}
          {getAuthPackFromCacheStep.status === 'success' ? (
            <Button
              size="small"
              variant="secondary"
              onPress={() => {
                Dialog.debugMessage({
                  debugMessage: {
                    getAuthPackFromCache: getAuthPackFromCacheStep.result,
                  },
                });
              }}
            >
              View Auth Pack From Cache Result
            </Button>
          ) : null}
          {getAuthPackFromServerStep.status === 'success' ? (
            <Button
              size="small"
              variant="secondary"
              onPress={() => {
                Dialog.debugMessage({
                  debugMessage: {
                    getAuthPackFromServer: getAuthPackFromServerStep.result,
                  },
                });
              }}
            >
              View Auth Pack From Server Result
            </Button>
          ) : null}
          {getCloudPackStep.status === 'success' ? (
            <Button
              size="small"
              variant="secondary"
              onPress={() => {
                Dialog.debugMessage({
                  debugMessage: {
                    getCloudPack: getCloudPackStep.result,
                  },
                });
              }}
            >
              View Cloud Pack Result
            </Button>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  );
}
