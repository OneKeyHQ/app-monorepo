import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import { Toast, resetOnboardingModal } from '@onekeyhq/components';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useOnboardingConnectWalletLoadingAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { WALLET_TYPE_EXTERNAL } from '@onekeyhq/shared/src/consts/dbConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IKeylessPendingLogin } from '@onekeyhq/shared/src/keylessWallet/keylessWebTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IConnectExternalWalletPayload } from '@onekeyhq/shared/types/analytics/onboarding';
import type {
  IConnectToWalletOptions,
  IExternalConnectionInfo,
} from '@onekeyhq/shared/types/externalWallet.types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  useAccountSelectorActions,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';

import keylessWebPendingLoginCache from './keylessWebPendingLoginCache';

function hasAuthorizedAddresses(
  addresses: Record<string, string> | undefined,
): boolean {
  return Object.values(addresses || {}).some((value) =>
    value
      ?.split(',')
      ?.map((item) => item.trim())
      ?.some(Boolean),
  );
}

export function useConnectExternalWallet() {
  const [jotaiLoading, setJotaiLoading] =
    useOnboardingConnectWalletLoadingAtom();
  const [localLoading, setLocalLoading] = useState(false);
  const intl = useIntl();
  const actions = useAccountSelectorActions();
  const { selectedAccount } = useSelectedAccount({ num: 0 });

  const loading = jotaiLoading || localLoading;
  const setLoading = useCallback(
    (v: boolean) => {
      setJotaiLoading(v);
      setLocalLoading(v);
    },
    [setJotaiLoading],
  );

  const dialogRef = useRef<IDialogInstance | null>(null);
  const setLoadingRef = useRef(setLoading);
  setLoadingRef.current = setLoading;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  const hideLoadingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const hideLoading = useCallback(() => {
    clearTimeout(hideLoadingTimer.current);
    // delay hide loading to avoid connectToWallet mistake checking if Dialog is closed
    hideLoadingTimer.current = setTimeout(() => {
      setLoading(false);
    }, 600);
  }, [setLoading]);

  const showLoading = useCallback(() => {
    clearTimeout(hideLoadingTimer.current);
    setLoading(true);
  }, [setLoading]);

  const getExternalWalletConnectionDetails = (params: {
    externalConnectionInfo: IExternalConnectionInfo;
  }): Pick<
    IConnectExternalWalletPayload,
    'protocol' | 'walletName' | 'network'
  > => {
    const { externalConnectionInfo } = params;
    const protocol: IConnectExternalWalletPayload['protocol'] = (() => {
      if (externalConnectionInfo?.walletConnect) return 'WalletConnect';
      if (externalConnectionInfo?.evmEIP6963) return 'EIP6963';
      if (externalConnectionInfo?.evmInjected) return 'EVMInjected';
      return 'unknown';
    })();

    const walletName = (() => {
      if (externalConnectionInfo?.walletConnect?.peerMeta?.name) {
        return externalConnectionInfo.walletConnect.peerMeta.name;
      }
      if (externalConnectionInfo?.evmEIP6963?.info?.name) {
        return externalConnectionInfo.evmEIP6963.info.name;
      }
      if (externalConnectionInfo?.evmInjected) {
        return externalConnectionInfo.evmInjected.name || 'Injected';
      }
      return 'unknown';
    })();

    const network = 'evm';

    return { protocol, walletName: walletName || 'unknown', network };
  };

  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const connectToWallet = useCallback(
    async (
      connectionInfo: IExternalConnectionInfo,
      options?: IConnectToWalletOptions,
    ) => {
      try {
        const beforeConnectInfo = getExternalWalletConnectionDetails({
          externalConnectionInfo: connectionInfo,
        });
        defaultLogger.account.wallet.onboard({
          onboardMethod: 'connect3rdPartyWallet',
        });
        defaultLogger.account.wallet.addWalletStarted({
          addMethod: 'Connect3rdPartyWallet',
          details: {
            protocol: beforeConnectInfo.protocol,
            network: beforeConnectInfo.network,
            walletName: beforeConnectInfo.walletName,
          },
          isSoftwareWalletOnlyUser,
        });
        showLoading();
        const connectResult =
          await backgroundApiProxy.serviceDappSide.connectExternalWallet({
            connectionInfo,
            connectToWalletOptions: options,
          });

        // if (
        //   !loadingRef.current &&
        //   Object.keys(connectResult?.accountInfo?.addresses || {}).length === 0
        // ) {
        //   Toast.error({
        //     title: intl.formatMessage({
        //       id: ETranslations.feedback_connection_request_denied,
        //     }),
        //   });
        //   return false;

        const hasAuthorizedAddress = hasAuthorizedAddresses(
          connectResult?.accountInfo?.addresses,
        );
        if (!hasAuthorizedAddress) {
          if (!options?.suppressDeniedToast) {
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.feedback_connection_request_denied,
              }),
            });
          }
          if (options?.allowEmptyAuthorizedAddresses) {
            return false;
          }
          throw new OneKeyLocalError(
            'External wallet has no authorized account',
          );
        }

        const r = await backgroundApiProxy.serviceAccount.addExternalAccount({
          connectResult,
        });
        const account = r?.accounts?.[0];
        if (!account) {
          throw new OneKeyLocalError('Failed to create external account');
        }
        const usedNetworkId = accountUtils.getAccountCompatibleNetwork({
          account,
          networkId: account.createAtNetwork || selectedAccount.networkId,
        });
        await actions.current.updateSelectedAccountForSingletonAccount({
          num: 0,
          networkId: usedNetworkId,
          walletId: WALLET_TYPE_EXTERNAL,
          othersWalletAccountId: account.id,
        });
        // Atomically drop OnboardingModal (the wallet-add sub-page sits
        // inside it) in one reset dispatch. Avoids the popStack() animated
        // dismiss that causes the iOS RNSScreenStack window=NIL retry storm,
        // and preserves any non-onboarding parent overlay (LiteCard, KeyTag,
        // Swap, Perp, etc.) the user may have come from.
        resetOnboardingModal();
        await timerUtils.wait(150);
        await dialogRef.current?.close();

        let finalConnectionInfo: IExternalConnectionInfo;
        try {
          if (r.accounts?.[0]?.connectionInfoRaw) {
            finalConnectionInfo = JSON.parse(
              r.accounts?.[0]?.connectionInfoRaw,
            );
          } else {
            finalConnectionInfo = connectionInfo;
          }
        } catch {
          finalConnectionInfo = connectionInfo;
        }
        const afterConnectInfo = getExternalWalletConnectionDetails({
          externalConnectionInfo: finalConnectionInfo,
        });
        defaultLogger.account.wallet.walletAdded({
          addMethod: 'Connect3rdPartyWallet',
          status: 'success',
          details: {
            protocol: afterConnectInfo.protocol,
            network: afterConnectInfo.network,
            walletName: afterConnectInfo.walletName,
          },
          isSoftwareWalletOnlyUser,
        });
        return true;
      } finally {
        hideLoading();
      }
    },
    [
      actions,
      hideLoading,
      intl,
      selectedAccount.networkId,
      showLoading,
      isSoftwareWalletOnlyUser,
    ],
  );

  const connectToWalletForKeylessSilently = useCallback(
    async (
      connectionInfo: IExternalConnectionInfo,
      options?: {
        provider?: EOAuthSocialLoginProvider;
        nonce?: string;
      },
    ) => {
      const cachedPendingLogin = options?.provider
        ? keylessWebPendingLoginCache.readKeylessPendingLogin()
        : undefined;

      let webKeylessPendingLogin: IKeylessPendingLogin | undefined =
        cachedPendingLogin;

      if (options?.provider) {
        const shouldReusePendingLogin =
          cachedPendingLogin?.provider === options.provider &&
          (!options.nonce || cachedPendingLogin?.nonce === options.nonce);

        if (!shouldReusePendingLogin) {
          keylessWebPendingLoginCache.clearKeylessPendingLogin({
            nonce: cachedPendingLogin?.nonce,
          });
          webKeylessPendingLogin =
            keylessWebPendingLoginCache.createKeylessPendingLogin({
              provider: options.provider,
              nonce: options.nonce || `silent-${Date.now()}`,
            });
        }
      }

      const connected = await connectToWallet(connectionInfo, {
        allowEmptyAuthorizedAddresses: true,
        suppressDeniedToast: true,
        skipDisconnectConnector: true,
        webKeylessPendingLogin,
      });

      if (connected) {
        keylessWebPendingLoginCache.clearKeylessPendingLogin({
          nonce: webKeylessPendingLogin?.nonce,
        });
      }

      return connected;
    },
    [connectToWallet],
  );

  const connectToWalletWithDialog = useCallback(
    async (connectionInfo: IExternalConnectionInfo) => {
      if (loading || loadingRef.current) {
        return;
      }
      // connect directly, do not show dialog
      await connectToWallet(connectionInfo);
    },
    [connectToWallet, loading],
  );

  return {
    connectToWallet,
    connectToWalletForKeylessSilently,
    connectToWalletWithDialog,
    localLoading,
    loading,
    hideLoading,
    showLoading,
    setLoadingRef,
  };
}
