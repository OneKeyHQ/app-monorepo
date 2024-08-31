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

import { UniversalWithdraw } from '../../components/UniversalWithdraw';
import { useUniversalWithdraw } from '../../hooks/useUniversalHooks';
import { buildLocalTxStatusSyncId } from '../../utils/const';

const UniversalWithdrawPage = () => {
  const intl = useIntl();
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.UniversalWithdraw
  >();
  const {
    accountId,
    networkId,
    details,
    identity,
    amount: initialAmount,
  } = route.params;

  const { token, provider, staked } = details;
  const { price, info: tokenInfo } = token;
  const actionTag = buildLocalTxStatusSyncId(details);
  const appNavigation = useAppNavigation();
  const handleWithdraw = useUniversalWithdraw({ accountId, networkId });
  const onConfirm = useCallback(
    async (amount: string) => {
      await handleWithdraw({
        amount,
        identity,
        symbol: tokenInfo.symbol,
        provider: provider.name,
        stakingInfo: {
          label: EEarnLabels.Unknown,
          protocol: provider.name,
          send: { token: tokenInfo, amount },
          tags: [actionTag],
        },
        onSuccess: (txs) => {
          appNavigation.pop();
          if (Number(price) > 0) {
            defaultLogger.staking.page.unstaking({
              token: tokenInfo,
              amount,
              stakingProtocol: provider.name,
              tokenValue: BigNumber(amount).multipliedBy(price).toFixed(),
              txnHash: txs[0].signedTx.txid,
            });
          }
        },
      });
    },
    [
      handleWithdraw,
      tokenInfo,
      appNavigation,
      price,
      provider,
      actionTag,
      identity,
    ],
  );
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.earn_redeem })}
      />
      <Page.Body>
        <UniversalWithdraw
          price={price}
          balance={staked}
          initialAmount={initialAmount}
          tokenSymbol={tokenInfo.symbol}
          tokenImageUri={tokenInfo.logoURI}
          providerLogo={provider.logoURI}
          providerName={provider.name}
          onConfirm={onConfirm}
        />
      </Page.Body>
    </Page>
  );
};

export default UniversalWithdrawPage;
