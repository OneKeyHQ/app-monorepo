import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import { ApproveBaseStake } from '../../components/ApproveBaseStake';
import { useProviderLabel } from '../../hooks/useProviderLabel';
import { useUniversalStake } from '../../hooks/useUniversalHooks';
import { buildLocalTxStatusSyncId } from '../../utils/utils';

const ApproveBaseStakePage = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.ApproveBaseStake
  >();

  const { networkId, accountId, details, currentAllowance } = route.params;
  const { token, provider } = details;
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
          protocolLogoURI: provider.logoURI,
          send: { token: token.info, amount },
          tags: [actionTag],
        },
        symbol: token.info.symbol.toUpperCase(),
        provider: provider.name,
        onSuccess: () => {
          appNavigation.pop();
          defaultLogger.staking.page.staking({
            token: token.info,
            stakingProtocol: provider.name,
          });
        },
      });
    },
    [token, appNavigation, handleStake, provider, actionTag],
  );
  const intl = useIntl();

  const showEstReceive = useMemo<boolean>(
    () => provider.name.toLowerCase() === 'lido',
    [provider],
  );

  const providerLabel = useProviderLabel(provider.name);

  const { result: estimateFeeResp } = usePromiseResult(async () => {
    const resp = await backgroundApiProxy.serviceStaking.estimateFee({
      networkId,
      provider: provider.name,
      symbol: token.info.symbol,
      action: 'stake',
      amount: '1',
    });
    return resp;
  }, [networkId, provider.name, token.info.symbol]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.earn_stake_token },
          { 'token': token.info.symbol },
        )}
      />
      <Page.Body>
        <ApproveBaseStake
          details={details}
          price={price}
          balance={balanceParsed}
          token={token.info}
          minAmount={provider.minStakeAmount}
          decimals={token.info.decimals}
          onConfirm={onConfirm}
          apr={Number(provider.apr) > 0 ? provider.apr : undefined}
          currentAllowance={currentAllowance}
          providerLogo={details.provider.logoURI}
          providerName={details.provider.name}
          providerLabel={providerLabel}
          showEstReceive={showEstReceive}
          estReceiveToken={details.rewardToken}
          estReceiveTokenRate={provider.lidoStTokenRate}
          approveTarget={{
            accountId,
            networkId,
            spenderAddress: details.approveTarget ?? '',
            token: token.info,
          }}
          estimateFeeResp={estimateFeeResp}
        />
      </Page.Body>
    </Page>
  );
};

export default ApproveBaseStakePage;
