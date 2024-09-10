import { useCallback, useMemo } from 'react';

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
import { formatMillisecondsToBlocks } from '@onekeyhq/shared/src/utils/dateUtils';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import { UniversalStake } from '../../components/UniversalStake';
import { useProviderLabel } from '../../hooks/useProviderLabel';
import { useUniversalStake } from '../../hooks/useUniversalHooks';
import { buildLocalTxStatusSyncId } from '../../utils/utils';

const StakePage = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.Stake
  >();
  const {
    accountId,
    networkId,
    minTransactionFee = '0',
    details,
    onSuccess,
  } = route.params;
  const { token, provider } = details;
  const { balanceParsed, price } = token;
  const tokenInfo = token.info;

  const actionTag = buildLocalTxStatusSyncId(details);

  const btcStakingTerm = useMemo<number | undefined>(() => {
    if (provider?.minStakeTerm) {
      return formatMillisecondsToBlocks(provider.minStakeTerm);
    }
    return undefined;
  }, [provider]);

  const handleStake = useUniversalStake({ accountId, networkId });
  const appNavigation = useAppNavigation();
  const onConfirm = useCallback(
    async (amount: string) => {
      await handleStake({
        amount,
        symbol: tokenInfo.symbol.toUpperCase(),
        provider: provider.name,
        stakingInfo: {
          label: EEarnLabels.Stake,
          protocol: provider.name,
          send: { token: tokenInfo, amount },
          tags: [actionTag],
        },
        term: btcStakingTerm,
        onSuccess: () => {
          appNavigation.pop();
          defaultLogger.staking.page.staking({
            token: tokenInfo,
            stakingProtocol: provider.name,
          });
          onSuccess?.();
        },
      });
    },
    [
      handleStake,
      appNavigation,
      tokenInfo,
      provider,
      actionTag,
      onSuccess,
      btcStakingTerm,
    ],
  );

  const intl = useIntl();
  const providerLabel = useProviderLabel(provider.name);

  const isReachBabylonCap = useMemo<boolean | undefined>(() => {
    if (provider && provider.name === 'babylon') {
      const { stakingCap, totalStaked } = provider;
      return (
        Number(stakingCap) > 0 &&
        Number(totalStaked) > 0 &&
        Number(totalStaked) > Number(stakingCap)
      );
    }
    return false;
  }, [provider]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.earn_stake_token },
          { 'token': tokenInfo.symbol },
        )}
      />
      <Page.Body>
        <UniversalStake
          decimals={details.token.info.decimals}
          details={details}
          minTransactionFee={minTransactionFee}
          apr={Number(provider.apr) > 0 ? Number(provider.apr) : undefined}
          price={price}
          balance={balanceParsed}
          minAmount={provider.minStakeAmount}
          maxAmount={provider.maxStakeAmount}
          minStakeTerm={provider.minStakeTerm}
          minStakeBlocks={provider.minStakeBlocks}
          tokenImageUri={tokenInfo.logoURI}
          tokenSymbol={tokenInfo.symbol}
          providerLogo={provider.logoURI}
          providerName={provider.name}
          providerLabel={providerLabel}
          isReachBabylonCap={isReachBabylonCap}
          isDisabled={isReachBabylonCap}
          onConfirm={onConfirm}
        />
      </Page.Body>
    </Page>
  );
};

export default StakePage;
