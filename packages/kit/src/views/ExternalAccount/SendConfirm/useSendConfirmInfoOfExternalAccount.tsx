import { useCallback, useEffect, useRef, useState } from 'react';

import type { IBaseExternalAccountInfo } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityWalletConnect';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useWalletConnectQrcodeModal } from '../../../components/WalletConnect/useWalletConnectQrcodeModal';
import { terminateWcConnection } from '../../../components/WalletConnect/utils/terminateWcConnection';
import {
  WALLET_CONNECT_SEND_SHOW_MISMATCH_CONFIRM_DELAY,
  WALLET_CONNECT_SEND_SHOW_RECONNECT_QRCODE_MODAL_DELAY,
} from '../../../components/WalletConnect/walletConnectConsts';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { wait } from '../../../utils/helper';
import { showDialog } from '../../../utils/overlayUtils';
import { getInjectedConnector } from '../injectedConnectors';

import { DialogConfirmMismatchOrContinue } from './DialogConfirmMismatchOrContinue';

import type { OneKeyWalletConnector } from '../../../components/WalletConnect/OneKeyWalletConnector';
import type { IConnectToWalletResult } from '../../../components/WalletConnect/useWalletConnectQrcodeModal';
import type { WalletConnectClientForDapp } from '../../../components/WalletConnect/WalletConnectClientForDapp';
import type { IWalletConnectExternalAccountInfo } from '../../Send/types';
import type { InjectedConnectorInfo } from '../injectedConnectors';
import type { IDialogConfirmMismatchContinueInfo } from './DialogConfirmMismatchOrContinue';

type IGetExternalConnectorReturn = {
  injectedConnectorInfo?: InjectedConnectorInfo;
  wcConnector?: OneKeyWalletConnector | null;
  client?: WalletConnectClientForDapp;
  accountInfo: IBaseExternalAccountInfo | undefined;
};

