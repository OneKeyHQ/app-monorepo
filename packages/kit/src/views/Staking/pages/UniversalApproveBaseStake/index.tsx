import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import { UniversalApproveBaseStake } from '../../components/UniversalApproveBaseStake';
import { useUniversalStake } from '../../hooks/useUniversalHooks';

const UniversalApproveBaseStakePage = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.UniversalApproveBaseStake
  >();

  const { networkId, accountId, details, currentAllowance } = route.params;
  const { token, provider, rewardToken } = details;
  const { balanceParsed, price } = token;
  const appNavigation = useAppNavigation();
  const handleStake = useUniversalStake({ accountId, networkId });
  const onConfirm = useCallback(
    async (amount: string) => {
      await handleStake({
        amount,
        symbol: token.info.symbol.toUpperCase(),
        provider: provider.name,
        onSuccess: (txs) => {
          appNavigation.pop();
          defaultLogger.staking.page.staking({
            token: token.info,
            amount,
            stakingProtocol: 'lido',
            tokenValue: BigNumber(amount).multipliedBy(price).toFixed(),
            txnHash: txs[0].signedTx.txid,
          });
        },
      });
    },
    [token, appNavigation, handleStake, price, provider],
  );
  const intl = useIntl();
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.earn_stake_token },
          { 'token': token.info.symbol },
        )}
      />
      <Page.Body>
        <UniversalApproveBaseStake
          price={price}
          balance={balanceParsed}
          token={token.info}
          receivingTokenSymbol={rewardToken}
          minAmount={BigNumber(1).shiftedBy(-token.info.decimals).toFixed()}
          onConfirm={onConfirm}
          apr={Number(provider.apr)}
          currentAllowance={currentAllowance}
          rate="1"
          approveTarget={{
            accountId,
            networkId,
            spenderAddress: details.approveTarget ?? '',
            token: token.info,
          }}
        />
      </Page.Body>
    </Page>
  );
};

export default UniversalApproveBaseStakePage;
