import { useCallback } from 'react';

import { Dialog } from '@onekeyhq/components';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapBuildTxFetchingAtom,
  useSwapBuildTxResultAtom,
  useSwapFromTokenAmountAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSlippagePercentageAtom,
} from '../../../states/jotai/contexts/swap';

import { useSwapReceiverAddress } from './useSwapReceiverAddress';

export function useSwapBuildTx() {
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [slippagePercentage] = useSwapSlippagePercentageAtom();
  const [selectQuote] = useSwapQuoteCurrentSelectAtom();
  const [, setSwapBuildTxFetching] = useSwapBuildTxFetchingAtom();
  const [, setSwapBuildTxResult] = useSwapBuildTxResultAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const receiverAddress = useSwapReceiverAddress();
  const wrappedTx = useCallback(async () => {
    // todo wrapped tx
  }, []);
  const approveTx = useCallback(async (allowanceNumber: number) => {
    // todo approve tx
    Dialog.confirm({
      onConfirmText: 'Continue',
      onConfirm: () => {},
      showCancelButton: true,
      title: 'Need to Send 2 Transactions to Change Allowance',
      description:
        'Some tokens require multiple transactions to modify the allowance. You must first set the allowance to zero before establishing the new desired allowance value.',
      icon: 'TxStatusWarningCircleIllus',
    });
  }, []);
  const buildTx = useCallback(async () => {
    if (
      fromToken &&
      toToken &&
      fromTokenAmount &&
      slippagePercentage &&
      selectQuote &&
      activeAccount.account?.address &&
      receiverAddress &&
      activeAccount.network?.id
    ) {
      setSwapBuildTxFetching(true);
      const res = await backgroundApiProxy.serviceSwap.fetchBuildTx({
        fromToken,
        toToken,
        toTokenAmount: selectQuote.toAmount,
        fromTokenAmount,
        slippagePercentage: slippagePercentage.value,
        receivingAddress: receiverAddress,
        userAddress: activeAccount.account?.address,
        provider: selectQuote.info.provider,
      });
      let encodedTx: IEncodedTx = {
        from: activeAccount.account?.address,
        to: '',
        value: '0',
      };
      let transferInfo: ITransferInfo = {
        from: activeAccount.account?.address,
        token: fromToken.contractAddress,
        to: '',
        amount: fromTokenAmount,
      };
      if (res?.swftOrder) {
        // swft orider
        transferInfo = {
          ...transferInfo,
          to: res.swftOrder.platformAddr,
          amount: res.swftOrder.depositCoinAmt,
        };
        const buildEncodedTx =
          await backgroundApiProxy.serviceSend.buildUnsignedTx({
            transfersInfo: [transferInfo],
            networkId: activeAccount.network?.id,
            accountId: activeAccount.account?.id,
          });
        encodedTx = buildEncodedTx.encodedTx;
      }
      if (res?.tx) {
        transferInfo = {
          ...transferInfo,
          to: res.tx.to,
          amount: fromTokenAmount,
        };
      }
      const buildEncodedTx =
        await backgroundApiProxy.serviceSend.buildUnsignedTx({
          transfersInfo: [transferInfo],
          networkId: activeAccount.network?.id,
          accountId: activeAccount.account?.id,
        });
      encodedTx = buildEncodedTx.encodedTx;

      setSwapBuildTxResult(res);
      setSwapBuildTxFetching(false);
      return {
        encodedTx,
        transferInfo,
        networkId: activeAccount.network?.id,
        accountId: activeAccount.account?.id,
      };
    }
    return {};
  }, [
    activeAccount.account?.address,
    activeAccount.account?.id,
    activeAccount.network?.id,
    fromToken,
    fromTokenAmount,
    receiverAddress,
    selectQuote,
    setSwapBuildTxFetching,
    setSwapBuildTxResult,
    slippagePercentage,
    toToken,
  ]);

  return { buildTx, wrappedTx, approveTx };
}
