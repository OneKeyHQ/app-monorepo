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
  const isMountedRef = useRef(true);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  // Only add WalletConnect modal state listener for retry button
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  const isWalletConnect = !!connectionInfo.walletConnect;

  useEffect(() => {
    if (!loading) {
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
  }, [hideLoading, loading]);

  useEffect(() => {
    const fn = async (state: { open: boolean }) => {
      if (state.open === true && platformEnv.isNative && isWalletConnect) {
        // Dialog component will cover the WalletConnectSDK modal, so we need to manually close the Dialog
        // search: zIndex: 99993173
        await dialogRef.current?.close();

        // Wait for React Native Fabric to complete view cleanup
        // This prevents race conditions when opening WalletConnect modal
        await timerUtils.wait(100);
      }
    };
    appEventBus.on(EAppEventBusNames.WalletConnectModalState, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletConnectModalState, fn);
    };
  }, [isWalletConnect]);

  const connectToWalletWithDialogShow = useCallback(async () => {
    console.log('WalletItem onPress');
    if (loading || loadingRef.current) {
      return;
    }
    let shouldShowDialogLoading = true;
    if (platformEnv.isNative && isWalletConnect) {
      // shouldShowDialogLoading = false;
      shouldShowDialogLoading = true;
    }
    // Don't check loading state - let user try again if needed
    await dialogRef.current?.close();

    // Wait for React Native Fabric to complete view cleanup
    // This prevents valtio destructuring errors in WalletConnect modal
    if (platformEnv.isNative) {
      await timerUtils.wait(100);
    }

    if (!isMountedRef.current) return;

    if (shouldShowDialogLoading) {
      dialogRef.current = Dialog.show({
        title: intl.formatMessage(
          { id: ETranslations.global_connect_to_wallet },
          {
            wallet: name || 'Wallet', // name || 'Wallet'
          },
        ),
        showFooter: false,
        dismissOnOverlayPress: false,
        onClose() {
          if (isMountedRef.current) {
            setLoadingRef.current?.(false);
          }
        },
        renderContent: (
          <ConnectToWalletDialogContent
            onRetryPress={async () => {
              try {
                const result = await connectToWallet(connectionInfo);
                if (result !== false) {
                  await dialogRef.current?.close();
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
      await dialogRef.current?.close();
    } catch (error) {
      // Connection failed - dialog stays open to show retry button
      console.error('Wallet connection failed:', error);
      throw error;
    }
  }, [
    connectToWallet,
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
