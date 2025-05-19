import { useCallback, useState } from 'react';

import BigNumber from 'bignumber.js';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';
import type {
  ISwapTokenBase,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapQuoteKind,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

export function useSpeedSwapActions({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId?: string;
}) {
  const [speedSwapBuildTxLoading, setSpeedSwapBuildTxLoading] = useState(false);
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId: accountId ?? '',
    networkId,
  });

  const handleSpeedSwapBuildTxSuccess = useCallback(() => {
    // todo handle build tx success
  }, []);

  const cancelSpeedSwapBuildTx = useCallback(() => {
    // todo cancel build tx
  }, []);

  const speedSwapBuildTx = useCallback(
    async ({
      fromToken,
      toToken,
      amount,
      slippage,
      provider,
      userAddress,
      receivingAddress,
    }: {
      fromToken: ISwapTokenBase;
      toToken: ISwapTokenBase;
      amount: string;
      slippage: number;
      provider: string;
      userAddress: string;
      receivingAddress: string;
    }) => {
      setSpeedSwapBuildTxLoading(true);
      const buildRes =
        await backgroundApiProxy.serviceSwap.fetchBuildSpeedSwapTx({
          fromToken,
          toToken,
          fromTokenAmount: amount,
          provider,
          userAddress,
          receivingAddress,
          slippagePercentage: slippage,
          accountId,
          protocol: EProtocolOfExchange.SWAP,
          kind: ESwapQuoteKind.SELL,
        });
      if (!buildRes) {
        return;
      }
      let transferInfo: ITransferInfo | undefined;
      let encodedTx: IEncodedTx | undefined;
      if (buildRes?.OKXTxObject) {
        encodedTx = await backgroundApiProxy.serviceSwap.buildOkxSwapEncodedTx({
          accountId: accountId ?? '',
          networkId: fromToken.networkId,
          okxTx: buildRes.OKXTxObject,
          fromTokenInfo: buildRes.result.fromTokenInfo,
          type: ESwapTabSwitchType.SWAP,
        });
      } else if (buildRes?.tx) {
        transferInfo = undefined;
        if (typeof buildRes.tx !== 'string' && buildRes.tx.data) {
          const valueHex = toBigIntHex(new BigNumber(buildRes.tx.value ?? 0));
          encodedTx = {
            ...buildRes?.tx,
            value: valueHex,
            from: userAddress,
          };
        } else {
          encodedTx = buildRes.tx as string;
        }
      }
      const swapInfo: ISwapTxInfo = {
        protocol: EProtocolOfExchange.SWAP,
        sender: {
          amount,
          token: fromToken,
          accountInfo: {
            accountId: accountId ?? '',
            networkId: fromToken.networkId,
          },
        },
        receiver: {
          amount: buildRes?.result.toAmount ?? '',
          token: toToken,
          accountInfo: {
            accountId: accountId ?? '',
            networkId: toToken.networkId,
          },
        },
        accountAddress: userAddress,
        receivingAddress,
        swapBuildResData: {
          ...buildRes,
          result: {
            ...(buildRes?.result ?? {}),
            slippage: buildRes?.result?.slippage ?? slippage,
          },
        },
      };
      setSpeedSwapBuildTxLoading(false);
      await navigationToTxConfirm({
        isInternalSwap: true,
        transfersInfo: transferInfo ? [transferInfo] : undefined,
        encodedTx,
        swapInfo,
        approvesInfo: [], // todo
        onSuccess: handleSpeedSwapBuildTxSuccess,
        onCancel: cancelSpeedSwapBuildTx,
      });
      return buildRes;
    },
    [
      accountId,
      navigationToTxConfirm,
      handleSpeedSwapBuildTxSuccess,
      cancelSpeedSwapBuildTx,
    ],
  );
  return {
    speedSwapBuildTx,
    speedSwapBuildTxLoading,
    cancelSpeedSwapBuildTx,
    handleSpeedSwapBuildTxSuccess,
  };
}
