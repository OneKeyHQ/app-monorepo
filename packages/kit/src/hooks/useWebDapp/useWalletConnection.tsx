import { useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IExternalConnectionInfo } from '@onekeyhq/shared/types/externalWallet.types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { ConnectToWalletDialogContent } from '../../components/WebDapp/ConnectToWalletDialogContent';

import { useConnectExternalWallet } from './useConnectExternalWallet';

// Hook for wallet connection logic - shared between WalletItem and WalletConnectListItem
export function useWalletConnection({
  name,
  connectionInfo,
}: {
  name?: string;
  connectionInfo: IExternalConnectionInfo;
}) {
  const intl = useIntl();
  const {
    connectToWallet,
    loading,
    localLoading,
    hideLoading,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    showLoading,
    setLoadingRef,
  } = useConnectExternalWallet();

  const dialogRef = useRef<IDialogInstance | null>(null);
  const connectionGenerationRef = useRef(0);
  const isMountedRef = useRef(true);
  const shouldCancelWalletConnectOnDialogCloseRef = useRef(false);

  const closeDialogWithoutCancelling = useCallback(async () => {
    shouldCancelWalletConnectOnDialogCloseRef.current = false;
    await dialogRef.current?.close();
  }, []);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  const isWalletConnect = !!connectionInfo.walletConnect;

  useEffect(() => {
    // An SDK modal close can belong to a superseded pairing. WalletConnect
    // loading is owned by the connection promise and its progress dialog.
    if (!loading || isWalletConnect) {
      return;
    }
    const fn = (state: { open: boolean }) => {
      if (state.open === false && loadingRef.current && isMountedRef.current) {
        hideLoading();
      }
    };
    appEventBus.on(EAppEventBusNames.WalletConnectModalState, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletConnectModalState, fn);
    };
  }, [hideLoading, isWalletConnect, loading]);

  useEffect(() => {
    const fn = async (state: { open: boolean; attemptId?: number }) => {
      if (
        state.open === true &&
        (platformEnv.isNative || platformEnv.isDesktop) &&
        isWalletConnect
      ) {
        const generation = connectionGenerationRef.current;
        const progress = await backgroundApiProxy.serviceWalletConnect
          .getDappSideConnectionProgress()
          .catch(() => undefined);
        if (
          !isMountedRef.current ||
          generation !== connectionGenerationRef.current ||
          state.attemptId === undefined ||
          state.attemptId !== progress?.attemptId
        ) {
          return;
        }
        // Dialog component will cover the WalletConnectSDK modal, so we need to manually close the Dialog
        // search: zIndex: 99993173
        await closeDialogWithoutCancelling();

        if (platformEnv.isNative) {
          // Wait for Fabric cleanup before opening the SDK modal.
          await timerUtils.wait(100);
        }
      }
    };
    appEventBus.on(EAppEventBusNames.WalletConnectModalState, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletConnectModalState, fn);
    };
  }, [closeDialogWithoutCancelling, isWalletConnect]);

  const connectToWalletWithDialogShow = useCallback(async () => {
    console.log('WalletItem onPress');
    if (loading || loadingRef.current) {
      return;
    }
    connectionGenerationRef.current += 1;
    const generation = connectionGenerationRef.current;
    const closeOwnedDialog = async () => {
      if (generation === connectionGenerationRef.current) {
        await closeDialogWithoutCancelling();
      }
    };
    let shouldShowDialogLoading = true;
    if (platformEnv.isNative && isWalletConnect) {
      // shouldShowDialogLoading = false;
      shouldShowDialogLoading = true;
    }
    // Don't check loading state - let user try again if needed
    await closeDialogWithoutCancelling();

    // Wait for React Native Fabric to complete view cleanup
    // This prevents valtio destructuring errors in WalletConnect modal
    if (platformEnv.isNative) {
      await timerUtils.wait(100);
    }

    if (
      !isMountedRef.current ||
      generation !== connectionGenerationRef.current
    ) {
      return;
    }

    if (shouldShowDialogLoading) {
      shouldCancelWalletConnectOnDialogCloseRef.current = true;
      dialogRef.current = Dialog.show({
        title:
          (platformEnv.isNative || platformEnv.isDesktop) && isWalletConnect
            ? undefined
            : intl.formatMessage(
                { id: ETranslations.global_connect_to_wallet },
                {
                  wallet: name || 'Wallet', // name || 'Wallet'
                },
              ),
        showFooter: false,
        dismissOnOverlayPress: false,
        // The zero-inset first frame only happens inside the iOS
        // FullWindowOverlay portal; Android must not pad with the startup
        // snapshot (stale under edge-to-edge gesture navigation).
        useInitialSafeAreaBottomInsetFallback:
          platformEnv.isNativeIOS && isWalletConnect,
        onClose() {
          if (generation !== connectionGenerationRef.current) return;
          if (
            (platformEnv.isNative || platformEnv.isDesktop) &&
            isWalletConnect &&
            shouldCancelWalletConnectOnDialogCloseRef.current
          ) {
            shouldCancelWalletConnectOnDialogCloseRef.current = false;
            appEventBus.emit(
              EAppEventBusNames.WalletConnectCloseModal,
              undefined,
            );
            void backgroundApiProxy.serviceWalletConnect.abortConnectPairing({
              uri: '',
            });
          }
          if (isMountedRef.current) {
            setLoadingRef.current?.(false);
          }
        },
        renderContent: (
          <ConnectToWalletDialogContent
            isWalletConnect={isWalletConnect}
            onSocketProgressExhausted={closeOwnedDialog}
            onRetryPress={async () => {
              try {
                const result = await connectToWallet(connectionInfo);
                if (result !== false) {
                  await closeOwnedDialog();
                }
              } catch {
                // Dialog stays open to allow further retries
              }
            }}
          />
        ),
      });
    }

    try {
      await connectToWallet(connectionInfo);
      // Connection successful - close the dialog
      await closeOwnedDialog();
    } catch (error) {
      // Connection failed - dialog stays open to show retry button
      if (generation === connectionGenerationRef.current) {
        console.error('Wallet connection failed:', error);
      }
      throw error;
    }
  }, [
    connectToWallet,
    closeDialogWithoutCancelling,
    connectionInfo,
    intl,
    isWalletConnect,
    loading,
    name,
    setLoadingRef,
  ]);

  return {
    localLoading,
    universalLoading: loading,
    loading: false, // Use global loading state in Dialog content
    connectToWalletWithDialogShow,
  };
}
