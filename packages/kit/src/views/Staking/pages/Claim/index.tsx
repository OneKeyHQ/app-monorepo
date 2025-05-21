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
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
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
    amount: initialAmount,
    claimableAmount,
    identity,
    provider,
    token,
    onSuccess,
  } = route.params;
  const actionTag = buildLocalTxStatusSyncId({
    providerName: provider.name,
    tokenSymbol: token.symbol,
  });
  const appNavigation = useAppNavigation();
  const handleClaim = useUniversalClaim({ accountId, networkId });
  const onConfirm = useCallback(
    async (amount: string) => {
      await handleClaim({
        amount,
        identity,
        vault: provider.vault || '',
        symbol: token.symbol,
        provider: provider.name,
        morphoVault: provider.vault,
        stakingInfo: {
          label: EEarnLabels.Claim,
          protocol: earnUtils.getEarnProviderName({
            providerName: provider.name,
          }),
          protocolLogoURI: provider.logoURI,
          receive: { token, amount },
          tags: [actionTag],
        },
        onSuccess: () => {
          appNavigation.pop();
          defaultLogger.staking.page.unstaking({
            token,
            stakingProtocol: provider.name,
          });
          onSuccess?.();
        },
      });
    },
    [
      handleClaim,
      identity,
      provider.vault,
      provider.name,
      provider.logoURI,
      token,
      actionTag,
      appNavigation,
      onSuccess,
    ],
  );

  const providerLabel = useProviderLabel(provider.name);

  const { result: estimateFeeResp } = usePromiseResult(async () => {
    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId,
      networkId,
    });
    const resp = await backgroundApiProxy.serviceStaking.estimateFee({
      networkId,
      provider: provider.name,
      symbol: token.symbol,
      action: 'claim',
      amount: '1',
      morphoVault: provider.vault,
      accountAddress: account.address,
      identity,
    });
    return resp;
  }, [
    accountId,
    networkId,
    provider.name,
    provider.vault,
    token.symbol,
    identity,
  ]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.earn_claim_token },
          { token: token.symbol },
        )}
      />
      <Page.Body>
        <UniversalClaim
          networkId={networkId}
          // price={token.price}
          price="0"
          decimals={token.decimals}
          initialAmount={initialAmount}
          balance={claimableAmount ?? '0'}
          tokenSymbol={token.symbol}
          tokenImageUri={token.logoURI}
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
