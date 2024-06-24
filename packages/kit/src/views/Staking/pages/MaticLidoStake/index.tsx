import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import { ELidoLabels } from '@onekeyhq/shared/types/staking';

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
    rate = '1',
  } = route.params;
  const appNavigation = useAppNavigation();
  const lidoStake = useLidoMaticStake({ networkId, accountId });
  const onConfirm = useCallback(
    async (value: string) => {
      const amount = BigNumber(value).shiftedBy(token.decimals).toFixed(0);
      await lidoStake({
        amount,
        stakingInfo: {
          label: ELidoLabels.Stake,
          protocol: 'lido',
          send: { amount: value, token },
          receive: {
            token: stToken,
            amount: BigNumber(value).multipliedBy(rate).toFixed(),
          },
          tags: ['lido-matic'],
        },
        onSuccess: () => appNavigation.pop(),
      });
    },
    [lidoStake, token, appNavigation, rate, stToken],
  );
  const intl = useIntl();
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.earn_stake_token },
          { 'token': 'MATIC' },
        )}
      />
      <Page.Body>
        <LidoApproveBaseStake
          price={price}
          balance={balance}
          token={token}
          receivingTokenSymbol={stToken.symbol}
          minAmount={BigNumber(1).shiftedBy(-token.decimals).toFixed()}
          onConfirm={onConfirm}
          apr={apr}
          currentAllowance={currentAllowance}
          rate={rate}
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
