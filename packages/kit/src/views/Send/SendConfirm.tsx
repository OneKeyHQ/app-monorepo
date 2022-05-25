import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import { Center, Spinner } from '@onekeyhq/components';
import {
  HistoryEntryStatus,
  HistoryEntryType,
} from '@onekeyhq/engine/src/types/history';
import { EVMDecodedTxType } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import { ISignedTx } from '@onekeyhq/engine/src/vaults/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useManageTokens } from '../../hooks';
import { useActiveWalletAccount } from '../../hooks/redux';
import useDappApproveAction from '../../hooks/useDappApproveAction';
import { useDecodedTx } from '../../hooks/useDecodedTx';
import { useDisableNavigationAnimation } from '../../hooks/useDisableNavigationAnimation';
import { wait } from '../../utils/helper';
import { SwapQuote } from '../Swap/typings';

import {
  ITxConfirmViewProps,
  ITxConfirmViewPropsHandleConfirm,
  SendConfirmModal,
} from './confirmViews/SendConfirmModal';
import { TxConfirmBlind } from './confirmViews/TxConfirmBlind';
import { TxConfirmSpeedUpOrCancel } from './confirmViews/TxConfirmSpeedUpOrCancel';
import { TxConfirmSwap } from './confirmViews/TxConfirmSwap';
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

import type { StackNavigationProp } from '@react-navigation/stack';

/*

- dapp
  - native transfer
- internal transfer
  - native
  - erc20
- internal tx cancel & speedUp
- internal swap
  - token approve
  - swap

 */

type NavigationProps = StackNavigationProp<
  SendRoutesParams,
  SendRoutes.SendConfirm
>;
type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SendConfirm>;

// remove gas price if encodedTx build by DAPP
function removeFeeInfoInTx(encodedTx: IEncodedTxEvm) {
  // DO NOT delete gasLimit here, fetchFeeInfo() will use it to calculate max limit
  // delete encodedTx.gas;
  // delete encodedTx.gasLimit;

  // DELETE price and use wallet calculated price
  delete encodedTx.gasPrice;
  delete encodedTx.maxPriorityFeePerGas;
  delete encodedTx.maxFeePerGas;

  return encodedTx;
}

const TransactionConfirm = () => {
  // do not remove this line, call account balance fetch
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { balances } = useManageTokens({
    fetchTokensOnMount: true,
  });
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const { params } = route;

  const isFromDapp = !!params.sourceInfo;
  const feeInfoEditable = params.feeInfoEditable ?? true;
  // TODO useFeeInTx has some bugs
  const useFeeInTx = params.feeInfoUseFeeInTx ?? false;

  const [encodedTx, setEncodedTx] = useState<IEncodedTxEvm>(
    isFromDapp
      ? removeFeeInfoInTx(params.encodedTx as IEncodedTxEvm)
      : (params.encodedTx as IEncodedTxEvm),
  );

  useDisableNavigationAnimation({
    condition: !!params.autoConfirmAfterFeeSaved,
  });

  useEffect(() => {
    setEncodedTx(params.encodedTx);
  }, [params.encodedTx]);
  const { accountId, networkId, walletId } = useActiveWalletAccount();

  const dappApproveId = params.sourceInfo?.id ?? '';
  const dappApprove = useDappApproveAction({
    id: dappApproveId,
    closeOnError: true,
  });
  useEffect(() => {
    if (!dappApproveId && isFromDapp) {
      console.error('useDappApproveAction ERROR: id not exists');
    }
  }, [dappApproveId, isFromDapp]);
  const isSpeedUpOrCancel =
    params.actionType === 'cancel' || params.actionType === 'speedUp';

  const payload = useMemo(
    () => (params.payload || {}) as SendConfirmPayloadBase,
    [params.payload],
  );

  const isInternalSwapTx = payload?.payloadType === 'InternalSwap';

  const { decodedTx } = useDecodedTx({ encodedTx, payload });
  const isTransferTypeTx =
    decodedTx?.txType === EVMDecodedTxType.NATIVE_TRANSFER ||
    decodedTx?.txType === EVMDecodedTxType.TOKEN_TRANSFER;

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
    (tx: ISignedTx) => {
      const historyId = `${networkId}--${tx.txid}`;
      const historyBase = {
        id: historyId,
        accountId,
        networkId,
        type: HistoryEntryType.TRANSFER,
        status: HistoryEntryStatus.PENDING,
      };
      // save transfer type history
      if (isTransferTypeTx) {
        const payloadTransfer = payload as TransferSendParamsPayload;
        const { to, token, value } = payloadTransfer;
        backgroundApiProxy.engine.addHistoryEntry({
          ...historyBase,
          meta: {
            contract: token?.idOnNetwork || '',
            target: to,
            value,
            ref: params?.sourceInfo?.origin || '', // dapp domain
            rawTx: tx.rawTx,
          },
        });
      } else if (isInternalSwapTx) {
        const payloadSwap = payload as SwapQuote;
        const { to, value } = payloadSwap;
        backgroundApiProxy.engine.addHistoryEntry({
          ...historyBase,
          meta: {
            contract: to ?? '',
            target: to,
            value: value ?? '',
            ref: params?.sourceInfo?.origin ?? '', // dapp domain
            rawTx: tx.rawTx,
          },
          payload: payloadSwap,
        });
      } else {
        backgroundApiProxy.engine.addHistoryEntry({
          ...historyBase,
          meta: {
            contract: '',
            target: '',
            value: '',
            ref: params?.sourceInfo?.origin ?? '', // dapp domain
            rawTx: tx.rawTx,
          },
        });
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

  // onSubmit, handleSubmit
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
        walletId,
        networkId,
        // TODO onComplete
        onSuccess: async (tx: ISignedTx) => {
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
        // add delay to avoid white screen when navigation replace
        await wait(600);
        return navigation.replace(SendRoutes.SendAuthentication, routeParams);
      }
      return navigation.navigate(SendRoutes.SendAuthentication, routeParams);
    },
    [
      isFromDapp,
      feeInfoEditable,
      feeInfoPayload,
      networkId,
      walletId,
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
  if (!decodedTx || !encodedTx) {
    return (
      <SendConfirmModal {...sharedProps} confirmDisabled>
        <Center flex="1">
          <Spinner />
        </Center>
      </SendConfirmModal>
    );
  }

  // handle speed up / cancel.
  if (isSpeedUpOrCancel) {
    return <TxConfirmSpeedUpOrCancel {...sharedProps} />;
  }

  if (decodedTx.txType === EVMDecodedTxType.TOKEN_APPROVE) {
    return <TxConfirmTokenApprove {...sharedProps} />;
  }

  if (isInternalSwapTx) {
    const payloadInternalSwap = payload as SwapQuote;
    return <TxConfirmSwap {...sharedProps} payload={payloadInternalSwap} />;
  }

  if (isTransferTypeTx) {
    return <TxConfirmTransfer {...sharedProps} />;
  }

  // Dapp blind sign
  return <TxConfirmBlind {...sharedProps} />;
};

export default TransactionConfirm;
