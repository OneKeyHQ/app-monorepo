import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  SizableText,
  Stack,
  Switch,
  Toast,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  getLastSignedTxid,
  showDeFiActionTxConfirmDialog,
} from '@onekeyhq/kit/src/components/DeFi/DeFiActionTxConfirmResult';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { waitForTxFinalStatus } from '@onekeyhq/kit/src/utils/waitForTxFinalStatus';
import { buildBorrowTag } from '@onekeyhq/kit/src/views/Staking/utils/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import {
  EBorrowProviderEnum,
  EEarnLabels,
} from '@onekeyhq/shared/types/staking';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { useBorrowContext } from '../BorrowProvider';
import { useUniversalBorrowSetCollateral } from '../hooks/useUniversalBorrowHooks';
import { BorrowTestIDs } from '../testIDs';

import {
  COLLATERAL_SETTLEMENT_FAST_REFRESH_ATTEMPTS,
  COLLATERAL_SETTLEMENT_MAX_REFRESH_ATTEMPTS,
  getCollateralSettlementRefreshDecision,
  getCollateralSwitchState,
  hasPendingSetCollateral,
  shouldReleaseCollateralSubmission,
} from './collateralControls.utils';
import { HealthFactorInfo } from './ManagePosition/modules/InfoDisplaySection/HealthFactorInfo';

type ISuppliedAsset = IBorrowReserveItem['supplied']['assets'][number];
type ICollateralSettlementStatus = 'idle' | 'confirming' | 'success';

const COLLATERAL_SETTLEMENT_REFRESH_DELAY = timerUtils.getTimeDurationMs({
  seconds: 3,
});
// Keep the switch fail-closed when the reserve indexer lags a finalized tx,
// while reducing request pressure after the initial reconciliation window.
const COLLATERAL_SETTLEMENT_SLOW_REFRESH_DELAY = timerUtils.getTimeDurationMs({
  seconds: 15,
});

function CollateralConfirmDialogContent({
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  accountId,
  useAsCollateral,
  eModeId,
  symbol,
  onConfirm,
}: {
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  accountId: string;
  useAsCollateral: boolean;
  eModeId?: number;
  symbol: string;
  onConfirm: () => Promise<void>;
}) {
  const intl = useIntl();
  // Server-side HF preview. Any fetch failure (e.g. code 70018 "confirmation
  // unavailable", which ships disableAutoToast) degrades to the static copy —
  // never block the flow on a missing preview; the build endpoint's own risk
  // guard (70105) is the second net.
  const { result: confirmation, isLoading } = usePromiseResult(
    async () => {
      try {
        return await backgroundApiProxy.serviceStaking.getBorrowTransactionConfirmation(
          {
            networkId,
            provider,
            marketAddress,
            reserveAddress,
            accountId,
            action: 'setCollateral',
            useAsCollateral,
            eModeId,
            amount: '0',
          },
        );
      } catch {
        return undefined;
      }
    },
    [
      networkId,
      provider,
      marketAddress,
      reserveAddress,
      accountId,
      useAsCollateral,
      eModeId,
    ],
    { watchLoading: true },
  );

  const healthFactor = confirmation?.healthFactor;
  const liquidationRisk = confirmation?.liquidationRisk === true;

  return (
    <YStack gap="$5">
      <YStack gap="$1">
        <SizableText size="$bodyLgMedium">{symbol}</SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: useAsCollateral
              ? ETranslations.defi_enable_collateral__desc
              : ETranslations.defi_disable_collateral__desc,
          })}
        </SizableText>
      </YStack>
      {healthFactor ? (
        <HealthFactorInfo
          data={healthFactor}
          liquidationAt={confirmation?.liquidationAt}
        />
      ) : null}
      {liquidationRisk ? (
        <SizableText size="$bodyMd" color="$textCritical">
          {intl.formatMessage({
            id: ETranslations.defi_disable_collateral_liquidation_risk__desc,
          })}
        </SizableText>
      ) : null}
      <Dialog.Footer
        showCancelButton
        onConfirm={onConfirm}
        onConfirmText={intl.formatMessage({ id: ETranslations.global_confirm })}
        onCancelText={intl.formatMessage({ id: ETranslations.global_cancel })}
        confirmButtonProps={{
          testID: BorrowTestIDs.collateralConfirmBtn,
          loading: isLoading,
          disabled: isLoading || liquidationRisk,
        }}
      />
    </YStack>
  );
}

function showCollateralConfirmDialog(params: {
  title: string;
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  accountId: string;
  useAsCollateral: boolean;
  eModeId?: number;
  symbol: string;
}): Promise<boolean> {
  const { title, ...contentProps } = params;
  return new Promise((resolve) => {
    let confirmed = false;
    const dialog = Dialog.show({
      title,
      showFooter: false,
      onClose: () => resolve(confirmed),
      renderContent: (
        <CollateralConfirmDialogContent
          {...contentProps}
          onConfirm={async () => {
            confirmed = true;
            await dialog.close();
          }}
        />
      ),
    });
  });
}

