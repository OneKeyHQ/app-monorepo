import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  SizableText,
  Stack,
  Switch,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { buildBorrowTag } from '@onekeyhq/kit/src/views/Staking/utils/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  EBorrowProviderEnum,
  EEarnLabels,
} from '@onekeyhq/shared/types/staking';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { useBorrowContext } from '../BorrowProvider';
import { useUniversalBorrowSetCollateral } from '../hooks/useUniversalBorrowHooks';
import { BorrowTestIDs } from '../testIDs';

import {
  getCollateralSwitchState,
  hasPendingSetCollateral,
  shouldReleaseCollateralSubmission,
} from './collateralControls.utils';
import { HealthFactorInfo } from './ManagePosition/modules/InfoDisplaySection/HealthFactorInfo';

type ISuppliedAsset = IBorrowReserveItem['supplied']['assets'][number];

const COLLATERAL_SETTLEMENT_REFRESH_DELAY = timerUtils.getTimeDurationMs({
  seconds: 3,
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
  // Synchronous guard: block a second confirm dialog from opening before the
  // modal overlay mounts (sub-frame double-tap) — prevents duplicate signing.
  const confirmingRef = useRef(false);
  const sawPendingSubmissionRef = useRef(false);
  const pendingSetCollateral = market
    ? hasPendingSetCollateral({ pendingTxs, provider: market.provider })
    : false;
  const requiresEModeId =
    market?.provider.toLowerCase() === EBorrowProviderEnum.Aave;

  useEffect(() => {
    if (
      shouldReleaseCollateralSubmission({
        usageAsCollateral: item.usageAsCollateral,
        targetUsageAsCollateral: submittingTarget,
      })
    ) {
      setSubmittingTarget(null);
    }
  }, [item.usageAsCollateral, submittingTarget]);

  useEffect(() => {
    if (submittingTarget === null) {
      sawPendingSubmissionRef.current = false;
      return;
    }
    if (pendingSetCollateral) {
      sawPendingSubmissionRef.current = true;
      return;
    }
    if (!sawPendingSubmissionRef.current) {
      return;
    }
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      timer = setTimeout(() => {
        void refreshAllBorrowData()
          .then(() => {
            if (disposed) {
              return;
            }
            sawPendingSubmissionRef.current = false;
            setSubmittingTarget((current) =>
              current === submittingTarget ? null : current,
            );
          })
          .catch(() => {
            if (!disposed) {
              scheduleRefresh();
            }
          });
      }, COLLATERAL_SETTLEMENT_REFRESH_DELAY);
    };
    scheduleRefresh();
    return () => {
      disposed = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [pendingSetCollateral, refreshAllBorrowData, submittingTarget]);

  const { render, value, disabled } = getCollateralSwitchState({
    usageAsCollateral: item.usageAsCollateral,
    canBeCollateral: item.canBeCollateral,
    submitting: submittingTarget !== null,
    pendingSetCollateral,
  });

  const handleToggle = useCallback(() => {
    if (!market || !accountId) return;
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    const target = !(item.usageAsCollateral === true);
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
          onSuccess: () => {
            // The refreshed data flips the switch — no optimistic flip.
            // A failed refresh must not unlock a broadcast transaction.
            void refreshAllBorrowData().catch(() => undefined);
          },
          onFail: () => setSubmittingTarget(null),
          onCancel: () => setSubmittingTarget(null),
        });
      } catch {
        // Build/tx errors are already surfaced by the API interceptor toast;
        // rethrowing inside a void IIFE would only be an unhandled rejection.
        setSubmittingTarget(null);
      }
    })();
  }, [
    accountId,
    eModeId,
    intl,
    item.reserveAddress,
    item.token.symbol,
    item.usageAsCollateral,
    market,
    refreshAllBorrowData,
    requiresEModeId,
    setCollateral,
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
