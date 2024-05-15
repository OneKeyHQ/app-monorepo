import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import { Page } from '@onekeyhq/components';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';

import { LidoStake } from '../../components/LidoStake';
import { useLidoStake } from '../../hooks/useLidoEthHooks';

const tokenImageUri = 'https://uni.onekey-asset.com/static/chain/eth.png';

const EthLidoStake = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.EthLidoStake
  >();
  const { accountId, networkId, balance, price, token } = route.params;
  const lidoStake = useLidoStake();
  const onConfirm = useCallback(
    async (value: string) => {
      const amount = BigNumber(value).shiftedBy(token.decimals).toFixed(0);
      await lidoStake({
        accountId,
        networkId,
        amount,
      });
    },
    [lidoStake, accountId, networkId, token.decimals],
  );
  return (
    <Page>
      <Page.Header title="Stake ETH" />
      <Page.Body>
        <LidoStake
          price={price}
          balance={balance}
          tokenImageUri={tokenImageUri}
          tokenSymbol={token.symbol.toUpperCase()}
          onConfirm={onConfirm}
        />
      </Page.Body>
    </Page>
  );
};

export default EthLidoStake;
