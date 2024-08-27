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
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import { UniversalStake } from '../../components/UniversalStake';
import { useUniversalStake } from '../../hooks/useUniversalHooks';
import { buildLocalTraceTxTag } from '../../utils/const';

const UniversalStakePage = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.UniversalStake
  >();
  const {
    accountId,
    networkId,
    minTransactionFee = '0',
    details,
  } = route.params;
  const { token, provider } = details;
  const { balanceParsed, price } = token;
  const tokenInfo = token.info;

  const actionTag = buildLocalTraceTxTag(details);

  const minAmount = useMemo(() => {
    if (provider.minStakeAmount) return provider.minStakeAmount;
    return BigNumber(1).shiftedBy(-tokenInfo.decimals).toFixed();
  }, [tokenInfo, provider]);

  const handleStake = useUniversalStake({ accountId, networkId });
  const appNavigation = useAppNavigation();
  const onConfirm = useCallback(
    async (amount: string) => {
      await handleStake({
        amount,
        symbol: tokenInfo.symbol.toUpperCase(),
        provider: provider.name,
        stakingInfo: {
          label: EEarnLabels.Unknown,
          protocol: provider.name,
          send: { token: tokenInfo, amount },
          tags: [actionTag],
        },
        onSuccess: (txs) => {
          appNavigation.pop();
          defaultLogger.staking.page.staking({
            token: tokenInfo,
            amount,
            stakingProtocol: provider.name,
            tokenValue: BigNumber(amount).multipliedBy(price).toFixed(),
            txnHash: txs[0].signedTx.txid,
          });
        },
      });
    },
    [handleStake, appNavigation, tokenInfo, price, provider, actionTag],
  );
  const intl = useIntl();
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
          minTransactionFee={minTransactionFee}
          apr={Number.isNaN(provider.apr) ? 4 : Number(provider.apr)}
          price={price}
          balance={balanceParsed}
          minAmount={minAmount}
          tokenImageUri={tokenInfo.logoURI ?? ''}
          tokenSymbol={tokenInfo.symbol}
          providerLogo={provider.logoURI}
          providerName={provider.name}
          onConfirm={onConfirm}
        />
      </Page.Body>
    </Page>
  );
};

export default UniversalStakePage;
