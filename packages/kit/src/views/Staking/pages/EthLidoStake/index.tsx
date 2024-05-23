import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import { Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';

import { LidoStake } from '../../components/LidoStake';
import { useLidoStake } from '../../hooks/useLidoEthHooks';
import { LIDO_ETH_LOGO_URI } from '../../utils/const';

const EthLidoStake = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.EthLidoStake
  >();
  const { accountId, networkId, balance, price, token, apr, stToken } =
    route.params;
  const lidoStake = useLidoStake({ accountId, networkId });
  const appNavigation = useAppNavigation();
  const onConfirm = useCallback(
    async (value: string) => {
      const amount = BigNumber(value).shiftedBy(token.decimals).toFixed(0);
      await lidoStake({
        amount,
        onSuccess: () => appNavigation.pop(),
      });
    },
    [lidoStake, token.decimals, appNavigation],
  );
  return (
    <Page>
      <Page.Header title="Stake ETH" />
      <Page.Body>
        <LidoStake
          apr={apr}
          price={price}
          balance={balance}
          tokenImageUri={LIDO_ETH_LOGO_URI}
          tokenSymbol={token.symbol.toUpperCase()}
          stTokenSymbol={stToken.symbol.toUpperCase()}
          onConfirm={onConfirm}
        />
      </Page.Body>
    </Page>
  );
};

export default EthLidoStake;