export function useSendConfirmInfoOfExternalAccount({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const { engine, serviceWalletConnect } = backgroundApiProxy;
  const { connectToWallet } = useWalletConnectQrcodeModal();

  const isUnmountedRef = useRef<boolean>(false);
  useEffect(
    () => () => {
      isUnmountedRef.current = true;
    },
    [],
  );

  const [externalAccountInfo, setExternalAccountInfo] = useState<
    IWalletConnectExternalAccountInfo | undefined
  >();
  const navigation = useAppNavigation();
  const showMismatchConfirm = useCallback(
    ({
      client,
      walletUrl,
      shouldTerminateConnection,
      shouldGoBack,
      ...others
    }: {
      client: WalletConnectClientForDapp | undefined | null;
      walletUrl?: string;
      shouldTerminateConnection?: boolean;
      shouldGoBack?: boolean;
    } & IDialogConfirmMismatchContinueInfo) =>
      new Promise((resolve) => {
        showDialog(
          <DialogConfirmMismatchOrContinue
            {...others}
            onSubmit={() => {
              resolve(true);
            }}
            onCancel={async () => {
              if (shouldTerminateConnection) {
                await terminateWcConnection({
                  client,
                  walletUrl,
                });
              }
              if (shouldGoBack) {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                }
              }
              resolve(false);
            }}
          />,
        );
      }),
    [navigation],
  );

  const getExternalAccountInfo = useCallback(async () => {
    // TODO external wallet type check
    // WalletConnect send tx (wallet-connect)
    const { session, walletService, accountInfo } =
      await serviceWalletConnect.getWalletConnectSessionOfAccount({
        accountId,
      });
    const currentNetwork = await engine.getNetwork(networkId);
    const currentAccount = await engine.getAccount(accountId, networkId);

    const externalInfo: IWalletConnectExternalAccountInfo = {
      accountInfo,
      walletService,
      session,
      currentAccount,
      currentNetwork,
      client: undefined,
      injectedConnectorInfo: undefined,
    };
    setExternalAccountInfo(externalInfo);
    return externalInfo;
  }, [accountId, engine, networkId, serviceWalletConnect]);

  const getExternalConnector =
    useCallback(async (): Promise<IGetExternalConnectorReturn> => {
      const {
        session: savedSession,
        walletService,
        accountInfo,
        currentAccount,
        currentNetwork,
      } = await getExternalAccountInfo();
      const isInjectedProvider = accountInfo?.type === 'injectedProvider';
      const isWalletConnectProvider = accountInfo?.type === 'walletConnect';

      const defaultReturn: IGetExternalConnectorReturn = {
        accountInfo,
        wcConnector: undefined,
        client: undefined,
        injectedConnectorInfo: undefined,
      };

      let wcConnector: OneKeyWalletConnector | undefined | null;
      let client: WalletConnectClientForDapp | undefined;
      let injectedConnectorInfo: InjectedConnectorInfo | undefined;
      let chainId: number | undefined = NaN;
      let accounts: string[] | undefined = [];

      const connectToWalletResult: IConnectToWalletResult = {
        walletService,
      };

      if (isWalletConnectProvider) {
        if (!savedSession?.connected) {
          await wait(WALLET_CONNECT_SEND_SHOW_RECONNECT_QRCODE_MODAL_DELAY);
          if (isUnmountedRef.current) {
            return defaultReturn;
          }
        }
        // { accounts, chainId, peerId, peerMeta }
        const {
          status: connectorStatus,
          session,
          client: wcClient,
        } = await connectToWallet({
          session: savedSession,
          walletService,
          accountId,
        });
        client = wcClient;

        setExternalAccountInfo((info) => {
          if (info) {
            return {
              ...info,
              session,
              client,
            };
          }
          return info;
        });
        wcConnector = client?.connector;
        if (!wcConnector) {
          throw new Error('WalletConnect Error: connector not initialized.');
        }
        // TODO currentAccount type is external, get currentAccount peerMeta
        // TODO connector.connect();

        chainId = wcConnector.chainId;
        accounts = wcConnector.accounts;
        connectToWalletResult.client = wcClient;
        connectToWalletResult.session = session;
        connectToWalletResult.status = connectorStatus;
      }

      if (isInjectedProvider) {
        injectedConnectorInfo = getInjectedConnector({
          name: accountInfo?.walletName,
        });
        const { store } = injectedConnectorInfo;

        // init provider connection state by activate() or connectEagerly()
        // connectEagerly won't reconnect if wallet disconnect dapp.
        await injectedConnectorInfo.connector?.connectEagerly?.();

        let state = store.getState();
        if (!state?.accounts?.length) {
          await injectedConnectorInfo.connector.activate();
          state = store.getState();
        }

        chainId = state.chainId;
        accounts = state.accounts;
        connectToWalletResult.injectedProviderState = state;
        connectToWalletResult.externalAccountInfo = accountInfo;

        setExternalAccountInfo((info) => {
          if (info) {
            return {
              ...info,
              injectedConnectorInfo,
            };
          }
          return info;
        });
      }

      const peerChainId = `${chainId ?? ''}`;
      const peerAddress = (accounts?.[0] || '').toLowerCase();
      const myAddress = currentAccount.address;
      const myChainId = currentNetwork.extraInfo.networkVersion;

      const isAddressMismatched = peerAddress !== myAddress;
      const isChainMismatched = peerChainId !== myChainId;

      if (isAddressMismatched || isChainMismatched) {
        await wait(
          isWalletConnectProvider
            ? WALLET_CONNECT_SEND_SHOW_MISMATCH_CONFIRM_DELAY
            : 600,
        );
        if (isUnmountedRef.current) {
          return defaultReturn;
        }
        const shouldContinue = await showMismatchConfirm({
          myAddress,
          myChainId,
          peerAddress,
          peerChainId,
          client,
          accountInfo,
          currentAccount,
          currentNetwork,
          isAddressMismatched,
          isChainMismatched,
          walletUrl: accountInfo?.walletUrl,
          shouldGoBack: true,
          connectToWalletResult,
        });
        if (!shouldContinue) {
          return defaultReturn;
        }
      }

      // TODO create wc connector, and check peerMeta.url, chainId, accounts matched,

      // TODO reject app gesture down close modal
      // TODO injected provider.sendTransaction in Ext
      // TODO invoke app by DeepLinking
      //    nextConnector.on(ConnectorEvents.CALL_REQUEST_SENT

      if (isUnmountedRef.current) {
        return defaultReturn;
      }
      return {
        injectedConnectorInfo,
        wcConnector,
        client,
        accountInfo,
      };
    }, [
      accountId,
      connectToWallet,
      getExternalAccountInfo,
      showMismatchConfirm,
    ]);

  return {
    externalAccountInfo,
    getExternalConnector,
  };
}