// Self-contained on purpose: TableList's memo comparator stringifies column
// defs (functions dropped), so render-time state must live in the mounted
// cell, never in column-def closures.
export function CollateralSwitchCell({
  item,
  eModeId,
}: {
  item: ISuppliedAsset;
  eModeId?: number;
}) {
  const intl = useIntl();
  const { market, earnAccount, pendingTxs, refreshAllBorrowData } =
    useBorrowContext();
  const accountId = earnAccount.data?.account?.id || '';
  const setCollateral = useUniversalBorrowSetCollateral({
    networkId: market?.networkId || '',
    accountId,
  });

  // Hold the row until fresh reserves contain the target state. The pending
  // tag remains a separate remount guard; stale refreshes must not unlock it.
  const [submittingTarget, setSubmittingTarget] = useState<boolean | null>(
    null,
  );
  const [settlementStatus, setSettlementStatus] =
    useState<ICollateralSettlementStatus>('idle');
  // Once the chain confirms success, retain the target as the displayed state
  // if the reserve indexer remains stale. This prevents a second identical tx
  // without keeping the control permanently locked.
  const [optimisticUsageAsCollateral, setOptimisticUsageAsCollateral] =
    useState<boolean | null>(null);
  // Synchronous guard: block a second confirm dialog from opening before the
  // modal overlay mounts (sub-frame double-tap) — prevents duplicate signing.
  const confirmingRef = useRef(false);
  const submittingTargetRef = useRef<boolean | null>(null);
  const settlementRefreshAttemptsRef = useRef(0);
  const settlementWarningShownRef = useRef(false);
  const settlementControllerRef = useRef<AbortController | undefined>(
    undefined,
  );
  const mountedRef = useRef(true);
  const usageAsCollateralRef = useRef(item.usageAsCollateral);
  usageAsCollateralRef.current = item.usageAsCollateral;
  const pendingSetCollateral = market
    ? hasPendingSetCollateral({ pendingTxs, provider: market.provider })
    : false;
  const requiresEModeId =
    market?.provider.toLowerCase() === EBorrowProviderEnum.Aave;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      settlementControllerRef.current?.abort();
    };
  }, []);

  const releaseLocalSubmission = useCallback(() => {
    settlementControllerRef.current?.abort();
    settlementControllerRef.current = undefined;
    submittingTargetRef.current = null;
    settlementRefreshAttemptsRef.current = 0;
    settlementWarningShownRef.current = false;
    setSettlementStatus('idle');
    setSubmittingTarget(null);
  }, []);

  const showSettlementWarning = useCallback(() => {
    if (settlementWarningShownRef.current) {
      return;
    }
    settlementWarningShownRef.current = true;
    Toast.warning({
      title: intl.formatMessage({
        id: ETranslations.earn_pending_transactions_data_out_of_sync,
      }),
    });
  }, [intl]);

  useEffect(() => {
    if (
      shouldReleaseCollateralSubmission({
        usageAsCollateral: item.usageAsCollateral,
        targetUsageAsCollateral: submittingTarget,
      })
    ) {
      setOptimisticUsageAsCollateral(null);
      releaseLocalSubmission();
    }
  }, [item.usageAsCollateral, releaseLocalSubmission, submittingTarget]);

  useEffect(() => {
    if (
      optimisticUsageAsCollateral !== null &&
      item.usageAsCollateral === optimisticUsageAsCollateral
    ) {
      setOptimisticUsageAsCollateral(null);
    }
  }, [item.usageAsCollateral, optimisticUsageAsCollateral]);

  useEffect(() => {
    if (submittingTarget === null) {
      settlementRefreshAttemptsRef.current = 0;
      settlementWarningShownRef.current = false;
      return;
    }
    if (pendingSetCollateral || settlementStatus !== 'success') {
      return;
    }
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      const decision = getCollateralSettlementRefreshDecision({
        usageAsCollateral: usageAsCollateralRef.current,
        targetUsageAsCollateral: submittingTarget,
        completedRefreshAttempts: settlementRefreshAttemptsRef.current,
        fastRefreshAttempts: COLLATERAL_SETTLEMENT_FAST_REFRESH_ATTEMPTS,
        maxRefreshAttempts: COLLATERAL_SETTLEMENT_MAX_REFRESH_ATTEMPTS,
      });
      if (decision === 'settled') {
        setOptimisticUsageAsCollateral(null);
        releaseLocalSubmission();
        return;
      }
      if (decision === 'exhausted') {
        showSettlementWarning();
        releaseLocalSubmission();
        return;
      }
      if (decision === 'retry-slow') {
        showSettlementWarning();
      }
      timer = setTimeout(
        () => {
          void refreshAllBorrowData()
            .catch(() => undefined)
            .then(() => {
              if (disposed) return;
              settlementRefreshAttemptsRef.current += 1;
              scheduleRefresh();
            });
        },
        decision === 'retry-slow'
          ? COLLATERAL_SETTLEMENT_SLOW_REFRESH_DELAY
          : COLLATERAL_SETTLEMENT_REFRESH_DELAY,
      );
    };
    scheduleRefresh();
    return () => {
      disposed = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [
    pendingSetCollateral,
    refreshAllBorrowData,
    releaseLocalSubmission,
    settlementStatus,
    showSettlementWarning,
    submittingTarget,
  ]);

  const effectiveUsageAsCollateral =
    optimisticUsageAsCollateral ?? item.usageAsCollateral;

  const { render, value, disabled } = getCollateralSwitchState({
    usageAsCollateral: effectiveUsageAsCollateral,
    canBeCollateral: item.canBeCollateral,
    submitting: submittingTarget !== null,
    pendingSetCollateral,
  });

  const handleToggle = useCallback(() => {
    if (!market || !accountId) return;
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    const target = !(effectiveUsageAsCollateral === true);
    const targetEModeId = target ? eModeId : undefined;
    if (target && requiresEModeId && targetEModeId === undefined) {
      confirmingRef.current = false;
      return;
    }
    void (async () => {
      let confirmed = false;
      try {
        confirmed = await showCollateralConfirmDialog({
          title: intl.formatMessage({
            id: target
              ? ETranslations.defi_enable_as_collateral__title
              : ETranslations.defi_disable_as_collateral__title,
          }),
          networkId: market.networkId,
          provider: market.provider,
          marketAddress: market.marketAddress,
          reserveAddress: item.reserveAddress,
          accountId,
          useAsCollateral: target,
          eModeId: targetEModeId,
          symbol: item.token.symbol,
        });
      } finally {
        confirmingRef.current = false;
      }
      if (!confirmed) return;
      settlementControllerRef.current?.abort();
      settlementControllerRef.current = undefined;
      settlementRefreshAttemptsRef.current = 0;
      settlementWarningShownRef.current = false;
      submittingTargetRef.current = target;
      setSettlementStatus('confirming');
      setSubmittingTarget(target);
      try {
        await setCollateral({
          provider: market.provider,
          marketAddress: market.marketAddress,
          reserveAddress: item.reserveAddress,
          useAsCollateral: target,
          eModeId: targetEModeId,
          stakingInfo: {
            label: EEarnLabels.Borrow,
            protocol: earnUtils.getEarnProviderName({
              providerName: market.provider,
            }),
            protocolLogoURI: market.logoURI,
            tags: [
              EEarnLabels.Borrow,
              buildBorrowTag({
                provider: market.provider,
                action: 'setCollateral',
              }),
            ],
          },
          onSuccess: (data) => {
            void (async () => {
              const txid = getLastSignedTxid(data);
              let finalStatus = await showDeFiActionTxConfirmDialog({
                accountId,
                networkId: market.networkId,
                data,
              });
              if (
                !mountedRef.current ||
                submittingTargetRef.current !== target
              ) {
                return;
              }
              if (finalStatus === undefined && txid) {
                const controller = new AbortController();
                settlementControllerRef.current?.abort();
                settlementControllerRef.current = controller;
                finalStatus = await waitForTxFinalStatus({
                  accountId,
                  networkId: market.networkId,
                  txid,
                  signal: controller.signal,
                });
                if (settlementControllerRef.current === controller) {
                  settlementControllerRef.current = undefined;
                }
              }
              if (
                !mountedRef.current ||
                submittingTargetRef.current !== target
              ) {
                return;
              }
              settlementRefreshAttemptsRef.current = 0;
              if (finalStatus === EOnChainHistoryTxStatus.Failed) {
                releaseLocalSubmission();
                return;
              }
              if (finalStatus === EOnChainHistoryTxStatus.Success) {
                setOptimisticUsageAsCollateral(target);
                setSettlementStatus('success');
                // Fresh reserves, not the broadcast callback, finalize the
                // server-owned position state.
                void refreshAllBorrowData().catch(() => undefined);
                return;
              }
              showSettlementWarning();
              void refreshAllBorrowData().catch(() => undefined);
              releaseLocalSubmission();
            })();
          },
          onFail: () => {
            releaseLocalSubmission();
          },
          onCancel: () => {
            releaseLocalSubmission();
          },
        });
      } catch {
        // Build/tx errors are already surfaced by the API interceptor toast;
        // rethrowing inside a void IIFE would only be an unhandled rejection.
        releaseLocalSubmission();
      }
    })();
  }, [
    accountId,
    eModeId,
    intl,
    item.reserveAddress,
    item.token.symbol,
    effectiveUsageAsCollateral,
    market,
    refreshAllBorrowData,
    releaseLocalSubmission,
    requiresEModeId,
    setCollateral,
    showSettlementWarning,
  ]);

  if (!render || !market || !accountId) return null;

  return (
    <Stack
      onPress={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <Switch
        testID={BorrowTestIDs.suppliedCollateralSwitch}
        value={value}
        size="small"
        disabled={
          disabled || (!value && requiresEModeId && eModeId === undefined)
        }
        onChange={handleToggle}
      />
    </Stack>
  );
}
