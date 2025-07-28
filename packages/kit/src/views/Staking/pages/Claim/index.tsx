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
import type { IEarnToken } from '@onekeyhq/shared/types/staking';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { UniversalClaim } from '../../components/UniversalClaim';
import { useProviderLabel } from '../../hooks/useProviderLabel';
import { useUniversalClaim } from '../../hooks/useUniversalHooks';

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
    identity,
    onSuccess,
  } = route.params;
  const { protocolInfo, tokenInfo } = route.params;
  const provider = protocolInfo?.provider || '';
  const info = tokenInfo?.token;
  const symbol = info?.symbol || '';
  const price = tokenInfo?.price ? String(tokenInfo.price) : '0';
  const actionTag = protocolInfo?.stakeTag || '';
  const vault =
    protocolInfo?.approve?.approveTarget || protocolInfo?.vault || '';
  const appNavigation = useAppNavigation();
  const handleClaim = useUniversalClaim({ accountId, networkId });
  const onConfirm = useCallback(
    async (amount: string) => {
      await handleClaim({
        amount,
        identity,
        vault,
        symbol,
        provider,
        protocolVault: vault,
        stakingInfo: {
          label: EEarnLabels.Claim,
          protocol: earnUtils.getEarnProviderName({
            providerName: provider,
          }),
          protocolLogoURI: protocolInfo?.providerDetail.logoURI,
          receive: { token: info as IEarnToken, amount },
          tags: [actionTag],
        },
        onSuccess: () => {
          appNavigation.pop();
          defaultLogger.staking.page.unstaking({
            token: info,
            stakingProtocol: provider,
          });
          onSuccess?.();
        },
      });
    },
    [
      handleClaim,
      identity,
      vault,
      symbol,
      provider,
      protocolInfo?.providerDetail.logoURI,
      info,
      actionTag,
      appNavigation,
      onSuccess,
    ],
  );

  const providerLabel = useProviderLabel(provider);

  const { result: estimateFeeResp } = usePromiseResult(async () => {
    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId,
      networkId,
    });
    const resp = await backgroundApiProxy.serviceStaking.estimateFee({
      networkId,
      provider,
      symbol,
      action: 'claim',
      amount: '1',
      protocolVault: vault,
      accountAddress: account.address,
      identity,
    });
    return resp;
  }, [accountId, networkId, provider, symbol, vault, identity]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.earn_claim_token },
          { token: symbol },
        )}
      />
      <Page.Body>
        <UniversalClaim
          accountId={accountId}
          networkId={networkId}
          price={price}
          decimals={info?.decimals}
          initialAmount={initialAmount}
          balance={protocolInfo?.claimable ?? '0'}
          tokenSymbol={symbol}
          tokenImageUri={info?.logoURI}
          providerLogo={protocolInfo?.providerDetail.logoURI}
          providerName={provider}
          providerLabel={providerLabel}
          onConfirm={onConfirm}
          estimateFeeResp={estimateFeeResp}
        />
      </Page.Body>
    </Page>
  );
};

export default function ClaimPageWithProvider() {
  return (
    <DiscoveryBrowserProviderMirror>
      <ClaimPage />
    </DiscoveryBrowserProviderMirror>
  );
}
