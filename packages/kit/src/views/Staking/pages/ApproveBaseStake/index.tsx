import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import { UniversalApproveBaseStake } from '../../components/UniversalApproveBaseStake';
import { useUniversalStake } from '../../hooks/useUniversalHooks';
import { buildLocalTxStatusSyncId } from '../../utils/const';

const UniversalApproveBaseStakePage = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.ApproveBaseStake
  >();

  const { networkId, accountId, details, currentAllowance } = route.params;
  const { token, provider, rewardToken } = details;
  const { balanceParsed, price } = token;
  const appNavigation = useAppNavigation();
  const actionTag = buildLocalTxStatusSyncId(details);

  const handleStake = useUniversalStake({ accountId, networkId });
  const onConfirm = useCallback(
    async (amount: string) => {
      await handleStake({
        amount,
        stakingInfo: {
          label: EEarnLabels.Unknown,
          protocol: provider.name,
          send: { token: token.info, amount },
          tags: [actionTag],
        },
        symbol: token.info.symbol.toUpperCase(),
        provider: provider.name,
        onSuccess: (txs) => {
          appNavigation.pop();
          defaultLogger.staking.page.staking({
            token: token.info,
            amount,
            stakingProtocol: provider.name,
            tokenValue:
              Number(price) > 0
                ? BigNumber(amount).multipliedBy(price).toFixed()
                : '0',
            txnHash: txs[0].signedTx.txid,
          });
        },
      });
    },
    [token, appNavigation, handleStake, price, provider, actionTag],
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
          minAmount={
            provider.minStakeAmount ??
            BigNumber(1).shiftedBy(-token.info.decimals).toFixed()
          }
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
