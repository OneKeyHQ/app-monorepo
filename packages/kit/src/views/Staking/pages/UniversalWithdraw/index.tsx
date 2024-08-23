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

import { UniversalWithdraw } from '../../components/UniversalWithdraw';
import { useUniversalWithdraw } from '../../hooks/useUniversalHooks';

const UniversalWithdrawPage = () => {
  const intl = useIntl();
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.UniversalWithdraw
  >();
  const { accountId, networkId, details } = route.params;

  const { token, provider, staked } = details;
  const { price, info: tokenInfo } = token;
  const appNavigation = useAppNavigation();
  const handleWithdraw = useUniversalWithdraw({ accountId, networkId });
  const onConfirm = useCallback(
    async (value: string) => {
      const amount = BigNumber(value).shiftedBy(tokenInfo.decimals).toFixed(0);
      await handleWithdraw({
        amount,
        symbol: tokenInfo.symbol.toUpperCase(),
        provider: provider.name,
        onSuccess: (txs) => {
          appNavigation.pop();
          defaultLogger.staking.page.unstaking({
            token: tokenInfo,
            amount: value,
            stakingProtocol: 'lido',
            tokenValue: BigNumber(value).multipliedBy(price).toFixed(),
            txnHash: txs[0].signedTx.txid,
          });
        },
      });
    },
    [handleWithdraw, tokenInfo, appNavigation, price, provider],
  );
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.earn_redeem })}
      />
      <Page.Body>
        <UniversalWithdraw
          receivingTokenSymbol=""
          price={price}
          balance={staked}
          minAmount={BigNumber(100).shiftedBy(-tokenInfo.decimals).toFixed()}
          tokenSymbol={tokenInfo.symbol}
          tokenImageUri={tokenInfo.logoURI ?? ''}
          onConfirm={onConfirm}
        />
      </Page.Body>
    </Page>
  );
};

export default UniversalWithdrawPage;
