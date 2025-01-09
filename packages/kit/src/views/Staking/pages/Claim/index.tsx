import { useCallback } from 'react';

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

import { UniversalClaim } from '../../components/UniversalClaim';
import { useProviderLabel } from '../../hooks/useProviderLabel';
import { useUniversalClaim } from '../../hooks/useUniversalHooks';
import { buildLocalTxStatusSyncId } from '../../utils/utils';

const ClaimPage = () => {
  const intl = useIntl();
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.Claim
  >();
  const {
    accountId,
    networkId,
    details,
    amount: initialAmount,
    identity,
    onSuccess,
  } = route.params;
  const { token, provider } = details;
  const { price, info: tokenInfo } = token;
  const actionTag = buildLocalTxStatusSyncId(details);
  const appNavigation = useAppNavigation();
  const handleClaim = useUniversalClaim({ accountId, networkId });
  const onConfirm = useCallback(
    async (amount: string) => {
      await handleClaim({
        amount,
        identity,
        symbol: tokenInfo.symbol,
        provider: provider.name,
        stakingInfo: {
          label: EEarnLabels.Claim,
          protocol: provider.name,
          protocolLogoURI: provider.logoURI,
          receive: { token: tokenInfo, amount },
          tags: [actionTag],
        },
        onSuccess: () => {
          appNavigation.pop();
          defaultLogger.staking.page.unstaking({
            token: tokenInfo,
            stakingProtocol: provider.name,
          });
          onSuccess?.();
        },
      });
    },
    [
      handleClaim,
      tokenInfo,
      appNavigation,
      provider,
      actionTag,
      identity,
      onSuccess,
    ],
  );

  const providerLabel = useProviderLabel(provider.name);

  const { result: estimateFeeResp } = usePromiseResult(async () => {
    const resp = await backgroundApiProxy.serviceStaking.estimateFee({
      networkId,
      provider: provider.name,
      symbol: tokenInfo.symbol,
      action: 'claim',
      amount: '1',
    });
    return resp;
  }, [networkId, provider.name, tokenInfo.symbol]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.earn_claim_token },
          { token: token.info.symbol },
        )}
      />
      <Page.Body>
        <UniversalClaim
          price={price}
          decimals={details.token.info.decimals}
          initialAmount={initialAmount}
          balance={details.claimable ?? '0'}
          tokenSymbol={tokenInfo.symbol}
          tokenImageUri={tokenInfo.logoURI}
          providerLogo={provider.logoURI}
          providerName={provider.name}
          providerLabel={providerLabel}
          onConfirm={onConfirm}
          estimateFeeResp={estimateFeeResp}
        />
      </Page.Body>
    </Page>
  );
};

export default ClaimPage;
