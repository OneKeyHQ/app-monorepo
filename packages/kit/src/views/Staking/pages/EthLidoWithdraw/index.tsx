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
    EModalStakingRoutes.EthLidoStake
  >();
  const { accountId, networkId, balance, token } = route.params;
  const appNavigation = useAppNavigation();
  const lidoWithdraw = useLidoWithdraw({ accountId, networkId });
  const onConfirm = useCallback(
    async (value: string) => {
      const amount = new BigNumber(value).shiftedBy(token.decimals).toFixed();
      await lidoWithdraw({
        amount,
        onSuccess: () => appNavigation.pop(),
      });
    },
    [lidoWithdraw, token, appNavigation],
  );
  return (
    <LidoWithdraw
      balance={balance}
      tokenSymbol={token.symbol}
      tokenImageUri={LIDO_ETH_LOGO_URI}
      onConfirm={onConfirm}
    />
  );
};

export default EthLidoWithdraw;
