import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';

import { LidoWithdraw } from '../../components/LidoWithdraw';
import { useLidoWithdraw } from '../../hooks/useLidoEthHooks';

const tokenImageUri = 'https://uni.onekey-asset.com/static/chain/eth.png';

const EthLidoWithdraw = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.EthLidoStake
  >();
  const { accountId, networkId, balance, token } = route.params;
  const lidoWithdraw = useLidoWithdraw({ accountId, networkId });
  const onConfirm = useCallback(
    async (value: string) => {
      const amount = new BigNumber(value).shiftedBy(token.decimals).toFixed();
      await lidoWithdraw({
        amount,
      });
    },
    [lidoWithdraw, token],
  );
  return (
    <LidoWithdraw
      balance={balance}
      tokenSymbol={token.symbol}
      tokenImageUri={tokenImageUri}
      onConfirm={onConfirm}
    />
  );
};

export default EthLidoWithdraw;
