import React, { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, DialogManager, Text, VStack } from '@onekeyhq/components';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { wait } from '../../utils/helper';
import { IWalletConnectExternalAccountInfo } from '../../views/Send/types';

import { OneKeyWalletConnector } from './OneKeyWalletConnector';
import { useWalletConnectQrcodeModal } from './useWalletConnectQrcodeModal';
import { WalletConnectClientForDapp } from './WalletConnectClientForDapp';
import {
  WALLET_CONNECT_SHOW_MISMATCH_CONFIRM_DELAY,
  WALLET_CONNECT_SHOW_QRCODE_MODAL_DELAY,
} from './walletConnectConsts';
import walletConnectUtils from './walletConnectUtils';

export type IDialogConfirmMismatchContinueProps = {
  onClose?: () => void;
  onSubmit: () => void;
  onCancel: () => void;
  contentIds: string[];
};
function DialogConfirmMismatchOrContinue(
  props: IDialogConfirmMismatchContinueProps,
) {
  const intl = useIntl();
  const { onClose, onCancel, onSubmit, contentIds } = props;
  return (
    <Dialog
      visible
      onClose={() => {
        onClose?.();
      }}
      contentProps={{
        iconType: 'danger',
        // title: intl.formatMessage({ id: 'action__remove_account' }),
        // content: ''
        contentElement: (
          <VStack space={6} alignSelf="stretch">
            {contentIds.map((id) => (
              <Text
                key={id}
                mt="2"
                typography={{ sm: 'Body1', md: 'Body2' }}
                color="text-subdued"
                textAlign="center"
              >
                {intl.formatMessage({
                  id: id as any,
                })}
              </Text>
            ))}

            {/* <Alert
              title={intl.formatMessage({
                id: 'content__account_is_not_matched',
                // id: 'content__chain_is_not_matched',
                // id: 'content__account_and_network_not_matched',
              })}
              alertType="info"
              dismiss={false}
            />
            <VStack>
              <HStack>
                <Image src={LogoOneKey} borderRadius="6px" size={6} />
                <Text typography="Body1Strong" ml={3}>
                  OneKey
                </Text>
              </HStack>
              <HStack justifyContent="space-between" py={3}>
                <Text typography="Body2Strong" color="text-subdued">
                  {intl.formatMessage({ id: 'form__account' })}
                </Text>
                <Text typography="Body2">address here...</Text>
              </HStack>
              <HStack justifyContent="space-between" py={3}>
                <Text typography="Body2Strong" color="text-subdued">
                  {intl.formatMessage({ id: 'network__network' })}
                </Text>
                <Text typography="Body2">chain here...</Text>
              </HStack>
            </VStack>
            <VStack>
              <HStack>
                <Image src={LogoOneKey} borderRadius="6px" size={6} />
                <Text typography="Body1Strong" ml={3}>
                  3rd Wallet
                </Text>
              </HStack>
              <HStack justifyContent="space-between" py={3}>
                <Text typography="Body2Strong" color="text-subdued">
                  {intl.formatMessage({ id: 'form__account' })}
                </Text>
                <Text typography="Body2" color="text-critical">
                  address here...
                </Text>
              </HStack>
              <HStack justifyContent="space-between" py={3}>
                <Text typography="Body2Strong" color="text-subdued">
                  {intl.formatMessage({ id: 'network__network' })}
                </Text>
                <Text typography="Body2">chain here...</Text>
              </HStack>
            </VStack> */}
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

export function useWalletConnectSendInfo({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const { engine } = backgroundApiProxy;
  const { connectToWallet } = useWalletConnectQrcodeModal();
  const [externalAccountInfo, setExternalAccountInfo] = useState<
    IWalletConnectExternalAccountInfo | undefined
  >();
  const navigation = useAppNavigation();
  const showMismatchConfirm = useCallback(
    ({
      contentIds,
      client,
      walletUrl,
      shouldTerminateConnection,
      shouldGoBack,
    }: {
      contentIds: string[];
      client: WalletConnectClientForDapp;
      walletUrl?: string;
      shouldTerminateConnection?: boolean;
      shouldGoBack?: boolean;
    }) =>
      new Promise((resolve) => {
        DialogManager.show({
          render: (
            <DialogConfirmMismatchOrContinue
              contentIds={contentIds}
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

  const getExternalConnector = useCallback(async (): Promise<{
    connector?: OneKeyWalletConnector;
    client?: WalletConnectClientForDapp;
  }> => {
    // TODO external wallet type check
    // WalletConnect send tx (wallet-connect)
    const {
      session: savedSession,
      walletService,
      accountInfo,
    } = await simpleDb.walletConnect.getExternalAccountSession({ accountId });
    const currentNetwork = await engine.getNetwork(networkId);
    const currentAccount = await engine.getAccount(accountId, networkId);

    setExternalAccountInfo({
      accountInfo,
      session: savedSession,
      walletService,
      currentAccount,
      currentNetwork,
      client: undefined,
    });

    if (!savedSession?.connected) {
      await wait(WALLET_CONNECT_SHOW_QRCODE_MODAL_DELAY);
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

    const mismatchErrorIds = [
      peerAddress !== currentAccount.address &&
        'content__account_is_not_matched',
      peerChainId !== currentNetwork.extraInfo.networkVersion &&
        'content__chain_is_not_matched',
    ].filter(Boolean);
    if (mismatchErrorIds.length) {
      await wait(WALLET_CONNECT_SHOW_MISMATCH_CONFIRM_DELAY);
      const shouldContinue = await showMismatchConfirm({
        contentIds: mismatchErrorIds,
        client,
        walletUrl: accountInfo?.walletUrl,
        shouldGoBack: true,
      });
      if (!shouldContinue) {
        return { connector: undefined, client: undefined };
      }
    }

    // TODO create wc connector, and check peerMeta.url, chainId, accounts matched,

    // TODO reject app gesture down close modal
    // TODO injected provider.sendTransaction in Ext
    // TODO invoke app by DeepLinking
    //    nextConnector.on(ConnectorEvents.CALL_REQUEST_SENT

    return { connector, client };
  }, [accountId, connectToWallet, engine, networkId, showMismatchConfirm]);

  return {
    externalAccountInfo,
    getExternalConnector,
  };
}
