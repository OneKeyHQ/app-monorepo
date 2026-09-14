import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  SizableText,
  Spinner,
  Stack,
  Switch,
  Toast,
  YStack,
} from '@onekeyhq/components';
import type { ISwitchProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  getLastSignedTxid,
  showDeFiActionTxConfirmDialog,
} from '@onekeyhq/kit/src/components/DeFi/DeFiActionTxConfirmResult';
import { waitForTxFinalStatus } from '@onekeyhq/kit/src/utils/waitForTxFinalStatus';
import { buildBorrowTag } from '@onekeyhq/kit/src/views/Staking/utils/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import {
  EBorrowProviderEnum,
  EEarnLabels,
} from '@onekeyhq/shared/types/staking';
import type {
  IBorrowReserveItem,
  IBorrowTransactionConfirmation,
} from '@onekeyhq/shared/types/staking';

import { getBorrowEarnAccountId } from '../borrowEarnAccount';
import { useBorrowContext } from '../BorrowProvider';
import { useUniversalBorrowSetCollateral } from '../hooks/useUniversalBorrowHooks';
import { BorrowTestIDs } from '../testIDs';

import { isUnsupportedAaveNativeReserve } from './borrowRepayPosition.utils';
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
type ICollateralConfirmationOperation = { phase: 'preview' | 'dialog' };

const COLLATERAL_SETTLEMENT_REFRESH_DELAY = timerUtils.getTimeDurationMs({
  seconds: 3,
});
// Keep the switch fail-closed when the reserve indexer lags a finalized tx,
// while reducing request pressure after the initial reconciliation window.
const COLLATERAL_SETTLEMENT_SLOW_REFRESH_DELAY = timerUtils.getTimeDurationMs({
  seconds: 15,
});

function CollateralConfirmDialogContent({
  confirmation,
  useAsCollateral,
  symbol,
  onConfirm,
}: {
  confirmation?: IBorrowTransactionConfirmation;
  useAsCollateral: boolean;
  symbol: string;
  onConfirm: () => Promise<void>;
}) {
  const intl = useIntl();
  const healthFactor = confirmation?.healthFactor;
  const liquidationRisk = confirmation?.liquidationRisk === true;
  const previewUnavailable = confirmation === undefined;
  const collateralUnavailable =
    useAsCollateral && confirmation?.canBeCollateral === false;
  const actionUnavailable = previewUnavailable || collateralUnavailable;
  const confirmDisabled = liquidationRisk || actionUnavailable;
  const handleConfirm = useCallback(async () => {
    // This guard protects the dialog interaction. The final transaction owner
    // performs another authoritative preview immediately before building.
    if (confirmDisabled) {
      return;
    }
    await onConfirm();
  }, [confirmDisabled, onConfirm]);

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
      {actionUnavailable ? (
        <SizableText size="$bodyMd" color="$textCritical">
          {intl.formatMessage({
            id: ETranslations.defi_action_unavailable__msg,
          })}
        </SizableText>
      ) : null}
      <Dialog.Footer
        showCancelButton
        onConfirm={handleConfirm}
        onConfirmText={intl.formatMessage({ id: ETranslations.global_confirm })}
        onCancelText={intl.formatMessage({ id: ETranslations.global_cancel })}
        confirmButtonProps={{
          testID: BorrowTestIDs.collateralConfirmBtn,
          disabled: confirmDisabled,
        }}
      />
    </YStack>
  );
}

