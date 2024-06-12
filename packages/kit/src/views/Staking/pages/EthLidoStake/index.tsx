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

import { LidoStake } from '../../components/LidoStake';
import { useLidoStake } from '../../hooks/useLidoEthHooks';

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
        stakingInfo: {
          protocol: 'lido',
          send: { token, amount: value },
          receive: { token: stToken, amount: value },
          tags: ['lido-eth'],
        },
        onSuccess: () => appNavigation.pop(),
      });
    },
    [lidoStake, appNavigation, token, stToken],
  );
  const intl = useIntl();
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.earn_stake_token },
          { 'token': 'ETH' },
        )}
      />
      <Page.Body>
        <LidoStake
          apr={apr}
          price={price}
          balance={balance}
          minAmount={BigNumber(1).shiftedBy(-token.decimals).toFixed()}
          tokenImageUri={token.logoURI}
          tokenSymbol={token.symbol}
          stTokenSymbol={stToken.symbol}
          onConfirm={onConfirm}
        />
      </Page.Body>
    </Page>
  );
};

export default EthLidoStake;
