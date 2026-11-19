import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  buildManagePageFirstFrameKey,
  warmFirstFrame,
} from '@onekeyhq/kit/src/views/Earn/pages/EarnRouter/earnFirstFrameCache';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import {
  EManagePositionType,
  EStakeProtocolGroupEnum,
  type IEarnTokenInfo,
  type IEarnWithdrawActionIcon,
  type IProtocolInfo,
} from '@onekeyhq/shared/types/staking';

import { buildLocalTxStatusSyncId } from '../../../utils/utils';

import { resolveProviderWithdrawApproval } from './providerWithdrawApproval';
import {
  buildManagePageApproveInfo,
  buildManagePageRequestKey,
} from './useManagePage.utils';

export { EManagePositionType };

type IWarmManagePageParams = {
  accountId: string;
  indexedAccountId: string | undefined;
  networkId: string;
  symbol: ISupportedSymbol;
  provider: string;
  vault: string | undefined;
  type?: EManagePositionType;
  reserveAddress?: string;
  marketAddress?: string;
};

export function warmManagePageData(params: IWarmManagePageParams) {
  const type = params.type ?? EManagePositionType.Staking;
  const requestKey = buildManagePageRequestKey({ ...params, type });
  return warmFirstFrame(buildManagePageFirstFrameKey(requestKey), async () => {
    const { accountId, networkId, indexedAccountId, symbol, provider, vault } =
      params;
    const earnAccount = await backgroundApiProxy.serviceStaking.getEarnAccount({
      accountId,
      networkId,
      indexedAccountId,
      btcOnlyTaproot: true,
    });
    if (!earnAccount?.accountAddress) return undefined;
    if (type !== EManagePositionType.Staking) {
      const managePageData =
        await backgroundApiProxy.serviceStaking.getBorrowManagePage({
          accountId: earnAccount.accountId,
          networkId,
          provider,
          marketAddress: params.marketAddress || '',
          reserveAddress: params.reserveAddress || '',
          type,
        });
      return { earnAccount, managePageData, requestKey };
    }
    const needsVerifiedProtocol = earnUtils.shouldSendEarnProtocolVault({
      providerName: provider,
    });
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
        skipStakingConfigFilter: needsVerifiedProtocol,
      }),
    ]);
    if (
      needsVerifiedProtocol &&
      !earnUtils.findEarnProtocol({
        protocols: protocolList ?? [],
        networkId,
        providerName: provider,
        protocolVault: vault,
      })
    )
      return undefined;
    return { earnAccount, managePageData, protocolList, requestKey };
  }).catch(() => undefined);
}

