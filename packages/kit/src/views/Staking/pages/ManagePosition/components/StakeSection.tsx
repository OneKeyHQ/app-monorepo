import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useEarnActions } from '@onekeyhq/kit/src/states/jotai/contexts/earn/actions';
import {
  type IManagePositionConfirmParams,
  ManagePosition,
} from '@onekeyhq/kit/src/views/Borrow/components/ManagePosition';
import {
  useUniversalBorrowBorrow,
  useUniversalBorrowSupply,
} from '@onekeyhq/kit/src/views/Borrow/hooks/useUniversalBorrowHooks';
import { MorphoBundlerContract } from '@onekeyhq/shared/src/consts/addresses';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import type { IFeeUTXO } from '@onekeyhq/shared/types/fee';
import { EApproveType, EEarnLabels } from '@onekeyhq/shared/types/staking';
import type {
  IApproveConfirmFnParams,
  IBorrowReserveItem,
  IEarnSelectField,
  IEarnTokenInfo,
  IProtocolInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { UniversalStake } from '../../../components/UniversalStake';
import { useBorrowApiParams } from '../../../hooks/useBorrowApiParams';
import { useUniversalStake } from '../../../hooks/useUniversalHooks';
import { buildBorrowTag } from '../../../utils/utils';

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
  ongoingValidator,
  useBorrowApi,
  borrowMarketAddress,
  borrowReserveAddress,
  borrowAction,
  borrowActionLabel,
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
  ongoingValidator?: IEarnSelectField;
  useBorrowApi?: boolean;
  borrowMarketAddress?: string;
  borrowReserveAddress?: string;
  borrowAction?: 'supply' | 'withdraw' | 'borrow' | 'repay';
  borrowReserves?: IBorrowReserveItem;
  borrowActionLabel?: string;
}) => {
  // Early return if no tokenInfo or protocolInfo
  // This happens when there's no account or no address
  const hasRequiredData = tokenInfo && protocolInfo;
  const providerName = useMemo(
    () => protocolInfo?.provider ?? '',
    [protocolInfo?.provider],
  );
  const borrowApiCtx = useBorrowApiParams({
    useBorrowApi,
    networkId,
    provider: providerName,
    marketAddress: borrowMarketAddress,
    reserveAddress: borrowReserveAddress,
    accountId,
    action: borrowAction,
  });
  const isBorrowStake =
    borrowApiCtx.isBorrow &&
    (borrowApiCtx.borrowApiParams.action === 'supply' ||
      borrowApiCtx.borrowApiParams.action === 'borrow');

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

  const { result, isLoading: _isLoading = true } = usePromiseResult(
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
  const handleBorrowSupply = useUniversalBorrowSupply({ accountId, networkId });
  const handleBorrowBorrow = useUniversalBorrowBorrow({ accountId, networkId });

  const onConfirm = useCallback(
    async ({
      amount,
      approveType,
      permitSignature,
      unsignedMessage,
      message,
      validatorPubkey,
    }: IApproveConfirmFnParams) => {
      if (!hasRequiredData) return;

      const token = tokenInfo?.token as IToken;
      const symbol = tokenInfo?.token.symbol || '';

      if (borrowApiCtx.isBorrow) return;

      await handleStake({
        amount,
        approveType,
        permitSignature,
        unsignedMessage,
        message,
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
        // Stakefish specific param
        validatorPublicKey: validatorPubkey,
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
      providerName,
      protocolInfo?.stakeTag,
      borrowApiCtx.isBorrow,
    ],
  );

  // Determine the effective max balance for supply
  const effectiveMaxBalance = useMemo(() => {
    if (borrowAction !== 'supply') {
      return undefined;
    }
    return protocolInfo?.maxSupplyBalance;
  }, [borrowAction, protocolInfo?.maxSupplyBalance]);

  const onBorrowConfirm = useCallback(
    async (params: IManagePositionConfirmParams) => {
      const { amount } = params;
      if (!hasRequiredData || !borrowApiCtx.isBorrow) return;

      const token = tokenInfo?.token as IToken;
      const { provider, marketAddress, reserveAddress, action } =
        borrowApiCtx.borrowApiParams;

      // Build tags array with both new borrow tag and legacy stakeTag for backward compatibility
      const tags: string[] = [EEarnLabels.Borrow];
      if (action === 'supply' || action === 'borrow') {
        tags.push(buildBorrowTag({ provider, action }));
      }
      // Keep legacy stakeTag for backward compatibility
      if (protocolInfo?.stakeTag) {
        tags.push(protocolInfo.stakeTag);
      }

      await (action === 'borrow' ? handleBorrowBorrow : handleBorrowSupply)({
        amount,
        provider,
        marketAddress,
        reserveAddress,
        stakingInfo: token
          ? {
              label:
                action === 'borrow' ? EEarnLabels.Borrow : EEarnLabels.Supply,
              protocol: earnUtils.getEarnProviderName({
                providerName: provider,
              }),
              protocolLogoURI: protocolInfo?.providerDetail.logoURI,
              ...(action === 'borrow'
                ? { receive: { token, amount } }
                : { send: { token, amount } }),
              tags,
            }
          : undefined,
        onSuccess: async () => {
          onSuccess?.();
        },
      });
    },
    [
      borrowApiCtx,
      handleBorrowBorrow,
      handleBorrowSupply,
      hasRequiredData,
      onSuccess,
      protocolInfo?.providerDetail.logoURI,
      protocolInfo?.stakeTag,
      tokenInfo?.token,
    ],
  );

  // If no required data, render placeholder to maintain layout
  if (!hasRequiredData) {
    if (
      useBorrowApi &&
      borrowMarketAddress &&
      borrowReserveAddress &&
      (borrowAction === 'supply' || borrowAction === 'borrow')
    ) {
      return (
        <ManagePosition
          accountId={accountId}
          networkId={networkId}
          providerName=""
          action={borrowAction}
          balance="0"
          price="0"
          tokenImageUri={fallbackTokenImageUri}
          tokenSymbol={tokenInfo?.token.symbol}
          isDisabled
          borrowMarketAddress={borrowMarketAddress}
          borrowReserveAddress={borrowReserveAddress}
          beforeFooter={beforeFooter}
          actionLabel={borrowActionLabel}
          isInModalContext={isInModalContext}
        />
      );
    }
    return (
      <UniversalStake
        accountId={accountId}
        networkId={networkId}
        balance="0"
        tokenImageUri={fallbackTokenImageUri}
        tokenSymbol={tokenInfo?.token.symbol}
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
    <>
      {isBorrowStake ? (
        <ManagePosition
          accountId={accountId}
          networkId={networkId}
          providerName={providerName}
          action={borrowApiCtx.borrowApiParams.action as 'supply' | 'borrow'}
          decimals={
            protocolInfo?.protocolInputDecimals ?? tokenInfo?.token?.decimals
          }
          balance={tokenInfo?.balanceParsed ?? ''}
          maxBalance={effectiveMaxBalance}
          tokenImageUri={tokenInfo?.token.logoURI || fallbackTokenImageUri}
          tokenSymbol={tokenInfo?.token.symbol}
          price={tokenInfo?.price ? String(tokenInfo.price) : '0'}
          onConfirm={onBorrowConfirm}
          tokenInfo={tokenInfo}
          isDisabled={isDisabled}
          borrowMarketAddress={
            borrowApiCtx.borrowApiParams?.marketAddress ?? ''
          }
          borrowReserveAddress={
            borrowApiCtx.borrowApiParams?.reserveAddress ?? ''
          }
          beforeFooter={beforeFooter}
          showApyDetail={showApyDetail}
          actionLabel={borrowActionLabel}
          isInModalContext={isInModalContext}
        />
      ) : (
        <UniversalStake
          accountId={accountId}
          networkId={networkId}
          decimals={
            protocolInfo?.protocolInputDecimals ?? tokenInfo?.token?.decimals
          }
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
          ongoingValidator={ongoingValidator}
        />
      )}
    </>
  );
};
