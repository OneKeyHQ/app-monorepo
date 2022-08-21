import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Dialog,
  DialogManager,
  HStack,
  Image,
  Text,
  VStack,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { IMPL_EVM } from '@onekeyhq/engine/src/constants';
import { ISimpleDbWalletConnectAccountInfo } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityWalletConnect';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { generateNetworkIdByChainId } from '@onekeyhq/engine/src/managers/network';
import { Account } from '@onekeyhq/engine/src/types/account';
import { Network } from '@onekeyhq/engine/src/types/network';
import LogoOneKey from '@onekeyhq/kit/assets/onboarding/logo_onekey.png';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { wait } from '../../utils/helper';
import { IWalletConnectExternalAccountInfo } from '../../views/Send/types';

import ExternalAccountImg from './ExternalAccountImg';
import { OneKeyWalletConnector } from './OneKeyWalletConnector';
import { useWalletConnectQrcodeModal } from './useWalletConnectQrcodeModal';
import { WalletConnectClientForDapp } from './WalletConnectClientForDapp';
import {
  WALLET_CONNECT_SEND_SHOW_MISMATCH_CONFIRM_DELAY,
  WALLET_CONNECT_SEND_SHOW_RECONNECT_QRCODE_MODAL_DELAY,
} from './walletConnectConsts';
import walletConnectUtils from './walletConnectUtils';

type IDialogConfirmMismatchContinueInfo = {
  myAddress: string;
  myChainId: string;
  peerAddress: string;
  peerChainId: string;
  accountInfo?: ISimpleDbWalletConnectAccountInfo | undefined;
  currentAccount: Account;
  currentNetwork: Network;
  isAddressMismatched: boolean;
  isChainMismatched: boolean;
};
export type IDialogConfirmMismatchContinueProps = {
  onClose?: () => void;
  onSubmit: () => void;
  onCancel: () => void;
} & IDialogConfirmMismatchContinueInfo;
function DialogConfirmMismatchOrContinue(
  props: IDialogConfirmMismatchContinueProps,
) {
  const intl = useIntl();
  const {
    onClose,
    onCancel,
    onSubmit,
    peerAddress,
    myAddress,
    peerChainId,
    // myChainId,
    accountInfo,
    currentAccount,
    currentNetwork,
    isAddressMismatched,
    isChainMismatched,
  } = props;
  const { engine } = backgroundApiProxy;
  const { result: peerNetwork } = usePromiseResult(async () => {
    try {
      const networkId = generateNetworkIdByChainId({
        impl: IMPL_EVM,
        chainId: peerChainId,
      });
      return await engine.getNetwork(networkId);
    } catch (error) {
      debugLogger.common.error(error);
      return undefined;
    }
  }, [peerChainId]);
  const msgId = useMemo(() => {
    if (isAddressMismatched && isChainMismatched) {
      return 'content__account_and_network_not_matched';
    }
    if (isAddressMismatched) {
      return 'content__account_is_not_matched';
    }
    if (isChainMismatched) {
      return 'content__chain_is_not_matched';
    }
  }, [isAddressMismatched, isChainMismatched]);
  return (
    <Dialog
      visible
      onClose={() => {
        onClose?.();
      }}
      contentProps={{
        // title: intl.formatMessage({ id: 'action__remove_account' }),
        // content: ''
        contentElement: (
          <VStack space={6} alignSelf="stretch">
            <Alert
              title={intl.formatMessage({
                id: msgId,
              })}
              alertType="info"
              dismiss={false}
            />
            <VStack>
              <HStack>
                <Image source={LogoOneKey} borderRadius="6px" size={6} />
                <Text typography="Body1Strong" ml={3}>
                  OneKey
                </Text>
              </HStack>
              <HStack justifyContent="space-between" py={3}>
                <Text typography="Body2Strong" color="text-subdued">
                  {intl.formatMessage({ id: 'form__account' })}
                </Text>
                <Text typography="Body2">{shortenAddress(myAddress)}</Text>
              </HStack>
              <HStack justifyContent="space-between" py={3}>
                <Text typography="Body2Strong" color="text-subdued">
                  {intl.formatMessage({ id: 'network__network' })}
                </Text>
                <Text typography="Body2">{currentNetwork.shortName}</Text>
              </HStack>
            </VStack>
            <VStack>
              <HStack>
                <ExternalAccountImg
                  accountId={currentAccount.id}
                  size={6}
                  radius="6px"
                />
                <Text typography="Body1Strong" ml={3}>
                  {accountInfo?.walletName || '3rd Wallet'}
                </Text>
              </HStack>
              <HStack justifyContent="space-between" py={3}>
                <Text typography="Body2Strong" color="text-subdued">
                  {intl.formatMessage({ id: 'form__account' })}
                </Text>
                <Text
                  typography="Body2"
                  color={isAddressMismatched ? 'text-critical' : 'text-default'}
                >
                  {shortenAddress(peerAddress)}
                </Text>
              </HStack>
              <HStack justifyContent="space-between" py={3}>
                <Text typography="Body2Strong" color="text-subdued">
                  {intl.formatMessage({ id: 'network__network' })}
                </Text>
                <Text
                  typography="Body2"
                  color={isChainMismatched ? 'text-critical' : 'text-default'}
                >
                  {peerNetwork?.shortName || `chainId=${peerChainId}`}
                </Text>
              </HStack>
            </VStack>
          </VStack>
        ),
      }}
      footerButtonProps={{
        primaryActionProps: {
          type: 'primary',
        },
        primaryActionTranslationId: 'action__continue',
        onPrimaryActionPress: () => {
          onSubmit();
          onClose?.();
        },
        onSecondaryActionPress: () => {
          onCancel();
          onClose?.();
        },
      }}
    />
  );
}

