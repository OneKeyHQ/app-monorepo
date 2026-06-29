import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import {
  EApproveType,
  EManagePositionType,
  type IEarnTokenInfo,
  type IEarnWithdrawActionIcon,
  type IProtocolInfo,
  type IStakeProtocolListItem,
} from '@onekeyhq/shared/types/staking';

import { buildLocalTxStatusSyncId } from '../../../utils/utils';

export { EManagePositionType };

export const useManagePage = ({
  accountId,
  networkId,
  indexedAccountId,
  symbol,
  provider,
  vault,
  type = EManagePositionType.Staking,
  reserveAddress,
  marketAddress,
  revalidateOnFocus = true,
}: {
  accountId: string;
  indexedAccountId: string | undefined;
  networkId: string;
  symbol: ISupportedSymbol;
  provider: string;
  vault: string | undefined;
  type?: EManagePositionType;
  reserveAddress?: string;
  marketAddress?: string;
  revalidateOnFocus?: boolean;
}) => {
  const {
    result,
    isLoading = true,
    run,
  } = usePromiseResult(
    async () => {
      const isBorrowType = [
        EManagePositionType.Supply,
        EManagePositionType.Borrow,
        EManagePositionType.Withdraw,
        EManagePositionType.Repay,
      ].includes(type);

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

      if (isBorrowType) {
        const managePageData =
          await backgroundApiProxy.serviceStaking.getBorrowManagePage({
            accountId,
            networkId,
            provider,
            marketAddress: marketAddress || '',
            reserveAddress: reserveAddress || '',
            type: type as 'supply' | 'withdraw' | 'borrow' | 'repay',
          });

        return { managePageData, protocolList: undefined, earnAccount };
      }

      const [managePageData, protocolList] = await Promise.all([
        backgroundApiProxy.serviceStaking.getManagePage({
          accountId,
          networkId,
          symbol,
          provider,
          vault,
          accountAddress: earnAccount.accountAddress,
          publicKey: networkUtils.isBTCNetwork(networkId)
            ? earnAccount.account.pub
            : undefined,
        }),
        backgroundApiProxy.serviceStaking.getProtocolList({
          symbol,
          accountId,
          networkId,
          filterNetworkId: networkId,
          includeWithdrawOnly: true,
        }),
      ]);

      return { managePageData, protocolList, earnAccount };
    },
    [
      networkId,
      symbol,
      provider,
      vault,
      accountId,
      indexedAccountId,
      type,
      reserveAddress,
      marketAddress,
    ],
    { watchLoading: true, revalidateOnFocus },
  );

  const { managePageData, protocolList, earnAccount } = result || {};

  const resolvedProtocolVault = useMemo(() => {
    if (!earnUtils.shouldSendEarnProtocolVault({ providerName: provider })) {
      return vault;
    }
    if (vault) {
      return vault;
    }
    return protocolList?.find(
      (item: IStakeProtocolListItem) =>
        item.provider.name.toLowerCase() === provider.toLowerCase() &&
        item.network.networkId === networkId,
    )?.provider.vault;
  }, [networkId, protocolList, provider, vault]);

  const tokenInfo: IEarnTokenInfo | undefined = useMemo(() => {
    if (!managePageData) {
      return undefined;
    }

    const isSwapManagePage = !!(managePageData.buy || managePageData.sell);

    const actionData = (() => {
      // Borrow manage-page uses supply/borrow actions for the first tab.
      if (type === EManagePositionType.Withdraw) {
        return (
          managePageData.withdraw ??
          managePageData.supply ??
          managePageData.deposit
        );
      }
      if (type === EManagePositionType.Supply) {
        return (
          managePageData.supply ??
          managePageData.withdraw ??
          managePageData.deposit
        );
      }
      if (type === EManagePositionType.Repay) {
        return (
          managePageData.repay ??
          managePageData.borrow ??
          managePageData.deposit
        );
      }
      if (type === EManagePositionType.Borrow) {
        return (
          managePageData.borrow ??
          managePageData.repay ??
          managePageData.deposit
        );
      }
      if (isSwapManagePage) {
        return managePageData.buy?.payButton ?? managePageData.deposit;
      }
      return managePageData.deposit ?? managePageData.buy?.payButton;
    })();

    if (!actionData?.data?.token) {
      return undefined;
    }

    const balanceBN = new BigNumber(actionData.data.balance || '0');
    const balanceParsed = balanceBN.isNaN() ? '0' : balanceBN.toFixed();

    return {
      balanceParsed,
      token: actionData.data.token.info,
      price: actionData.data.token.price,
      networkId,
      provider,
      vault: resolvedProtocolVault,
      accountId,
    };
  }, [
    managePageData,
    networkId,
    provider,
    resolvedProtocolVault,
    accountId,
    type,
  ]);

  const protocolInfo: IProtocolInfo | undefined = useMemo(() => {
    if (!managePageData) {
      return undefined;
    }
    const isSwapManagePage = !!(managePageData.buy || managePageData.sell);

    // Find the matching protocol from protocol list
    const strictMatchingProtocol = protocolList?.find(
      (item: IStakeProtocolListItem) =>
        item.provider.name.toLowerCase() === provider.toLowerCase() &&
        item.network.networkId === networkId &&
        (!resolvedProtocolVault ||
          item.provider.vault === resolvedProtocolVault),
    );
    const matchingProtocol =
      strictMatchingProtocol ??
      protocolList?.find(
        (item: IStakeProtocolListItem) =>
          item.provider.name.toLowerCase() === provider.toLowerCase() &&
          item.network.networkId === networkId,
      );

    // Get withdraw action from managePageData
    const withdrawAction = managePageData.withdraw as
      | IEarnWithdrawActionIcon
      | undefined;
    let approve: IProtocolInfo['approve'];
    if (managePageData.approve) {
      approve = {
        allowance: managePageData.approve.allowance ?? '0',
        approveType:
          (managePageData.approve.approveType as unknown as EApproveType) ??
          EApproveType.Legacy,
        approveTarget: managePageData.approve.approveTarget ?? '',
      };
    } else if (managePageData.approveTarget) {
      approve = {
        allowance: managePageData.borrowAllowance ?? '0',
        approveType: EApproveType.Legacy,
        approveTarget: managePageData.approveTarget,
      };
    }

    return {
      symbol,
      provider,
      vault: resolvedProtocolVault,
      networkId,
      earnAccount,
      activeBalance:
        (isSwapManagePage
          ? managePageData.sell?.payButton?.data?.balance
          : undefined) ??
        managePageData.withdraw?.data?.balance ??
        managePageData.sell?.payButton?.data?.balance ??
        managePageData.repay?.data?.balance,
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
      // input decimals restriction
      protocolInputDecimals: managePageData.nums?.protocolInputDecimals,
      // repay max balance (debt balance for max button)
      maxRepayBalance: managePageData.repay?.data?.maxBalance,
      // debt balance for collateral repay mode
      debtBalance: managePageData.debt?.data?.balance,
      needsSetupLut: managePageData.needsSetupLut,
      // supply max balance for supply max button
      maxSupplyBalance: managePageData.supply?.data?.maxBalance,
      receiptTokenRate:
        matchingProtocol?.provider.receiptTokenRate ??
        matchingProtocol?.provider.morphoTokenRate,
      morphoTokenRate: matchingProtocol?.provider.morphoTokenRate,
      // approve
      approve,
      approveAsset: managePageData.approveAsset,
      withdrawApprove: managePageData.withdrawApprove,
    } as IProtocolInfo;
  }, [
    managePageData,
    protocolList,
    symbol,
    provider,
    resolvedProtocolVault,
    networkId,
    earnAccount,
  ]);

  const depositDisabled = useMemo(() => {
    if (!managePageData) {
      return false;
    }
    const isSwapManagePage = !!(managePageData.buy || managePageData.sell);
    if (
      [EManagePositionType.Supply, EManagePositionType.Withdraw].includes(type)
    ) {
      return (
        managePageData.supply?.disabled ??
        managePageData.deposit?.disabled ??
        false
      );
    }
    if (
      [EManagePositionType.Borrow, EManagePositionType.Repay].includes(type)
    ) {
      return (
        managePageData.borrow?.disabled ??
        managePageData.deposit?.disabled ??
        false
      );
    }
    if (isSwapManagePage) {
      return (
        managePageData.buy?.payButton?.disabled ??
        managePageData.deposit?.disabled ??
        false
      );
    }
    return (
      managePageData.deposit?.disabled ??
      managePageData.buy?.payButton?.disabled ??
      false
    );
  }, [managePageData, type]);

  const withdrawDisabled = useMemo(() => {
    if (!managePageData) {
      return false;
    }
    const isSwapManagePage = !!(managePageData.buy || managePageData.sell);
    if (
      [EManagePositionType.Supply, EManagePositionType.Withdraw].includes(type)
    ) {
      return managePageData.withdraw?.disabled ?? false;
    }
    if (
      [EManagePositionType.Borrow, EManagePositionType.Repay].includes(type)
    ) {
      return (
        managePageData.repay?.disabled ??
        managePageData.withdraw?.disabled ??
        false
      );
    }
    if (isSwapManagePage) {
      return (
        managePageData.sell?.payButton?.disabled ??
        managePageData.withdraw?.disabled ??
        false
      );
    }
    return (
      managePageData.withdraw?.disabled ??
      managePageData.sell?.payButton?.disabled ??
      false
    );
  }, [managePageData, type]);

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
