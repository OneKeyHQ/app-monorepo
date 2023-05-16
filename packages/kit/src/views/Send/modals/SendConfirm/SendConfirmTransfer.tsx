import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import type {
  IDecodedTx,
  IEncodedTxUpdatePayloadTransfer,
} from '@onekeyhq/engine/src/vaults/types';
import { IEncodedTxUpdateType } from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useActiveSideAccount } from '../../../../hooks';
import { useTokenBalanceWithoutFrozen } from '../../../../hooks/useTokens';
import { TxDetailView } from '../../../TxDetail/TxDetailView';
import { BaseSendConfirmModal } from '../../components/BaseSendConfirmModal';

import type {
  ITxConfirmViewProps,
  TransferSendParamsPayload,
} from '../../types';

// For native transfer only
function SendConfirmTransfer(props: ITxConfirmViewProps) {
  const {
    payload,
    feeInfoPayload,
    feeInput,
    decodedTx: decodedTxInfo,
    advancedSettingsForm,
  } = props;
  const decodedTx = decodedTxInfo as IDecodedTx;
  const { accountId, networkId } = useActiveSideAccount(props);
  const transferPayload = payload as TransferSendParamsPayload | undefined;
  const isTransferNativeToken = !transferPayload?.token?.idOnNetwork;

  // TODO check only supports transferPayload, decodedTx.actions[0].type=== nativeTransfer

  const balance = useTokenBalanceWithoutFrozen({
    networkId,
    accountId,
    token: {
      tokenIdOnNetwork: transferPayload?.token?.idOnNetwork,
      sendAddress: transferPayload?.token?.sendAddress,
    },
  });

  const isNativeMaxSend = useMemo(() => {
    if (!transferPayload) {
      return false;
    }

    if (isTransferNativeToken) {
      const amountBN = new BigNumber(transferPayload.value ?? 0);
      const balanceBN = new BigNumber(balance);
      const feeBN = new BigNumber(feeInfoPayload?.current?.totalNative ?? 0);

      if (amountBN.plus(feeBN).gte(balanceBN)) {
        return true;
      }
    }
    return false;
  }, [transferPayload, isTransferNativeToken, balance, feeInfoPayload]);
  const transferAmount = useMemo(() => {
    if (!transferPayload) {
      return '0';
    }
    if (isNativeMaxSend) {
      const { type, nativeTransfer } = decodedTx.actions[0];
      if (
        type === 'NATIVE_TRANSFER' &&
        typeof nativeTransfer !== 'undefined' &&
        typeof nativeTransfer.utxoFrom !== 'undefined'
      ) {
        // For UTXO model, the decodedTx is updated with the new transfer amount.
        // Use this instead of depending the incorrect feeInfoPayload results.
        return nativeTransfer.amount;
      }
      const balanceBN = new BigNumber(balance);
      const amountBN = new BigNumber(transferPayload.value ?? 0);
      const transferAmountBn = BigNumber.min(balanceBN, amountBN);
      const feeBN = new BigNumber(feeInfoPayload?.current?.totalNative ?? 0);
      return transferAmountBn.minus(feeBN).toFixed();
    }

    return transferPayload.value ?? '0';
  }, [
    transferPayload,
    isNativeMaxSend,
    decodedTx.actions,
    balance,
    feeInfoPayload,
  ]);

  const isAmountNegative = useMemo(
    () => new BigNumber(transferAmount).lt(0),
    [transferAmount],
  );
  const transferAmountToUpdate = useMemo(
    () =>
      isAmountNegative && transferPayload
        ? transferPayload.value
        : transferAmount,
    [isAmountNegative, transferAmount, transferPayload],
  );
  return (
    <BaseSendConfirmModal
      {...props}
      confirmDisabled={isAmountNegative}
      updateEncodedTxBeforeConfirm={async (tx) => {
        if (!!transferPayload && isNativeMaxSend) {
          const updatePayload: IEncodedTxUpdatePayloadTransfer = {
            amount: transferAmountToUpdate,
            totalBalance: balance,
            feeInfo: feeInfoPayload?.info,
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
      <TxDetailView
        isSendConfirm
        decodedTx={decodedTx}
        feeInput={feeInput}
        transferAmount={transferAmountToUpdate}
        advancedSettingsForm={advancedSettingsForm}
      />
    </BaseSendConfirmModal>
  );
}

export { SendConfirmTransfer };
