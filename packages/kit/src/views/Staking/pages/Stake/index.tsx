import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useEarnActions } from '@onekeyhq/kit/src/states/jotai/contexts/earn/actions';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms/jotaiContextStoreMap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import { formatMillisecondsToBlocks } from '@onekeyhq/shared/src/utils/dateUtils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import type { IFeeUTXO } from '@onekeyhq/shared/types/fee';
import type { IApproveConfirmFnParams } from '@onekeyhq/shared/types/staking';
import { EApproveType, EEarnLabels } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { EarnProviderMirror } from '../../../Earn/EarnProviderMirror';
import { UniversalStake } from '../../components/UniversalStake';
import { useUniversalStake } from '../../hooks/useUniversalHooks';
import { buildLocalTxStatusSyncId } from '../../utils/utils';

function BasicStakePage() {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.Stake
  >();
  const {
    accountId,
    networkId,
    tokenInfo,
    protocolInfo,
    currentAllowance,
    onSuccess,
  } = route.params;
  const token = tokenInfo?.token as IToken;
  const symbol = tokenInfo?.token.symbol || '';
  const providerName = protocolInfo?.provider || '';
  const { removePermitCache } = useEarnActions().current;

  const actionTag = buildLocalTxStatusSyncId({
    providerName,
    tokenSymbol: symbol,
  });
  const [btcFeeRate, setBtcFeeRate] = useState<string | undefined>();
  const btcFeeRateInit = useRef<boolean>(false);

  const onFeeRateChange = useMemo(() => {
    if (
      providerName.toLowerCase() === EEarnProviderEnum.Babylon.toLowerCase()
    ) {
      return (value: string) => setBtcFeeRate(value);
    }
  }, [providerName]);

  const btcStakingTerm = useMemo<number | undefined>(() => {
    if (protocolInfo?.minStakeTerm) {
      return formatMillisecondsToBlocks(protocolInfo.minStakeTerm);
    }
    return undefined;
  }, [protocolInfo]);

  const handleStake = useUniversalStake({ accountId, networkId });
  const appNavigation = useAppNavigation();
  const onConfirm = useCallback(
    async ({
      amount,
      approveType,
      permitSignature,
    }: IApproveConfirmFnParams) => {
      await handleStake({
        amount,
        approveType,
        permitSignature,
        symbol,
        provider: providerName,
        stakingInfo: {
          label: EEarnLabels.Stake,
          protocol: earnUtils.getEarnProviderName({
            providerName,
          }),
          protocolLogoURI: protocolInfo?.providerDetail.logoURI,
          send: { token, amount },
          tags: [actionTag],
        },
        term: btcStakingTerm,
        feeRate: Number(btcFeeRate) > 0 ? Number(btcFeeRate) : undefined,
        morphoVault: earnUtils.isMorphoProvider({
          providerName,
        })
          ? protocolInfo?.approve?.approveTarget
          : undefined,
        onSuccess: async (txs) => {
          appNavigation.pop();
          defaultLogger.staking.page.staking({
            token,
            stakingProtocol: providerName,
          });
          const tx = txs[0];
          if (approveType === EApproveType.Permit && permitSignature) {
            removePermitCache({
              accountId,
              networkId,
              tokenAddress: tokenInfo?.token.address || '',
              amount,
            });
          }
          if (
            tx &&
            providerName.toLowerCase() ===
              EEarnProviderEnum.Babylon.toLowerCase()
          ) {
            await backgroundApiProxy.serviceStaking.addBabylonTrackingItem({
              txId: tx.decodedTx.txid,
              action: 'stake',
              createAt: Date.now(),
              accountId,
              networkId,
              amount,
              minStakeTerm: protocolInfo?.minStakeTerm,
            });
          }
          onSuccess?.();
        },
      });
    },
    [
      handleStake,
      symbol,
      providerName,
      protocolInfo?.providerDetail.logoURI,
      protocolInfo?.approve?.approveTarget,
      protocolInfo?.minStakeTerm,
      token,
      actionTag,
      btcStakingTerm,
      btcFeeRate,
      appNavigation,
      onSuccess,
      removePermitCache,
      accountId,
      networkId,
      tokenInfo?.token.address,
    ],
  );

  const intl = useIntl();

  const { result: estimateFeeUTXO } = usePromiseResult(async () => {
    if (!networkUtils.isBTCNetwork(networkId)) {
      return;
    }
    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId,
      networkId,
    });
    const accountAddress = account.address;
    const result = await backgroundApiProxy.serviceGas.estimateFee({
      accountId,
      networkId,
      accountAddress,
    });
    return result.feeUTXO?.filter(
      (o): o is Required<Pick<IFeeUTXO, 'feeRate'>> => o.feeRate !== undefined,
    );
  }, [accountId, networkId]);

  useEffect(() => {
    if (
      estimateFeeUTXO &&
      estimateFeeUTXO.length === 3 &&
      !btcFeeRateInit.current
    ) {
      const [, normalFee] = estimateFeeUTXO;
      setBtcFeeRate(normalFee.feeRate);
      btcFeeRateInit.current = true;
    }
  }, [estimateFeeUTXO]);
  const tokenSymbol = tokenInfo?.token.symbol || '';
  const price = tokenInfo?.nativeToken?.price
    ? String(tokenInfo?.nativeToken?.price)
    : '0';
  const balanceParsed = tokenInfo?.balanceParsed || '';
  const apr =
    protocolInfo?.aprWithoutFee && Number(protocolInfo.aprWithoutFee) > 0
      ? protocolInfo?.aprWithoutFee
      : undefined;
  const decimals = tokenInfo?.token.decimals || 0;
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.earn_earn_token },
          { token: tokenSymbol },
        )}
      />
      <Page.Body>
        <UniversalStake
          accountId={accountId}
          networkId={networkId}
          decimals={decimals}
          apr={apr}
          price={price}
          balance={balanceParsed}
          tokenImageUri={token?.logoURI}
          tokenSymbol={token.symbol}
          providerLogo={protocolInfo?.providerDetail.logoURI}
          providerName={protocolInfo?.provider}
          onConfirm={onConfirm}
          approveType={protocolInfo?.approve?.approveType}
          currentAllowance={currentAllowance}
          minTransactionFee={protocolInfo?.minTransactionFee}
          estimateFeeUTXO={estimateFeeUTXO}
          onFeeRateChange={onFeeRateChange}
          tokenInfo={tokenInfo}
          protocolInfo={protocolInfo}
          approveTarget={{
            accountId,
            networkId,
            spenderAddress: protocolInfo?.approve?.approveTarget ?? '',
            token: tokenInfo?.token,
          }}
        />
      </Page.Body>
    </Page>
  );
}

export default function StakePage() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <BasicStakePage />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
