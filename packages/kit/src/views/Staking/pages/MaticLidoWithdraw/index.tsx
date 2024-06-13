import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import { ELidoLabels } from '@onekeyhq/shared/types/staking';

import { LidoWithdraw } from '../../components/LidoWithdraw';
import { useLidoMaticWithdraw } from '../../hooks/useLidoMaticHooks';
import { LIDO_MATIC_LOGO_URI } from '../../utils/const';

const MaticLidoWithdraw = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.MaticLidoWithdraw
  >();
  const { accountId, networkId, balance, token, price, receivingToken, rate } =
    route.params;
  const appNavigation = useAppNavigation();

  const lidoWithdraw = useLidoMaticWithdraw({ accountId, networkId });
  const onConfirm = useCallback(
    async (value: string) => {
      const amount = BigNumber(value).shiftedBy(token.decimals).toFixed(0);
      await lidoWithdraw({
        amount,
        stakingInfo: {
          label: ELidoLabels.Redeem,
          protocol: 'lido',
          send: { amount: value, token },
          tags: ['lido-matic'],
        },
        onSuccess: () => appNavigation.pop(),
      });
    },
    [token, lidoWithdraw, appNavigation],
  );
  return (
    <LidoWithdraw
      receivingTokenSymbol={receivingToken.symbol}
      price={price}
      balance={balance}
      tokenSymbol={token.symbol}
      minAmount={BigNumber(1).shiftedBy(-token.decimals).toFixed()}
      tokenImageUri={LIDO_MATIC_LOGO_URI}
      onConfirm={onConfirm}
      rate={rate}
    />
  );
};

export default MaticLidoWithdraw;
