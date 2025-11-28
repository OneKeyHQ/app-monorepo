import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useEarnActions } from '@onekeyhq/kit/src/states/jotai/contexts/earn/actions';
import { MorphoBundlerContract } from '@onekeyhq/shared/src/consts/addresses';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import type { IFeeUTXO } from '@onekeyhq/shared/types/fee';
import { EApproveType, EEarnLabels } from '@onekeyhq/shared/types/staking';
import type {
  IApproveConfirmFnParams,
  IEarnTokenInfo,
  IProtocolInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { UniversalStake } from '../../../components/UniversalStake';
import { useUniversalStake } from '../../../hooks/useUniversalHooks';

export const StakeSection = ({
  accountId,
  networkId,
  tokenInfo,
  protocolInfo,
  isDisabled,
  onSuccess,
  beforeFooter,
  showApyDetail,
  isInModalContext,
  fallbackTokenImageUri,
}: {
  accountId: string;
  networkId: string;
  tokenInfo?: IEarnTokenInfo;
  protocolInfo?: IProtocolInfo;
  isDisabled?: boolean;
  onSuccess?: () => void;
  beforeFooter?: ReactElement | null;
  showApyDetail?: boolean;
  isInModalContext?: boolean;
  fallbackTokenImageUri?: string;
}) => {
  // Early return if no tokenInfo or protocolInfo
  // This happens when there's no account or no address
  const hasRequiredData = tokenInfo && protocolInfo;

  const { result: estimateFeeUTXO } = usePromiseResult(async () => {
    if (!hasRequiredData || !networkUtils.isBTCNetwork(networkId)) {
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
  }, [accountId, networkId, hasRequiredData]);

  const [btcFeeRate, setBtcFeeRate] = useState<string | undefined>();
  const btcFeeRateInit = useRef<boolean>(false);
  const { removePermitCache } = useEarnActions().current;

  const onFeeRateChange = useMemo(() => {
    if (
      protocolInfo?.provider.toLowerCase() ===
      EEarnProviderEnum.Babylon.toLowerCase()
    ) {
      return (value: string) => setBtcFeeRate(value);
    }
  }, [protocolInfo?.provider]);

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

  const { result, isLoading = true } = usePromiseResult(
    async () => {
      if (!hasRequiredData || !protocolInfo?.approve?.approveTarget) {
        return undefined;
      }
      if (protocolInfo?.approve?.approveTarget) {
        // For vault-based providers, check allowance against vault address
        const isVaultBased = earnUtils.isVaultBasedProvider({
          providerName: protocolInfo.provider,
        });

        // Determine the correct spender address for allowance check
        let spenderAddress = protocolInfo.approve.approveTarget;
        if (protocolInfo.approve?.approveType === EApproveType.Permit) {
          spenderAddress = MorphoBundlerContract;
        } else if (isVaultBased) {
          spenderAddress = protocolInfo.vault ?? '';
        }

        const { allowanceParsed } =
          await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
            accountId,
            networkId,
            spenderAddress,
            tokenAddress: tokenInfo?.token.address || '',
          });

        return { allowanceParsed };
      }

      return undefined;
    },
    [
      hasRequiredData,
      accountId,
      networkId,
      protocolInfo?.approve?.approveTarget,
      protocolInfo?.approve?.approveType,
      protocolInfo?.provider,
      protocolInfo?.vault,
      tokenInfo?.token.address,
    ],
    {
      watchLoading: true,
    },
  );

  const handleStake = useUniversalStake({ accountId, networkId });

  const onConfirm = useCallback(
    async ({
      amount,
      approveType,
      permitSignature,
    }: IApproveConfirmFnParams) => {
      if (!hasRequiredData) return;

      const providerName = protocolInfo?.provider ?? '';
      const token = tokenInfo?.token as IToken;
      const symbol = tokenInfo?.token.symbol || '';

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
          tags: [protocolInfo?.stakeTag || ''],
        },
        // TODO: remove term after babylon remove term
        term: undefined,
        feeRate: Number(btcFeeRate) > 0 ? Number(btcFeeRate) : undefined,
        protocolVault: earnUtils.isVaultBasedProvider({
          providerName,
        })
          ? protocolInfo?.vault
          : undefined,
        onSuccess: async (txs) => {
          onSuccess?.();
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
              // TODO: remove term after babylon remove term
              minStakeTerm: undefined,
            });
          }
        },
      });
    },
    [
      hasRequiredData,
      tokenInfo?.token,
      handleStake,
      protocolInfo?.providerDetail.logoURI,
      protocolInfo?.vault,
      btcFeeRate,
      onSuccess,
      removePermitCache,
      accountId,
      networkId,
      protocolInfo?.provider,
      protocolInfo?.stakeTag,
    ],
  );

  // If no required data, render placeholder to maintain layout
  if (!hasRequiredData || isLoading) {
    return (
      <UniversalStake
        accountId={accountId}
        networkId={networkId}
        balance="0"
        tokenImageUri={fallbackTokenImageUri}
        isDisabled
        approveTarget={{
          accountId,
          networkId,
          spenderAddress: '',
        }}
        isInModalContext={isInModalContext}
        beforeFooter={beforeFooter}
      />
    );
  }

  return (
    <UniversalStake
      accountId={accountId}
      networkId={networkId}
      decimals={tokenInfo?.token?.decimals}
      balance={tokenInfo?.balanceParsed ?? ''}
      tokenImageUri={tokenInfo?.token.logoURI || fallbackTokenImageUri}
      tokenSymbol={tokenInfo?.token.symbol}
      providerLogo={protocolInfo?.providerDetail.logoURI}
      providerName={protocolInfo?.provider}
      onConfirm={onConfirm}
      approveType={protocolInfo?.approve?.approveType}
      currentAllowance={result?.allowanceParsed}
      minTransactionFee={protocolInfo?.minTransactionFee}
      estimateFeeUTXO={estimateFeeUTXO}
      onFeeRateChange={onFeeRateChange}
      tokenInfo={tokenInfo}
      protocolInfo={protocolInfo}
      isDisabled={isDisabled}
      approveTarget={{
        accountId,
        networkId,
        spenderAddress: earnUtils.isVaultBasedProvider({
          providerName: protocolInfo?.provider || '',
        })
          ? protocolInfo?.vault ?? ''
          : protocolInfo?.approve?.approveTarget ?? '',
        token: tokenInfo?.token,
      }}
      beforeFooter={beforeFooter}
      showApyDetail={showApyDetail}
      isInModalContext={isInModalContext}
    />
  );
};
