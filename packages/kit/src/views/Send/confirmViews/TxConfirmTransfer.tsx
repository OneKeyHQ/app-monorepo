import React, { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Spinner } from '@onekeyhq/components';
import {
  EVMDecodedItemERC20Transfer,
  EVMDecodedTxType,
} from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';
import {
  IEncodedTxUpdatePayloadTransfer,
  IEncodedTxUpdateType,
} from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../../hooks/redux';
import TxConfirmDetail from '../../TxDetail/TxConfirmDetail';
import { FeeInfoInputForConfirm } from '../FeeInfoInput';
import { TransferSendParamsPayload } from '../types';

import { ITxConfirmViewProps, SendConfirmModal } from './SendConfirmModal';

function TxConfirmTransfer(props: ITxConfirmViewProps) {
  const {
    payload,
    feeInfoPayload,
    feeInfoLoading,
    feeInfoEditable,
    encodedTx,
    decodedTx,
  } = props;
  const { accountId, networkId } = useActiveWalletAccount();
  const transferPayload = payload as TransferSendParamsPayload | undefined;
  const isTransferNativeToken = !transferPayload?.token?.idOnNetwork;

  const transferAmount = useMemo(() => {
    // invoked from Dapp
    if (!transferPayload) {
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

    if (transferPayload.isMax) {
      if (isTransferNativeToken) {
        return new BigNumber(transferPayload.token.balance ?? 0)
          .minus(feeInfoPayload?.current?.totalNative ?? 0)
          .toFixed();
      }
      return transferPayload.token.balance ?? '0';
    }
    return transferPayload.value ?? '0';
  }, [decodedTx, feeInfoPayload, isTransferNativeToken, transferPayload]);

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
        if (!!transferPayload && transferPayload.isMax) {
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
