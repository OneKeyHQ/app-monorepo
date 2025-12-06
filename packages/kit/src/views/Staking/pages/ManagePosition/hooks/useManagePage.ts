import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import type {
  EApproveType,
  IEarnTokenInfo,
  IEarnWithdrawActionIcon,
  IProtocolInfo,
  IStakeProtocolListItem,
} from '@onekeyhq/shared/types/staking';

import { buildLocalTxStatusSyncId } from '../../../utils/utils';

export const useManagePage = ({
  accountId,
  networkId,
  indexedAccountId,
  symbol,
  provider,
  vault,
}: {
  accountId: string;
  indexedAccountId: string | undefined;
  networkId: string;
  symbol: ISupportedSymbol;
  provider: string;
  vault: string | undefined;
}) => {
  const {
    result,
    isLoading = true,
    run,
  } = usePromiseResult(
    async () => {
      const earnAccount =
        await backgroundApiProxy.serviceStaking.getEarnAccount({
          accountId,
          networkId,
          indexedAccountId,
          btcOnlyTaproot: true,
        });

      if (!earnAccount || !earnAccount.accountAddress) {
        return undefined;
      }

      const managePageData =
        await backgroundApiProxy.serviceStaking.getManagePage({
          accountId,
          networkId,
          symbol,
          provider,
          vault,
          accountAddress: earnAccount.accountAddress,
          publicKey: networkUtils.isBTCNetwork(networkId)
            ? earnAccount.account.pub
            : undefined,
        });

      const protocolList =
        await backgroundApiProxy.serviceStaking.getProtocolList({
          symbol,
          filterNetworkId: networkId,
        });

      return { managePageData, protocolList, earnAccount };
    },
    [networkId, symbol, provider, vault, accountId, indexedAccountId],
    { watchLoading: true },
  );

  const { managePageData, protocolList, earnAccount } = result || {};

  const tokenInfo: IEarnTokenInfo | undefined = useMemo(() => {
    if (!managePageData?.deposit?.data?.token) {
      return undefined;
    }

    const balanceBN = new BigNumber(managePageData.deposit.data.balance || '0');
    const balanceParsed = balanceBN.isNaN() ? '0' : balanceBN.toFixed();

    return {
      balanceParsed,
      token: managePageData.deposit.data.token.info,
      price: managePageData.deposit.data.token.price,
      networkId,
      provider,
      vault,
      accountId,
    };
  }, [
    managePageData?.deposit?.data?.token,
    managePageData?.deposit?.data?.balance,
    networkId,
    provider,
    vault,
    accountId,
  ]);

  const protocolInfo: IProtocolInfo | undefined = useMemo(() => {
    if (!managePageData) {
      return undefined;
    }

    // Find the matching protocol from protocol list
    const matchingProtocol = protocolList?.find(
      (item: IStakeProtocolListItem) =>
        item.provider.name.toLowerCase() === provider.toLowerCase() &&
        item.network.networkId === networkId &&
        (!vault || item.provider.vault === vault),
    );

    // Get withdraw action from managePageData
    const withdrawAction = managePageData.withdraw as
      | IEarnWithdrawActionIcon
      | undefined;

    return {
      symbol,
      provider,
      vault,
      networkId,
      earnAccount,
      activeBalance: managePageData.withdraw?.data?.balance,
      stakeTag: buildLocalTxStatusSyncId({
        providerName: provider,
        tokenSymbol: symbol,
      }),
      providerDetail: {
        name: matchingProtocol?.provider.name || provider,
        logoURI: matchingProtocol?.provider.logoURI || '',
      },
      // withdraw
      withdrawAction,
      overflowBalance: managePageData.nums?.overflow,
      maxUnstakeAmount: managePageData.nums?.maxUnstakeAmount,
      minUnstakeAmount: managePageData.nums?.minUnstakeAmount,
      // staking
      minTransactionFee: managePageData.nums?.minTransactionFee,
      remainingCap: managePageData.nums?.remainingCap,
      // claim
      claimable: managePageData.nums?.claimable,
      // approve
      approve: managePageData.approve
        ? {
            allowance: managePageData.approve.allowance,
            approveType: managePageData.approve
              .approveType as unknown as EApproveType,
            approveTarget: managePageData.approve.approveTarget,
          }
        : undefined,
    } as IProtocolInfo;
  }, [
    managePageData,
    protocolList,
    symbol,
    provider,
    vault,
    networkId,
    earnAccount,
  ]);

  const depositDisabled = useMemo(
    () => managePageData?.deposit?.disabled ?? false,
    [managePageData?.deposit?.disabled],
  );

  const withdrawDisabled = useMemo(
    () => managePageData?.withdraw?.disabled ?? false,
    [managePageData?.withdraw?.disabled],
  );

  const alerts = useMemo(
    () => managePageData?.alerts || [],
    [managePageData?.alerts],
  );
  const alertsHolding = useMemo(
    () => managePageData?.alertsHolding || [],
    [managePageData?.alertsHolding],
  );
  const alertsStake = useMemo(
    () => managePageData?.alertsStake || [],
    [managePageData?.alertsStake],
  );
  const alertsWithdraw = useMemo(
    () => managePageData?.alertsWithdraw || [],
    [managePageData?.alertsWithdraw],
  );

  const ongoingValidator = useMemo(
    () => managePageData?.ongoingValidator,
    [managePageData?.ongoingValidator],
  );

  return {
    managePageData,
    isLoading,
    run,
    tokenInfo,
    earnAccount,
    protocolInfo,
    depositDisabled,
    withdrawDisabled,
    alerts,
    alertsHolding,
    alertsStake,
    alertsWithdraw,
    ongoingValidator,
  };
};
