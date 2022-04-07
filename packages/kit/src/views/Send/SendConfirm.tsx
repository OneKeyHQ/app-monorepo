import React, { useCallback, useEffect } from 'react';

import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { utils } from '@onekeyhq/components';
import {
  HistoryEntryStatus,
  HistoryEntryType,
} from '@onekeyhq/engine/src/types/history';
import { IBroadcastedTx } from '@onekeyhq/engine/src/types/vault';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks/redux';
import useDappApproveAction from '../../hooks/useDappApproveAction';
import useDappParams from '../../hooks/useDappParams';

import { TxPreviewBlind } from './previews/TxPreviewBlind';
import { ITxPreviewModalProps } from './previews/TxPreviewModal';
import { TxPreviewTransfer } from './previews/TxPreviewTransfer';
import {
  SendRoutes,
  SendRoutesParams,
  TransferSendParamsPayload,
} from './types';
import { useFeeInfoPayload } from './useFeeInfoPayload';

type NavigationProps = NavigationProp<SendRoutesParams, SendRoutes.SendConfirm>;
type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SendConfirm>;

/*
await ethereum.request({method:'eth_sendTransaction',params:[{from: "0x76f3f64cb3cd19debee51436df630a342b736c24",
to: "0x0c54FcCd2e384b4BB6f2E405Bf5Cbc15a017AaFb",
type: "0x0",
value: "0x0"}]})
 */

const TransactionConfirm = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const { params } = route;
  let { accountId, networkId } = useActiveWalletAccount();
  // TODO multi-chain encodedTx
  const encodedTx = params.encodedTx as IEncodedTxEvm;
  const isFromDapp = params.source;
  // TODO Ext testing
  const { id } = useDappParams();
  const dappApprove = useDappApproveAction({
    id,
    closeOnError: true,
  });
  const useFeeInTx = !isFromDapp;
  if (isFromDapp) {
    // TODO dapp fee should be fixed by decimals
    delete encodedTx.gas;
    delete encodedTx.gasLimit;
    delete encodedTx.gasPrice;
  }

  let payload = params.payload as TransferSendParamsPayload;
  if (payload) {
    accountId = payload.account.id;
    networkId = payload.network.id;
  } else {
    // TODO parse encodedTx to payload
    payload = {} as TransferSendParamsPayload;
  }

  const { feeInfoPayload, feeInfoLoading } = useFeeInfoPayload({
    encodedTx,
    useFeeInTx,
  });

  useEffect(() => {
    debugLogger.sendTx(
      'SendConfirm  >>>>  ',
      feeInfoPayload,
      encodedTx,
      params,
    );
  }, [encodedTx, feeInfoPayload, params]);

  const saveHistory = useCallback(
    (tx: IBroadcastedTx) => {
      const historyId = `${networkId}--${tx.txid}`;
      backgroundApiProxy.engine.addHistoryEntry({
        id: historyId,
        accountId,
        networkId,
        type: HistoryEntryType.TRANSFER,
        status: HistoryEntryStatus.PENDING,
        meta: {
          contract: payload.token?.idOnNetwork || '',
          target: payload.to,
          value: payload.value,
          rawTx: tx.rawTx,
        },
      });
    },
    [
      accountId,
      networkId,
      payload.to,
      payload.token?.idOnNetwork,
      payload.value,
    ],
  );

  const handleNavigation = useCallback(
    async ({ close }: { onClose?: () => void; close: () => void }) => {
      const encodedTxWithFee =
        !useFeeInTx && feeInfoPayload
          ? await backgroundApiProxy.engine.attachFeeInfoToEncodedTx({
              networkId,
              accountId,
              encodedTx,
              feeInfoValue: feeInfoPayload?.current.value,
            })
          : encodedTx;
      return navigation.navigate(SendRoutes.SendAuthentication, {
        ...params,
        encodedTx: encodedTxWithFee,
        accountId,
        networkId,
        onSuccess: (tx) => {
          saveHistory(tx);
          dappApprove.resolve({
            result: tx.txid,
          });
          close();
        },
      });
    },
    [
      useFeeInTx,
      feeInfoPayload,
      networkId,
      accountId,
      encodedTx,
      navigation,
      params,
      dappApprove,
      saveHistory,
    ],
  );

  const sharedProps: ITxPreviewModalProps = {
    encodedTx,
    feeInfoPayload,
    feeInfoLoading,
    feeInfoEditable: !useFeeInTx,
    payload,
    onPrimaryActionPress: handleNavigation,
    onSecondaryActionPress: ({ close }) => {
      dappApprove.reject();
      close();
    },
    onClose: dappApprove.reject,
    source: params.source,
  };

  if (isFromDapp) {
    return <TxPreviewBlind {...sharedProps} />;
  }

  return (
    <TxPreviewTransfer
      {...sharedProps}
      headerDescription={`${intl.formatMessage({
        id: 'content__to',
      })}:${utils.shortenAddress(encodedTx.to)}`}
    />
  );
};

export default TransactionConfirm;