type IGetExternalConnectorReturn = {
  connector?: OneKeyWalletConnector;
  client?: WalletConnectClientForDapp;
};

export function useWalletConnectSendInfo({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const { engine } = backgroundApiProxy;
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
      client: WalletConnectClientForDapp;
      walletUrl?: string;
      shouldTerminateConnection?: boolean;
      shouldGoBack?: boolean;
    } & IDialogConfirmMismatchContinueInfo) =>
      new Promise((resolve) => {
        DialogManager.show({
          render: (
            <DialogConfirmMismatchOrContinue
              {...others}
              onSubmit={() => {
                resolve(true);
              }}
              onCancel={async () => {
                if (shouldTerminateConnection) {
                  await walletConnectUtils.terminateWcConnection({
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
            />
          ),
        });
      }),
    [navigation],
  );

  const getExternalConnector =
    useCallback(async (): Promise<IGetExternalConnectorReturn> => {
      // TODO external wallet type check
      // WalletConnect send tx (wallet-connect)
      const {
        session: savedSession,
        walletService,
        accountInfo,
      } = await simpleDb.walletConnect.getExternalAccountSession({ accountId });
      const currentNetwork = await engine.getNetwork(networkId);
      const currentAccount = await engine.getAccount(accountId, networkId);

      const defaultReturn: IGetExternalConnectorReturn = {
        connector: undefined,
        client: undefined,
      };

      setExternalAccountInfo({
        accountInfo,
        session: savedSession,
        walletService,
        currentAccount,
        currentNetwork,
        client: undefined,
      });

      if (!savedSession?.connected) {
        await wait(WALLET_CONNECT_SEND_SHOW_RECONNECT_QRCODE_MODAL_DELAY);
        if (isUnmountedRef.current) {
          return defaultReturn;
        }
      }
      // { accounts, chainId, peerId, peerMeta }
      const {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        status: connectorStatus,
        session,
        client,
      } = await connectToWallet({
        session: savedSession,
        walletService,
        accountId,
      });

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

      const { connector } = client;
      if (!connector) {
        throw new Error('WalletConnect Error: connector not initialized.');
      }
      // TODO currentAccount type is external, get currentAccount peerMeta
      // TODO connector.connect();

      const peerChainId = `${connector.chainId}`;
      const peerAddress = (connector.accounts?.[0] || '').toLowerCase();
      const myAddress = currentAccount.address;
      const myChainId = currentNetwork.extraInfo.networkVersion;

      const isAddressMismatched = peerAddress !== myAddress;
      const isChainMismatched = peerChainId !== myChainId;

      if (isAddressMismatched || isChainMismatched) {
        await wait(WALLET_CONNECT_SEND_SHOW_MISMATCH_CONFIRM_DELAY);
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
      return { connector, client };
    }, [accountId, connectToWallet, engine, networkId, showMismatchConfirm]);

  return {
    externalAccountInfo,
    getExternalConnector,
  };
}
