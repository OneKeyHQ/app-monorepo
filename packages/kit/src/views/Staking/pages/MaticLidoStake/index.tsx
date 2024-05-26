import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import { Page } from '@onekeyhq/components';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';

import { LidoApproveBaseStake } from '../../components/LidoApproveBaseStake';
import { useLidoMaticStake } from '../../hooks/useLidoMaticHooks';

const MaticLidoStake = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.MaticLidoStake
  >();
  const {
    networkId,
    accountId,
    token,
    balance,
    price,
    apr,
    stToken,
    currentAllowance,
  } = route.params;
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
        <LidoApproveBaseStake
          price={price}
          balance={balance}
          token={token}
          receivingTokenSymbol={stToken.symbol.toUpperCase()}
          onConfirm={onConfirm}
          apr={apr}
          currentAllowance={currentAllowance}
          approveTarget={{
            accountId,
            networkId,
            spenderAddress: stToken.address,
            token,
          }}
        />
      </Page.Body>
    </Page>
  );
};

export default MaticLidoStake;
