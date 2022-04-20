import React, { useCallback, useEffect, useState } from 'react';

import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Spinner, utils } from '@onekeyhq/components';
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

import {
  ITxConfirmViewProps,
  ITxConfirmViewPropsHandleConfirm,
  SendConfirmModal,
} from './confirmViews/SendConfirmModal';
import { TxConfirmBlind } from './confirmViews/TxConfirmBlind';
import { TxConfirmTokenApprove } from './confirmViews/TxConfirmTokenApprove';
import { TxConfirmTransfer } from './confirmViews/TxConfirmTransfer';
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

function removeFeeInfoInTx(encodedTx: IEncodedTxEvm) {
  // TODO dapp fee should be fixed by decimals
  // TODO deepClone
  delete encodedTx.gas;
  delete encodedTx.gasLimit;
  delete encodedTx.gasPrice;
  return encodedTx;
}

const TransactionConfirm = () => {
  const intl = useIntl();
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
  let { accountId, networkId } = useActiveWalletAccount();

  const dappApprove = useDappApproveAction({
    id: params.sourceInfo?.id ?? '',
    closeOnError: true,
  });
  const useFeeInTx = !isFromDapp;

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
      // TODO addHistoryEntryFromEncodedTx({ type, encodedTx, signedTx, payload })
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
        // TODO onComplete
        onSuccess: async (tx) => {
          saveHistory(tx);
          backgroundApiProxy.serviceToken.fetchAccountTokens();
          await dappApprove.resolve({
            result: tx.txid,
          });
          setTimeout(() => close(), 0);
        },
      });
    },
    [
      isFromDapp,
      useFeeInTx,
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
    feeInfoEditable: !useFeeInTx,
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

  if (!decodedTx) {
    return (
      <SendConfirmModal {...sharedProps} confirmDisabled>
        <Center flex="1">
          <Spinner />
        </Center>
      </SendConfirmModal>
    );
  }

  if (decodedTx.txType === EVMDecodedTxType.TOKEN_APPROVE) {
    return <TxConfirmTokenApprove {...sharedProps} />;
  }

  if (
    decodedTx.txType === EVMDecodedTxType.NATIVE_TRANSFER ||
    decodedTx.txType === EVMDecodedTxType.TOKEN_TRANSFER
  ) {
    return (
      <TxConfirmTransfer
        {...sharedProps}
        headerDescription={`${intl.formatMessage({
          id: 'content__to',
        })}:${utils.shortenAddress(encodedTx.to)}`}
      />
    );
  }

  // Dapp blind sign
  return <TxConfirmBlind {...sharedProps} />;
};

export default TransactionConfirm;
