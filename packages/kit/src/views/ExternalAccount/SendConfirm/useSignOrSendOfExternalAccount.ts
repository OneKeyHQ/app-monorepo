/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useCallback } from 'react';

import { cloneDeep, isString } from 'lodash';
import { useIntl } from 'react-intl';

import {
  ETHMessageTypes,
  getEthProviderMethodFromMessageType,
} from '@onekeyhq/engine/src/types/message';
import type { IUnsignedMessageBtc } from '@onekeyhq/engine/src/vaults/impl/btc/types';
import type {
  IEncodedTxEvm,
  IUnsignedMessageEvm,
} from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type { IEncodedTx } from '@onekeyhq/engine/src/vaults/types';
import type { IEncodedTxBtc } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import { isBTCNetwork } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { useSendConfirmInfoOfExternalAccount } from './useSendConfirmInfoOfExternalAccount';

export function useSignOrSendOfExternalAccount({
  encodedTx,
  unsignedMessage,
  sourceInfo,
  networkId,
  accountId,
  signOnly,
}: {
  encodedTx: IEncodedTx | undefined;
  unsignedMessage?: IUnsignedMessageEvm | IUnsignedMessageBtc | undefined;
  sourceInfo?: IDappSourceInfo | undefined;
  networkId: string;
  accountId: string;
  signOnly: boolean;
}) {
  const intl = useIntl();
  const { validator } = backgroundApiProxy;
  const { getExternalConnector, externalAccountInfo } =
    useSendConfirmInfoOfExternalAccount({
      accountId,
      networkId,
    });

  // use background service is not available here, as walletconnect connector is in UI )
  const sendTxForExternalAccount = useCallback(
    async (txForExternalAccount?: IEncodedTx) => {
      const tx = txForExternalAccount || encodedTx;
      if (!tx) {
        throw new Error('encodedTx is missing!');
      }
      let txid = '';
      const { wcConnector, injectedConnectorInfo, accountInfo } =
        await getExternalConnector();
      if (accountInfo?.type === 'walletConnect') {
        if (!wcConnector) {
          return;
        }
        if (signOnly) {
          txid = await wcConnector.signTransaction(tx as IEncodedTxEvm);
        } else {
          txid = await wcConnector.sendTransaction(tx as IEncodedTxEvm);
        }
      }
      if (accountInfo?.type === 'injectedProvider') {
        const connector = injectedConnectorInfo?.connector;
        if (!connector) {
          return;
        }
        txid = (await connector?.provider?.request({
          method: signOnly ? 'eth_signTransaction' : 'eth_sendTransaction',
          params: [tx],
        })) as string;
      }

      debugLogger.walletConnect.info(
        'sendTxForExternalAccount -> sendTransaction txid: ',
        txid,
      );
      // TODO currently ExternalAccount is for EVM only
      if (txid && (await validator.isValidEvmTxid({ txid }))) {
        return {
          txid,
          rawTx: '',
          encodedTx: tx,
        };
      }

      // BitKeep resolve('拒绝') but not reject(error)
      const errorMsg =
        txid && isString(txid)
          ? txid
          : intl.formatMessage({ id: 'msg__transaction_failed' });
      throw new Error(errorMsg);
    },
    [encodedTx, validator, intl, getExternalConnector, signOnly],
  );

  const signMsgForExternalAccount = useCallback(async () => {
    if (!unsignedMessage) {
      throw new Error('unsignedMessage is missing!');
    }
    const rawMesssage = unsignedMessage.payload;
    const signMethodType = unsignedMessage.type;
    let result = '';
    const { wcConnector, injectedConnectorInfo, accountInfo } =
      await getExternalConnector();
    if (accountInfo?.type === 'walletConnect') {
      if (!wcConnector) {
        return;
      }
      if (signMethodType === ETHMessageTypes.PERSONAL_SIGN) {
        result = await wcConnector.signPersonalMessage(rawMesssage);
      } else if (signMethodType === ETHMessageTypes.ETH_SIGN) {
        result = await wcConnector.signMessage(rawMesssage);
      } else {
        const typedDataMessage = cloneDeep(rawMesssage) as any[];
        if (
          signMethodType === ETHMessageTypes.TYPED_DATA_V3 ||
          signMethodType === ETHMessageTypes.TYPED_DATA_V4
        ) {
          const secondInfo = typedDataMessage?.[1];
          if (secondInfo && typeof secondInfo === 'string') {
            try {
              // do NOT need to JSON object
              // typedDataMessage[1] = JSON.parse(secondInfo);
            } catch (error) {
              debugLogger.common.error(error);
            }
          }
        }
        result = await wcConnector.signTypedData(typedDataMessage);
      }
    }

    if (accountInfo?.type === 'injectedProvider') {
      const connector = injectedConnectorInfo?.connector;
      if (!connector) {
        return;
      }
      let method = getEthProviderMethodFromMessageType(signMethodType);
      method = method || sourceInfo?.data?.method || '';
      result = (await connector.provider?.request({
        method,
        params: rawMesssage,
      })) as string;
    }

    return result;
  }, [unsignedMessage, getExternalConnector, sourceInfo?.data?.method]);

  return {
    externalAccountInfo,
    sendTxForExternalAccount,
    signMsgForExternalAccount,
  };
}

export function useSignOrSendOfBtcExternalAccount({
  encodedTx,
  networkId,
  accountId,
}: {
  encodedTx: IEncodedTx | undefined;
  sourceInfo?: IDappSourceInfo | undefined;
  networkId: string;
  accountId: string;
  signOnly: boolean;
}) {
  const intl = useIntl();
  const { engine } = backgroundApiProxy;

  const sendTxForBtcExternalAccount = useCallback(async () => {
    const currentNetwork = await engine.getNetwork(networkId);
    if (!isBTCNetwork(currentNetwork.id)) {
      throw new Error('Network is not BTC');
    }
    const tx = encodedTx as IEncodedTxBtc;
    if (!tx) {
      throw new Error('encodedTx is missing!');
    }
    const psbtHex =
      await backgroundApiProxy.serviceInscribe.convertEncodedTxToPsbt({
        encodedTx: tx,
        accountId,
        networkId,
      });
    const result =
      await window.$onekey.$privateExternalAccount?.btc_signTransaction({
        psbtHex,
        network:
          currentNetwork.id === OnekeyNetwork.btc ? 'mainnet' : 'testnet',
      });
    return {
      txid: result.txid,
      rawTx: result.rawTx,
      encodedTx,
    };
  }, [encodedTx, networkId, accountId, engine]);

  return {
    sendTxForBtcExternalAccount,
  };
}