/**
 * Load account actions and protocol metadata, resolving missing receipt
 * approval from the same protocol's details. Missing accounts or failed
 * requests return no form data; request keys isolate protocol switches.
 */
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
  undefinedResultIfReRun = false,
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
  undefinedResultIfReRun?: boolean;
}) => {
  const { locale } = useIntl();
  const { id: currencyId } = useCurrency();
  // Fingerprint of the request params. Stamped onto each result so callers can
  // tell — synchronously, during render — whether the data on screen belongs to
  // the currently requested protocol. This closes the effect-ordering race on
  // protocol switch: child effects (e.g. allowance fetch) run before this
  // hook's own reload effect flips isLoading, so isLoading alone can't guard
  // the first render where fresh params meet stale data.
  const requestKey = buildManagePageRequestKey({
    accountId,
    indexedAccountId,
    networkId,
    symbol,
    provider,
    vault,
    type,
    reserveAddress,
    marketAddress,
  });
  const needsVerifiedProtocol =
    type === EManagePositionType.Staking &&
    earnUtils.shouldSendEarnProtocolVault({ providerName: provider });

  const {
    result,
    isLoading = true,
    run,
  } = usePromiseResult(
    async () => {
      try {
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
              accountId: earnAccount.accountId,
              networkId,
              provider,
              marketAddress: marketAddress || '',
              reserveAddress: reserveAddress || '',
              type: type as 'supply' | 'withdraw' | 'borrow' | 'repay',
            });

          return {
            managePageData,
            protocolList: undefined,
            earnAccount,
            requestKey,
            withdrawApprove: managePageData.withdrawApprove,
          };
        }

        const [managePageData, protocolList, stakingConfig] = await Promise.all(
          [
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
              skipStakingConfigFilter: needsVerifiedProtocol,
            }),
            needsVerifiedProtocol
              ? backgroundApiProxy.serviceStaking
                  .getStakingConfigs({ networkId, provider, symbol })
                  .catch(() => null)
              : undefined,
          ],
        );

        const { withdrawApprove, withdrawApprovalUnavailable } =
          await resolveProviderWithdrawApproval({
            provider,
            networkId,
            symbol,
            vault,
            locale,
            currencyId,
            managePageData,
            protocolList,
          });

        return {
          managePageData,
          protocolList,
          earnAccount,
          requestKey,
          depositsEnabled: stakingConfig?.enabled === true,
          withdrawApprove,
          withdrawApprovalUnavailable,
        };
      } catch {
        // Settle the result with the CURRENT requestKey on failure. Otherwise a
        // rejected switch would keep the previous protocol's requestKey around,
        // leaving isStaleData (and the switch-loading confirm button) stuck
        // forever with no retry path — this modal doesn't revalidate on focus.
        // Falling back to an empty result matches the pre-remount failure
        // behavior (empty form); the user can switch protocols again to retry.
        return {
          managePageData: undefined,
          protocolList: undefined,
          earnAccount: undefined,
          requestKey,
        };
      }
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
      requestKey,
      needsVerifiedProtocol,
      locale,
      currencyId,
    ],
    { watchLoading: true, revalidateOnFocus, undefinedResultIfReRun },
  );

  const isCurrentResult = result?.requestKey === requestKey;
  const protocolList = isCurrentResult ? result.protocolList : undefined;
  const earnAccount = isCurrentResult ? result.earnAccount : undefined;
  const matchingProtocol = earnUtils.findEarnProtocol({
    protocols: protocolList ?? [],
    networkId,
    providerName: provider,
    protocolVault: vault,
  });
  const managePageData =
    isCurrentResult && (!needsVerifiedProtocol || matchingProtocol)
      ? result.managePageData
      : undefined;
  const withdrawApprove = managePageData ? result?.withdrawApprove : undefined;
  const withdrawApprovalUnavailable = Boolean(
    managePageData && result?.withdrawApprovalUnavailable,
  );
  const depositsEnabled =
    result && 'depositsEnabled' in result ? result.depositsEnabled : undefined;

  // True while the data on screen was fetched for different params (protocol
  // switch in flight). Computed during render — no effect-timing dependence.
  const isStaleData = !!result && result.requestKey !== requestKey;

  const resolvedProtocolVault = useMemo(() => {
    if (!needsVerifiedProtocol) {
      return vault;
    }
    return matchingProtocol?.provider.vault;
  }, [matchingProtocol, needsVerifiedProtocol, vault]);

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

    // Get withdraw action from managePageData
    const withdrawAction = managePageData.withdraw as
      | IEarnWithdrawActionIcon
      | undefined;
    const approve = buildManagePageApproveInfo({
      approve: managePageData.approve,
      approveAsset: managePageData.approveAsset,
      approveTarget: managePageData.approveTarget,
    });
    if (approve && !managePageData.approve) {
      approve.allowance = managePageData.borrowAllowance ?? approve.allowance;
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
        protocolVault: resolvedProtocolVault,
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
      // repay max input balance; repay-all debt semantics use debtBalance
      maxRepayBalance: managePageData.repay?.data?.maxBalance,
      // debt balance for collateral repay mode
      debtBalance: managePageData.debt?.data?.balance,
      needsSetupLut: managePageData.needsSetupLut,
      // supply max balance for supply max button
      maxSupplyBalance: managePageData.supply?.data?.maxBalance,
      receiptTokenRate:
        withdrawApprove?.receiptTokenRate ??
        matchingProtocol?.provider.receiptTokenRate ??
        matchingProtocol?.provider.morphoTokenRate,
      morphoTokenRate: matchingProtocol?.provider.morphoTokenRate,
      // approve
      approve,
      approveAsset: approve?.approveAsset ?? managePageData.approveAsset,
      borrowAllowance: managePageData.borrowAllowance,
      withdrawApprove,
    } as IProtocolInfo;
  }, [
    managePageData,
    matchingProtocol,
    symbol,
    provider,
    resolvedProtocolVault,
    networkId,
    earnAccount,
    withdrawApprove,
  ]);

  const depositDisabled = useMemo(() => {
    if (!managePageData) {
      return false;
    }
    if (
      needsVerifiedProtocol &&
      (!depositsEnabled ||
        matchingProtocol?.provider.group ===
          EStakeProtocolGroupEnum.WithdrawOnly)
    ) {
      return true;
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
  }, [
    managePageData,
    type,
    needsVerifiedProtocol,
    depositsEnabled,
    matchingProtocol,
  ]);

  const withdrawDisabled = useMemo(() => {
    if (withdrawApprovalUnavailable) {
      return true;
    }
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
  }, [managePageData, type, withdrawApprovalUnavailable]);

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
    isStaleData,
    run,
    tokenInfo,
    earnAccount,
    protocolInfo,
    depositDisabled,
    withdrawDisabled,
    withdrawApprovalUnavailable,
    alerts,
    alertsHolding,
    alertsStake,
    alertsWithdraw,
    ongoingValidator,
  };
};
