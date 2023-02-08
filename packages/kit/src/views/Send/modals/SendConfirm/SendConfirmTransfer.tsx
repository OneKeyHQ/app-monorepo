import { useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import type { Network } from '@onekeyhq/engine/src/types/network';
import type {
  IDecodedTx,
  IEncodedTxUpdatePayloadTransfer,
} from '@onekeyhq/engine/src/vaults/types';
import { IEncodedTxUpdateType } from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { formatBalanceDisplay } from '../../../../components/Format';
import { useActiveSideAccount } from '../../../../hooks';
import { useTokenBalance } from '../../../../hooks/useTokens';
import { TxDetailView } from '../../../TxDetail/TxDetailView';
import { BaseSendConfirmModal } from '../../components/BaseSendConfirmModal';

import type {
  ITxConfirmViewProps,
  TransferSendParamsPayload,
} from '../../types';

// For native transfer only
function SendConfirmTransfer(props: ITxConfirmViewProps) {
  const { payload, feeInfoPayload, feeInput, decodedTx: decodedTxInfo } = props;
  const decodedTx = decodedTxInfo as IDecodedTx;
  const { accountId, networkId } = useActiveSideAccount(props);
  const transferPayload = payload as TransferSendParamsPayload | undefined;
  const isTransferNativeToken = !transferPayload?.token?.idOnNetwork;

  // TODO check only supports transferPayload, decodedTx.actions[0].type=== nativeTransfer
  const [depositAmount, setDepositAmount] = useState<BigNumber.Value>('0');
  useEffect(() => {
    (async () => {
      const minDepositAmount =
        await backgroundApiProxy.serviceToken.getMinDepositAmount({
          networkId,
          accountId,
        });

      // @ts-expect-error
      const network: Network = payload?.network ?? undefined;

      const { amount } = formatBalanceDisplay(minDepositAmount, null, {
        unit: network?.decimals ?? 12,
      });
      setDepositAmount(amount ?? '0');
    })();
  }, [networkId, accountId, payload]);

  const balance = useTokenBalance({
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

      if (payload?.keepAlive) {
        if (amountBN.plus(feeBN).gte(balanceBN.minus(depositAmount))) {
          return true;
        }
      }
      if (amountBN.plus(feeBN).gte(balanceBN)) {
        return true;
      }
    }
    return false;
  }, [
    transferPayload,
    isTransferNativeToken,
    balance,
    feeInfoPayload,
    payload?.keepAlive,
    depositAmount,
  ]);
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
      if (payload?.keepAlive) {
        return transferAmountBn.minus(feeBN).minus(depositAmount).toFixed();
      }
      return transferAmountBn.minus(feeBN).toFixed();
    }

    return transferPayload.value ?? '0';
  }, [
    transferPayload,
    isNativeMaxSend,
    decodedTx.actions,
    balance,
    feeInfoPayload,
    payload?.keepAlive,
    depositAmount,
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
      />
    </BaseSendConfirmModal>
  );
}

export { SendConfirmTransfer };
