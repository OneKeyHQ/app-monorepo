import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  NavigationProp,
  RouteProp,
  StackActions,
  useNavigation,
  useRoute,
} from '@react-navigation/native';

import { Center, Spinner } from '@onekeyhq/components';
import {
  HistoryEntryStatus,
  HistoryEntryType,
} from '@onekeyhq/engine/src/types/history';
import { IBroadcastedTx } from '@onekeyhq/engine/src/types/vault';
import { EVMDecodedTxType } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks/redux';
import useDappApproveAction from '../../hooks/useDappApproveAction';
import { useDecodedTx } from '../../hooks/useDecodedTx';
import { SwapQuote } from '../Swap/typings';

import {
  ITxConfirmViewProps,
  ITxConfirmViewPropsHandleConfirm,
  SendConfirmModal,
} from './confirmViews/SendConfirmModal';
import { TxConfirmBlind } from './confirmViews/TxConfirmBlind';
import { TxConfirmSpeedUpOrCancel } from './confirmViews/TxConfirmSpeedUpOrCancel';
import { TxConfirmTokenApprove } from './confirmViews/TxConfirmTokenApprove';
import { TxConfirmTransfer } from './confirmViews/TxConfirmTransfer';
import {
  SendConfirmPayloadBase,
  SendRoutes,
  SendRoutesParams,
  TransferSendParamsPayload,
} from './types';
import {
  FEE_INFO_POLLING_INTERVAL,
  useFeeInfoPayload,
} from './useFeeInfoPayload';

type NavigationProps = NavigationProp<SendRoutesParams, SendRoutes.SendConfirm>;
type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SendConfirm>;

/*
await ethereum.request({method:'eth_sendTransaction',params:[{from: "0x76f3f64cb3cd19debee51436df630a342b736c24",
to: "0x0c54FcCd2e384b4BB6f2E405Bf5Cbc15a017AaFb",
type: "0x0",
value: "0x0"}]})
 */

function removeFeeInfoInTx(encodedTx: IEncodedTxEvm) {
  // TODO dapp fee should be fixed by decimals
  // TODO deepClone
  delete encodedTx.gas;
  delete encodedTx.gasLimit;
  delete encodedTx.gasPrice;
  return encodedTx;
}

