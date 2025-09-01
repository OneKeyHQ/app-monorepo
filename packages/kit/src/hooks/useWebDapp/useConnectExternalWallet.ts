import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import { Toast } from '@onekeyhq/components';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useOnboardingConnectWalletLoadingAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { WALLET_TYPE_EXTERNAL } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IConnectExternalWalletPayload } from '@onekeyhq/shared/types/analytics/onboarding';
import type { IExternalConnectionInfo } from '@onekeyhq/shared/types/externalWallet.types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  useAccountSelectorActions,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';
import useAppNavigation from '../useAppNavigation';

export function useConnectExternalWallet() {
  const [jotaiLoading, setJotaiLoading] =
    useOnboardingConnectWalletLoadingAtom();
  const [localLoading, setLocalLoading] = useState(false);
  const intl = useIntl();
  const navigation = useAppNavigation();
  const actions = useAccountSelectorActions();
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();

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

  const connectToWallet = useCallback(
    async (connectionInfo: IExternalConnectionInfo) => {
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
          });
        if (!loadingRef.current) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.feedback_connection_request_denied,
            }),
          });
          return;
        }
        const r = await backgroundApiProxy.serviceAccount.addExternalAccount({
          connectResult,
        });
        const account = r?.accounts?.[0];
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
        navigation.popStack();
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
      } finally {
        hideLoading();
      }
    },
    [
      actions,
      hideLoading,
      intl,
      navigation,
      selectedAccount.networkId,
      showLoading,
      isSoftwareWalletOnlyUser,
    ],
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
    connectToWalletWithDialog,
    loading,
  };
}
