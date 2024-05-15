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

const tokenImageUri = 'https://uni.onekey-asset.com/static/chain/polygon.png';

const MaticLidoStake = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.MaticLidoStake
  >();
  const { networkId, accountId, token, balance, price } = route.params;
  const lidoStake = useLidoMaticStake();
  const onConfirm = useCallback(
    async (value: string) => {
      const amount = BigNumber(value).shiftedBy(token.decimals).toFixed(0);
      await lidoStake({ networkId, accountId, amount });
    },
    [lidoStake, accountId, networkId, token],
  );
  return (
    <Page>
      <Page.Header title="Stake Matic" />
      <Page.Body>
        <LidoStake
          price={price}
          balance={balance}
          tokenImageUri={tokenImageUri}
          tokenSymbol={token.symbol.toLowerCase()}
          onConfirm={onConfirm}
        />
      </Page.Body>
    </Page>
  );
};

export default MaticLidoStake;