const TransactionConfirm = () => {
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const { params } = route;
  // TODO rename to sourceInfo
  const isFromDapp = params.sourceInfo;
  const [encodedTx, setEncodedTx] = useState<IEncodedTxEvm>(
    isFromDapp
      ? removeFeeInfoInTx(params.encodedTx as IEncodedTxEvm)
      : (params.encodedTx as IEncodedTxEvm),
  );
  useEffect(() => {
    setEncodedTx(params.encodedTx);
  }, [params.encodedTx]);
  const { decodedTx } = useDecodedTx({ encodedTx });
  const { accountId, networkId } = useActiveWalletAccount();

  const dappApprove = useDappApproveAction({
    id: params.sourceInfo?.id ?? '',
    closeOnError: true,
  });
  // TODO useFeeInTx has some bugs
  const useFeeInTx = !isFromDapp;
  const isCancelOrSpeedUp =
    params.actionType === 'cancel' || params.actionType === 'speedUp';
  // const useFeeInTx = false;

  let feeInfoEditable = !useFeeInTx;
  if (isCancelOrSpeedUp) {
    feeInfoEditable = true;
  }

  const payload = useMemo(
    () => (params.payload || {}) as SendConfirmPayloadBase,
    [params.payload],
  );

  const isTransferTypeTx =
    decodedTx?.txType === EVMDecodedTxType.NATIVE_TRANSFER ||
    decodedTx?.txType === EVMDecodedTxType.TOKEN_TRANSFER;

  const isInternalSwapTx = payload?.payloadType === 'InternalSwap';

  // TODO remove
  if (isTransferTypeTx) {
    // const payloadTransfer = payload as TransferSendParamsPayload;
    // accountId = payloadTransfer?.account?.id || accountId;
    // networkId = payloadTransfer?.network?.id || networkId;
  }

  const { feeInfoPayload, feeInfoLoading } = useFeeInfoPayload({
    encodedTx,
    useFeeInTx,
    pollingInterval: feeInfoEditable ? FEE_INFO_POLLING_INTERVAL : 0,
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
      // save transfer type history
      if (isTransferTypeTx) {
        const payloadTransfer = payload as TransferSendParamsPayload;
        const { to, token, value } = payloadTransfer;
        backgroundApiProxy.engine.addHistoryEntry({
          id: historyId,
          accountId,
          networkId,
          type: HistoryEntryType.TRANSFER,
          status: HistoryEntryStatus.PENDING,
          meta: {
            contract: token?.idOnNetwork || '',
            target: to,
            value,
            ref: params?.sourceInfo?.origin || '', // dapp domain
            rawTx: tx.rawTx,
          },
        });
      }
      if (isInternalSwapTx) {
        // TODO save internal swap history
      }
    },
    [
      accountId,
      isTransferTypeTx,
      networkId,
      params?.sourceInfo?.origin,
      payload,
      isInternalSwapTx,
    ],
  );

  const handleConfirm = useCallback<ITxConfirmViewPropsHandleConfirm>(
    async (options) => {
      const { close } = options;
      // eslint-disable-next-line @typescript-eslint/no-shadow
      const encodedTx = options.encodedTx as IEncodedTxEvm;
      if (!encodedTx) {
        return;
      }
      if (isFromDapp) {
        removeFeeInfoInTx(encodedTx);
      }
      const encodedTxWithFee =
        feeInfoEditable && feeInfoPayload
          ? await backgroundApiProxy.engine.attachFeeInfoToEncodedTx({
              networkId,
              accountId,
              encodedTx,
              feeInfoValue: feeInfoPayload?.current.value,
            })
          : encodedTx;
      const routeParams = {
        ...params,
        encodedTx: encodedTxWithFee,
        accountId,
        networkId,
        // TODO onComplete
        onSuccess: async (tx: IBroadcastedTx) => {
          saveHistory(tx);
          backgroundApiProxy.serviceToken.fetchAccountTokens();
          await dappApprove.resolve({
            result: tx.txid,
          });
          if (params.onSuccess) {
            params.onSuccess(tx);
          }
          setTimeout(() => close(), 0);
        },
      };
      if (params.autoConfirmAfterFeeSaved) {
        const action = StackActions.replace(
          SendRoutes.SendAuthentication,
          routeParams,
        );
        return navigation.dispatch(action);
      }
      return navigation.navigate(SendRoutes.SendAuthentication, routeParams);
    },
    [
      isFromDapp,
      feeInfoEditable,
      feeInfoPayload,
      networkId,
      accountId,
      navigation,
      params,
      saveHistory,
      dappApprove,
    ],
  );

  const sharedProps: ITxConfirmViewProps = {
    encodedTx,
    onEncodedTxUpdate: (tx) => setEncodedTx(tx),
    feeInfoPayload,
    feeInfoLoading,
    feeInfoEditable,
    payload,
    handleConfirm,
    onSecondaryActionPress: ({ close }) => {
      dappApprove.reject();
      close();
    },
    onClose: dappApprove.reject,
    sourceInfo: params.sourceInfo,
    decodedTx,
  };

  // waiting for tx decode
  if (!decodedTx) {
    return (
      <SendConfirmModal {...sharedProps} confirmDisabled>
        <Center flex="1">
          <Spinner />
        </Center>
      </SendConfirmModal>
    );
  }

  // handle speed up / cancel.
  if (isCancelOrSpeedUp) {
    return <TxConfirmSpeedUpOrCancel {...sharedProps} />;
  }

  if (decodedTx.txType === EVMDecodedTxType.TOKEN_APPROVE) {
    return <TxConfirmTokenApprove {...sharedProps} />;
  }

  if (isInternalSwapTx) {
    // TODO internal swap confirm view
    const payloadInternalSwap = payload as SwapQuote;
    return <TxConfirmBlind {...sharedProps} payload={payloadInternalSwap} />;
  }

  if (isTransferTypeTx) {
    // TODO from dapp: feeInfoEditable=true
    //      from internal transfer: feeInfoEditable=false
    return <TxConfirmTransfer {...sharedProps} feeInfoEditable={false} />;
  }

  // Dapp blind sign
  return <TxConfirmBlind {...sharedProps} />;
};

export default TransactionConfirm;
