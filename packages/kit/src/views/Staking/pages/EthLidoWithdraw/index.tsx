import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';

import { LidoWithdraw } from '../../components/LidoWithdraw';
import { useLidoWithdraw } from '../../hooks/useLidoEthHooks';
import { LIDO_ETH_LOGO_URI } from '../../utils/const';

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
      const amount = BigNumber(value).shiftedBy(token.decimals).toFixed();
      await lidoWithdraw({
        amount,
        stakingInfo: {
          protocol: 'lido',
          send: { token, amount: value },
          tags: ['lido-eth'],
        },
        onSuccess: () => appNavigation.pop(),
      });
    },
    [lidoWithdraw, token, appNavigation],
  );
  return (
    <LidoWithdraw
      receivingTokenSymbol={receivingToken.symbol}
      price={price}
      balance={balance}
      tokenSymbol={token.symbol}
      tokenImageUri={LIDO_ETH_LOGO_URI}
      onConfirm={onConfirm}
    />
  );
};

export default EthLidoWithdraw;
