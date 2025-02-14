import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
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
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import { ApproveBaseStake } from '../../components/ApproveBaseStake';
import { useProviderLabel } from '../../hooks/useProviderLabel';
import { useUniversalStake } from '../../hooks/useUniversalHooks';
import { buildLocalTxStatusSyncId } from '../../utils/utils';

const BasicApproveBaseStakePage = () => {
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
          label: EEarnLabels.Stake,
          protocol: earnUtils.getEarnProviderName({
            providerName: provider.name,
          }),
          protocolLogoURI: provider.logoURI,
          send: { token: token.info, amount },
          tags: [actionTag],
        },
        symbol: token.info.symbol,
        provider: provider.name,
        morphoVault: earnUtils.isMorphoProvider({
          providerName: provider.name,
        })
          ? provider.vault
          : undefined,
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
    () =>
      earnUtils.isLidoProvider({
        providerName: provider.name,
      }) ||
      earnUtils.isMorphoProvider({
        providerName: provider.name,
      }),
    [provider],
  );

  const estReceiveTokenRate = useMemo(() => {
    if (
      earnUtils.isLidoProvider({
        providerName: provider.name,
      })
    ) {
      return provider.lidoStTokenRate;
    }
    if (
      earnUtils.isMorphoProvider({
        providerName: provider.name,
      })
    ) {
      return provider.morphoTokenRate;
    }
    return '1';
  }, [provider]);

  const providerLabel = useProviderLabel(provider.name);

  const { result: estimateFeeResp } = usePromiseResult(async () => {
    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId,
      networkId,
    });
    const resp = await backgroundApiProxy.serviceStaking.estimateFee({
      networkId,
      provider: provider.name,
      symbol: token.info.symbol,
      action: 'stake',
      amount: '1',
      morphoVault: provider.vault,
      accountAddress: account.address,
    });
    return resp;
  }, [accountId, networkId, provider.name, provider.vault, token.info.symbol]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.earn_earn_token },
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
          estReceiveTokenRate={estReceiveTokenRate}
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

export default function ApproveBaseStakePage() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <BasicApproveBaseStakePage />
    </AccountSelectorProviderMirror>
  );
}
