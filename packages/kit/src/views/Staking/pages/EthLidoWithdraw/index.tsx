import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import { ELidoLabels } from '@onekeyhq/shared/types/staking';

import { LidoWithdraw } from '../../components/LidoWithdraw';
import { useLidoWithdraw } from '../../hooks/useLidoEthHooks';

const EthLidoWithdraw = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.EthLidoWithdraw
  >();
  const { accountId, networkId, balance, token, price, receivingToken } =
    route.params;
  const appNavigation = useAppNavigation();
  const lidoWithdraw = useLidoWithdraw({ accountId, networkId });
  const onConfirm = useCallback(
    async (value: string) => {
      const amount = BigNumber(value).shiftedBy(token.decimals).toFixed(0);
      await lidoWithdraw({
        amount,
        stakingInfo: {
          label: ELidoLabels.Redeem,
          protocol: 'lido',
          send: { token, amount: value },
          tags: ['lido-eth'],
        },
        onSuccess: (txs) => {
          appNavigation.pop();
          defaultLogger.staking.page.unstake({
            token,
            amount: value,
            stakingProtocol: 'lido',
            tokenValue: BigNumber(value).multipliedBy(price).toFixed(),
            txnHash: txs[0].signedTx.txid,
          });
        },
      });
    },
    [lidoWithdraw, token, appNavigation, price],
  );
  return (
    <LidoWithdraw
      receivingTokenSymbol={receivingToken.symbol}
      price={price}
      balance={balance}
      minAmount={BigNumber(100).shiftedBy(-token.decimals).toFixed()}
      tokenSymbol={token.symbol}
      tokenImageUri={token.logoURI}
      onConfirm={onConfirm}
    />
  );
};

export default EthLidoWithdraw;
