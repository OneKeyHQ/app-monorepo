import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';

import { LidoWithdraw } from '../../components/LidoWithdraw';
import { useLidoMaticWithdraw } from '../../hooks/useLidoMaticHooks';

const tokenImageUri = 'https://uni.onekey-asset.com/static/chain/polygon.png';

const MaticLidoWithdraw = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.EthLidoStake
  >();
  const { accountId, networkId, balance, token } = route.params;

  const lidoWithdraw = useLidoMaticWithdraw();
  const onConfirm = useCallback(
    async (value: string) => {
      const amount = BigNumber(value).shiftedBy(token.decimals).toFixed(0);
      await lidoWithdraw({
        accountId,
        networkId,
        amount,
      });
    },
    [accountId, networkId, token, lidoWithdraw],
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

export default MaticLidoWithdraw;
