import React, { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Spinner } from '@onekeyhq/components';
import {
  EVMDecodedItemERC20Transfer,
  EVMDecodedTxType,
} from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';
import {
  IDecodedTxLegacy,
  IEncodedTxUpdatePayloadTransfer,
  IEncodedTxUpdateType,
} from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useManageTokens } from '../../../hooks';
import { useActiveWalletAccount } from '../../../hooks/redux';
import TxConfirmDetail from '../../TxDetail/_legacy/TxConfirmDetail';
import { FeeInfoInputForConfirm } from '../FeeInfoInput';
import {
  ITxConfirmViewProps,
  SendConfirmModal,
} from '../SendConfirmViews/SendConfirmModal';
import { TransferSendParamsPayload } from '../types';

function TxConfirmTransfer(props: ITxConfirmViewProps) {
  const {
    payload,
    feeInfoPayload,
    feeInfoLoading,
    feeInfoEditable,
    encodedTx,
    decodedTx: decodedTxLegacy,
  } = props;
  const decodedTx = decodedTxLegacy as IDecodedTxLegacy;
  const { accountId, networkId } = useActiveWalletAccount();
  const transferPayload = payload as TransferSendParamsPayload | undefined;
  const isTransferNativeToken = !transferPayload?.token?.idOnNetwork;
  const { getTokenBalance } = useManageTokens();

  const isNativeMaxSend = useMemo(() => {
    if (!transferPayload) {
      return false;
    }
    if (isTransferNativeToken) {
      const amountBN = new BigNumber(transferPayload.value ?? 0);
      const balanceBN = new BigNumber(
        getTokenBalance({
          defaultValue: '0',
          tokenIdOnNetwork: transferPayload?.token?.idOnNetwork,
        }),
      );
      const feeBN = new BigNumber(feeInfoPayload?.current?.totalNative ?? 0);
      if (amountBN.plus(feeBN).gte(balanceBN)) {
        return true;
      }
    }
    return false;
  }, [feeInfoPayload, getTokenBalance, isTransferNativeToken, transferPayload]);
  const transferAmount = useMemo(() => {
    // invoked from Dapp
    if (!transferPayload || Object.keys(transferPayload).length === 0) {
      if (!decodedTx) {
        return '0';
      }

      const isToken = decodedTx.txType === EVMDecodedTxType.TOKEN_TRANSFER;
      let { amount } = decodedTx;
      if (isToken) {
        const erc20Info = decodedTx.info as EVMDecodedItemERC20Transfer | null;
        amount = erc20Info?.amount ?? '0';
      }
      return amount;
    }

    if (isNativeMaxSend) {
      const balanceBN = new BigNumber(
        getTokenBalance({
          defaultValue: '0',
          tokenIdOnNetwork: transferPayload.token.idOnNetwork,
        }),
      );
      const amountBN = new BigNumber(transferPayload.value ?? 0);
      const transferAmountBn = BigNumber.min(balanceBN, amountBN);
      const feeBN = new BigNumber(feeInfoPayload?.current?.totalNative ?? 0);
      return transferAmountBn.minus(feeBN).toFixed();
    }

    return transferPayload.value ?? '0';
  }, [
    decodedTx,
    feeInfoPayload,
    getTokenBalance,
    isNativeMaxSend,
    transferPayload,
  ]);

  const feeInput = (
    <FeeInfoInputForConfirm
      editable={feeInfoEditable}
      encodedTx={encodedTx}
      feeInfoPayload={feeInfoPayload}
      loading={feeInfoLoading}
    />
  );

  return (
    <SendConfirmModal
      {...props}
      confirmDisabled={new BigNumber(transferAmount).lt(0)}
      updateEncodedTxBeforeConfirm={async (tx) => {
        if (!!transferPayload && isNativeMaxSend) {
          const updatePayload: IEncodedTxUpdatePayloadTransfer = {
            amount: transferAmount,
          };
          const newTx = await backgroundApiProxy.engine.updateEncodedTx({
            networkId,
            accountId,
            encodedTx: tx,
            payload: updatePayload,
            options: {
              type: IEncodedTxUpdateType.transfer,
            },
          });
          return Promise.resolve(newTx);
        }
        return Promise.resolve(tx);
      }}
    >
      {decodedTx ? (
        <TxConfirmDetail
          tx={decodedTx}
          transferAmount={transferAmount}
          feeInput={feeInput}
          feeInfoPayload={feeInfoPayload}
        />
      ) : (
        <Spinner />
      )}
    </SendConfirmModal>
  );
}

export { TxConfirmTransfer };
