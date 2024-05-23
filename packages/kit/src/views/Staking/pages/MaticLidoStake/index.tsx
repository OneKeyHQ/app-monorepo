import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import { Page } from '@onekeyhq/components';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';

import { LidoStake } from '../../components/LidoStake';
import { useLidoMaticStake } from '../../hooks/useLidoMaticHooks';
import { LIDO_MATIC_LOGO_URI } from '../../utils/const';

const MaticLidoStake = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.MaticLidoStake
  >();
  const { networkId, accountId, token, balance, price, apr, stToken } =
    route.params;
  const lidoStake = useLidoMaticStake({ networkId, accountId });
  const onConfirm = useCallback(
    async (value: string) => {
      const amount = BigNumber(value).shiftedBy(token.decimals).toFixed(0);
      await lidoStake({ amount });
    },
    [lidoStake, token],
  );
  return (
    <Page>
      <Page.Header title="Stake Matic" />
      <Page.Body>
        <LidoStake
          price={price}
          balance={balance}
          tokenImageUri={LIDO_MATIC_LOGO_URI}
          tokenSymbol={token.symbol.toUpperCase()}
          stTokenSymbol={stToken.symbol.toUpperCase()}
          onConfirm={onConfirm}
          apr={apr}
        />
      </Page.Body>
    </Page>
  );
};

export default MaticLidoStake;
