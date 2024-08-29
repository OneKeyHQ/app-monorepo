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

import { UniversalClaim } from '../../components/UniversalClaim';
import { useUniversalClaim } from '../../hooks/useUniversalHooks';
import { buildLocalTraceTxTag } from '../../utils/const';

const UniversalClaimPage = () => {
  const intl = useIntl();
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.UniversalClaim
  >();
  const {
    accountId,
    networkId,
    details,
    amount: initialAmount,
    identity,
  } = route.params;
  const { token, provider } = details;
  const { price, info: tokenInfo } = token;
  const actionTag = buildLocalTraceTxTag(details);
  const appNavigation = useAppNavigation();
  const notEditable = (initialAmount && Number(initialAmount) > 0) || identity;
  const handleClaim = useUniversalClaim({ accountId, networkId });
  const onConfirm = useCallback(
    async (amount: string) => {
      await handleClaim({
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
          defaultLogger.staking.page.unstaking({
            token: tokenInfo,
            amount,
            stakingProtocol: provider.name,
            tokenValue: BigNumber(amount).multipliedBy(price).toFixed(),
            txnHash: txs[0].signedTx.txid,
          });
        },
      });
    },
    [
      handleClaim,
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
        title={intl.formatMessage({ id: ETranslations.earn_claim })}
      />
      <Page.Body>
        <UniversalClaim
          receivingTokenSymbol=""
          price={price}
          initialAmountValue={initialAmount ?? ''}
          editable={!notEditable}
          balance={details.claimable ?? '0'}
          minAmount={BigNumber(100).shiftedBy(-tokenInfo.decimals).toFixed()}
          tokenSymbol={tokenInfo.symbol}
          tokenImageUri={tokenInfo.logoURI ?? ''}
          providerLogo={provider.logoURI}
          providerName={provider.name}
          onConfirm={onConfirm}
        />
      </Page.Body>
    </Page>
  );
};

export default UniversalClaimPage;