function showCollateralConfirmDialog(params: {
  title: string;
  confirmation?: IBorrowTransactionConfirmation;
  useAsCollateral: boolean;
  symbol: string;
}): Promise<boolean> {
  const { title, ...contentProps } = params;
  return new Promise((resolve) => {
    let confirmed = false;
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };
    const dialog = Dialog.show({
      title,
      showFooter: false,
      onClose: () => settle(confirmed),
      renderContent: (
        <CollateralConfirmDialogContent
          {...contentProps}
          onConfirm={async () => {
            confirmed = true;
            try {
              await dialog.close();
            } catch {
              confirmed = false;
              settle(false);
            }
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
  size = 'small',
}: {
  item: ISuppliedAsset;
  eModeId?: number;
  size?: ISwitchProps['size'];
}) {
  const intl = useIntl();
  const { market, earnAccount, pendingTxs, refreshAllBorrowData } =
    useBorrowContext();
  const accountId = getBorrowEarnAccountId(earnAccount.data) ?? '';
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
  const [previewLoading, setPreviewLoading] = useState(false);
  // Once the chain confirms success, retain the target as the displayed state
  // if the reserve indexer remains stale. This prevents a second identical tx
  // without keeping the control permanently locked.
  const [optimisticUsageAsCollateral, setOptimisticUsageAsCollateral] =
    useState<boolean | null>(null);
  // Synchronous guard: block a second confirm dialog from opening before the
  // modal overlay mounts (sub-frame double-tap) — prevents duplicate signing.
  const confirmingRef = useRef<ICollateralConfirmationOperation | null>(null);
  const submittingTargetRef = useRef<boolean | null>(null);
  const settlementRefreshAttemptsRef = useRef(0);
  const settlementWarningShownRef = useRef(false);
  const settlementControllerRef = useRef<AbortController | undefined>(
    undefined,
  );
  const mountedRef = useRef(true);
  const usageAsCollateralRef = useRef(item.usageAsCollateral);
  usageAsCollateralRef.current = item.usageAsCollateral;
  const normalizedMarketAddress = market
    ? earnUtils.normalizeBorrowAddress({
        networkId: market.networkId,
        address: market.marketAddress,
      })
    : '';
  const normalizedReserveAddress = market
    ? earnUtils.normalizeBorrowAddress({
        networkId: market.networkId,
        address: item.reserveAddress,
      })
    : item.reserveAddress;
  const operationScopeKey = JSON.stringify({
    networkId: market?.networkId ?? '',
    accountId,
    provider: market?.provider.toLowerCase() ?? '',
    marketAddress: normalizedMarketAddress,
    reserveAddress: normalizedReserveAddress,
  });
  const renderedOperationScope = useMemo(
    () => ({ key: operationScopeKey }),
    [operationScopeKey],
  );
  const operationScopeRef = useRef(renderedOperationScope);
  const confirmationScopeKey = JSON.stringify({
    operationScopeKey,
    eModeId: eModeId ?? null,
  });
  const renderedConfirmationScope = useMemo(
    () => ({ key: confirmationScopeKey }),
    [confirmationScopeKey],
  );
  const confirmationScopeRef = useRef(renderedConfirmationScope);
  const pendingSetCollateral = market
    ? hasPendingSetCollateral({
        pendingTxs,
        provider: market.provider,
        networkId: market.networkId,
        marketAddress: market.marketAddress,
        reserveAddress: item.reserveAddress,
      })
    : false;
  const requiresEModeId =
    market?.provider.toLowerCase() === EBorrowProviderEnum.Aave;
  // v3.2+ e-modes never gate enabling collateral (see collateralControls.utils);
  // the server flag plus the confirm dialog's live preview stay authoritative.
  const canEnableCollateral = item.canBeCollateral === true;
  const isNativeActionUnsupported = isUnsupportedAaveNativeReserve({
    networkId: market?.networkId,
    providerName: market?.provider,
    reserveAddress: item.reserveAddress,
  });

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

  useLayoutEffect(() => {
    const operationScopeChanged =
      operationScopeRef.current !== renderedOperationScope;
    const confirmationScopeChanged =
      confirmationScopeRef.current !== renderedConfirmationScope;
    operationScopeRef.current = renderedOperationScope;
    confirmationScopeRef.current = renderedConfirmationScope;
    if (
      confirmationScopeChanged &&
      confirmingRef.current?.phase === 'preview'
    ) {
      confirmingRef.current = null;
      setPreviewLoading(false);
    }
    if (!operationScopeChanged) {
      return;
    }
    setOptimisticUsageAsCollateral(null);
    releaseLocalSubmission();
  }, [
    releaseLocalSubmission,
    renderedConfirmationScope,
    renderedOperationScope,
  ]);

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
    canBeCollateral: canEnableCollateral,
    submitting: submittingTarget !== null,
    pendingSetCollateral,
  });

  const handleToggle = useCallback(() => {
    if (!market || !accountId) return;
    if (
      !mountedRef.current ||
      operationScopeRef.current !== renderedOperationScope ||
      confirmationScopeRef.current !== renderedConfirmationScope
    ) {
      return;
    }
    if (confirmingRef.current) return;
    const target = !(effectiveUsageAsCollateral === true);
    const targetEModeId = target ? eModeId : undefined;
    if (
      target &&
      (!canEnableCollateral || (requiresEModeId && targetEModeId === undefined))
    ) {
      return;
    }
    const confirmationOperation: ICollateralConfirmationOperation = {
      phase: 'preview',
    };
    confirmingRef.current = confirmationOperation;
    void (async () => {
      let confirmed = false;
      try {
        setPreviewLoading(true);
        let confirmation: IBorrowTransactionConfirmation | undefined;
        try {
          confirmation =
            await backgroundApiProxy.serviceStaking.getBorrowTransactionConfirmation(
              {
                networkId: market.networkId,
                provider: market.provider,
                marketAddress: market.marketAddress,
                reserveAddress: item.reserveAddress,
                accountId,
                action: 'setCollateral',
                useAsCollateral: target,
                ...(targetEModeId !== undefined
                  ? { eModeId: targetEModeId }
                  : {}),
                amount: '0',
              },
            );
        } catch {
          confirmation = undefined;
        }
        if (
          !mountedRef.current ||
          confirmingRef.current !== confirmationOperation ||
          operationScopeRef.current !== renderedOperationScope ||
          confirmationScopeRef.current !== renderedConfirmationScope
        ) {
          return;
        }
        confirmationOperation.phase = 'dialog';
        setPreviewLoading(false);
        confirmed = await showCollateralConfirmDialog({
          title: intl.formatMessage({
            id: target
              ? ETranslations.defi_enable_as_collateral__title
              : ETranslations.defi_disable_as_collateral__title,
          }),
          confirmation,
          useAsCollateral: target,
          symbol: item.token.symbol,
        });
      } finally {
        if (confirmingRef.current === confirmationOperation) {
          confirmingRef.current = null;
          if (mountedRef.current) {
            setPreviewLoading(false);
          }
        }
      }
      if (
        !confirmed ||
        !mountedRef.current ||
        operationScopeRef.current !== renderedOperationScope ||
        confirmationScopeRef.current !== renderedConfirmationScope
      ) {
        return;
      }
      settlementControllerRef.current?.abort();
      settlementControllerRef.current = undefined;
      settlementRefreshAttemptsRef.current = 0;
      settlementWarningShownRef.current = false;
      submittingTargetRef.current = target;
      setSettlementStatus('confirming');
      setSubmittingTarget(target);
      const isCurrentSubmission = () =>
        mountedRef.current &&
        operationScopeRef.current === renderedOperationScope &&
        submittingTargetRef.current === target;
      try {
        await setCollateral({
          provider: market.provider,
          marketAddress: market.marketAddress,
          reserveAddress: item.reserveAddress,
          useAsCollateral: target,
          ...(targetEModeId !== undefined ? { eModeId: targetEModeId } : {}),
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
              buildBorrowTag({
                provider: market.provider,
                action: 'setCollateral',
                setCollateralScope: {
                  networkId: market.networkId,
                  marketAddress: market.marketAddress,
                  reserveAddress: item.reserveAddress,
                },
              }),
            ],
          },
          onSuccess: (data) => {
            void (async () => {
              const txid = getLastSignedTxid(data);
              let finalStatus: Awaited<
                ReturnType<typeof showDeFiActionTxConfirmDialog>
              >;
              try {
                finalStatus = await showDeFiActionTxConfirmDialog({
                  accountId,
                  networkId: market.networkId,
                  data,
                });
              } catch {
                // A result-sheet failure does not change the broadcast state.
                // Fall through to the exact-tx status lookup before unlocking.
                finalStatus = undefined;
              }
              if (!isCurrentSubmission()) {
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
              if (!isCurrentSubmission()) {
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
            })().catch(() => {
              if (!isCurrentSubmission()) {
                return;
              }
              showSettlementWarning();
              void refreshAllBorrowData().catch(() => undefined);
              releaseLocalSubmission();
            });
          },
          onFail: () => {
            if (isCurrentSubmission()) {
              releaseLocalSubmission();
            }
          },
          onCancel: () => {
            if (isCurrentSubmission()) {
              releaseLocalSubmission();
            }
          },
        });
      } catch {
        // Build/tx errors are already surfaced by the API interceptor toast;
        // rethrowing inside a void IIFE would only be an unhandled rejection.
        if (isCurrentSubmission()) {
          releaseLocalSubmission();
        }
      }
    })();
  }, [
    accountId,
    canEnableCollateral,
    eModeId,
    intl,
    item.reserveAddress,
    item.token.symbol,
    effectiveUsageAsCollateral,
    market,
    refreshAllBorrowData,
    releaseLocalSubmission,
    renderedConfirmationScope,
    renderedOperationScope,
    requiresEModeId,
    setCollateral,
    showSettlementWarning,
  ]);

  if (!render || !market || !accountId) return null;

  const isSwitchDisabled =
    previewLoading ||
    isNativeActionUnsupported ||
    disabled ||
    (!value && requiresEModeId && eModeId === undefined);

  return (
    <Stack
      position="relative"
      ai="center"
      jc="center"
      onPress={
        platformEnv.isNative
          ? undefined
          : (e) => {
              e.stopPropagation();
            }
      }
    >
      <Stack opacity={previewLoading ? 0 : 1}>
        {/* The shared press-based switch avoids native row hit-testing issues on iOS. */}
        <Switch
          testID={BorrowTestIDs.suppliedCollateralSwitch}
          value={value}
          size={size}
          native={!platformEnv.isNativeIOS}
          disabled={isSwitchDisabled}
          {...(platformEnv.isNativeIOS
            ? {
                accessible: true,
                accessibilityRole: 'switch' as const,
                accessibilityLabel: `${item.token.symbol} ${intl.formatMessage({
                  id: ETranslations.defi_collateral,
                })}`,
                accessibilityState: {
                  checked: value,
                  disabled: isSwitchDisabled,
                },
                onAccessibilityTap: () => {
                  if (!isSwitchDisabled) handleToggle();
                },
                hitSlop: { top: 12, bottom: 12, left: 6, right: 6 },
                bg: value ? '$bgAccent' : '$neutral5',
              }
            : undefined)}
          onChange={handleToggle}
        />
      </Stack>
      {previewLoading ? (
        <Stack
          position="absolute"
          top={0}
          right={0}
          bottom={0}
          left={0}
          ai="center"
          jc="center"
          pointerEvents="none"
        >
          <Spinner size="small" />
        </Stack>
      ) : null}
    </Stack>
  );
}
