import { useCallback } from 'react';

import { Dialog } from '@onekeyhq/components';
import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
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
      let unsignedTx;
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
      if (res?.swftOrder) {
        // swft order
        const transferInfo: ITransferInfo = {
          from: activeAccount.account?.address,
          tokenInfo: {
            ...fromToken,
            address: fromToken.contractAddress,
            name: fromToken.name ?? fromToken.symbol,
          },
          to: res.swftOrder.platformAddr,
          amount: res.swftOrder.depositCoinAmt,
        };
        unsignedTx = await backgroundApiProxy.serviceSend.buildUnsignedTx({
          transfersInfo: [transferInfo],
          networkId: activeAccount.network?.id,
          accountId: activeAccount.account?.id,
        });
      }
      if (res?.tx) {
        unsignedTx = {
          encodedTx: {
            ...res?.tx,
            from: activeAccount.account?.address,
          },
        };
      }
      console.log('unsignedTx--', unsignedTx);

      setSwapBuildTxResult(res);
      setSwapBuildTxFetching(false);
      return {
        unsignedTx,
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
