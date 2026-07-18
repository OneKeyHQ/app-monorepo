import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Button,
  Page,
  SizableText,
  Skeleton,
  YStack,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useBorrowEModeStatus } from '@onekeyhq/kit/src/views/Borrow/hooks/useBorrowEModeStatus';
import { useBorrowHealthFactor } from '@onekeyhq/kit/src/views/Borrow/hooks/useBorrowHealthFactor';
import { useStakingPendingTxsByInfo } from '@onekeyhq/kit/src/views/Earn/hooks/useStakingPendingTxs';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { EarnProviderMirror } from '../../../Earn/EarnProviderMirror';
import { useEarnAccount } from '../../../Staking/hooks/useEarnAccount';

import { EModeAssetsTable } from './EModeAssetsTable';
import { EModeCategorySelect } from './EModeCategorySelect';
import { EModeImpactSection } from './EModeImpactSection';
import {
  buildEModeRows,
  buildNeedActionItems,
  isEModeBorrowActionTag,
  isEModeFocusActivationPending,
  isEModePendingGuardActive,
  reconcileEModeSelection,
  resolveEModeViewState,
} from './emodeUtils';
import { useEModeSwitch } from './useEModeSwitch';

function BorrowEModeSwitchView() {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.BorrowEModeSwitch
  >();
  const {
    accountId: routeAccountId,
    indexedAccountId,
    networkId,
    provider,
    marketAddress,
  } = route.params;
  const intl = useIntl();
  const navigation = useAppNavigation();
  const isFocused = useRouteIsFocused();
  const [userSelection, setUserSelection] = useState<number | null>(null);
  const { earnAccount } = useEarnAccount({
    networkId,
    accountId: routeAccountId,
    indexedAccountId,
  });
  const accountId = earnAccount?.account?.id || routeAccountId || '';

  const { eModeStatus, isLoading, refresh } = useBorrowEModeStatus({
    networkId,
    provider,
    marketAddress,
    accountId,
    enabled: !!accountId,
  });
  const currentEModeId = eModeStatus?.eModeId ?? null;
  const { healthFactorData, isLoading: currentHealthFactorLoading } =
    useBorrowHealthFactor({
      networkId,
      provider,
      marketAddress,
      accountId,
      enabled: !!accountId,
    });
  const rows = useMemo(
    () =>
      buildEModeRows(
        eModeStatus,
        intl.formatMessage({ id: ETranslations.defi_emode_off }),
      ),
    [eModeStatus, intl],
  );
  const getCategoryLabel = useCallback(
    (id: number) => rows.find((row) => row.eModeId === id)?.displayLabel,
    [rows],
  );

  const {
    check,
    isChecking,
    isSubmitting,
    runCheck,
    resetTarget,
    confirmSwitch,
  } = useEModeSwitch({
    networkId,
    accountId,
    provider,
    marketAddress,
    onSwitched: () => {
      void refresh();
      navigation.pop();
    },
    getCategoryLabel,
  });

  const availableIds = useMemo(() => rows.map((row) => row.eModeId), [rows]);
  const selection = useMemo(
    () =>
      reconcileEModeSelection({
        statusCurrentId: eModeStatus?.eModeId ?? null,
        userSelection,
        availableIds,
      }),
    [availableIds, eModeStatus?.eModeId, userSelection],
  );

  const retainedTargetRef = useRef(selection.userSelection);
  retainedTargetRef.current = selection.userSelection;
  const refreshManagementState = useCallback(async () => {
    const selectedTarget = retainedTargetRef.current;
    await Promise.all([
      refresh(),
      selectedTarget === null ? Promise.resolve() : runCheck(selectedTarget),
    ]);
  }, [refresh, runCheck]);
  const pendingTagMatcher = useCallback(
    (tag: string) =>
      isEModeBorrowActionTag({
        tag,
        provider,
        actions: ['setEMode'],
      }),
    [provider],
  );
  const {
    pendingCount,
    isLoading: pendingHistoryLoading,
    refreshPending,
  } = useStakingPendingTxsByInfo({
    networkIds: [networkId],
    tagMatcher: pendingTagMatcher,
    onRefresh: refreshManagementState,
    onRefreshDelayMs: 3000,
  });
  const [focusRevalidating, setFocusRevalidating] = useState(isFocused);
  const previousIsFocused = usePrevious(isFocused);
  const focusActivationPending = isEModeFocusActivationPending({
    isFocused,
    previousIsFocused,
  });
  useEffect(() => {
    if (!isFocused || !accountId) {
      return;
    }
    let disposed = false;
    setFocusRevalidating(true);
    void (async () => {
      try {
        await Promise.all([refreshPending(), refreshManagementState()]);
      } catch {
        // Best-effort revalidation; each data hook preserves its last result.
      } finally {
        if (!disposed) {
          setFocusRevalidating(false);
        }
      }
    })();
    return () => {
      disposed = true;
    };
  }, [accountId, isFocused, refreshManagementState, refreshPending]);
  const pendingGuardActive = isEModePendingGuardActive({
    pendingHistoryLoading,
    pendingCount,
    focusRevalidating: focusRevalidating || focusActivationPending,
  });

  useEffect(() => {
    if (selection.resetTarget && userSelection !== null) {
      setUserSelection(null);
      resetTarget();
    }
  }, [resetTarget, selection.resetTarget, userSelection]);

  const previousCurrentIdRef = useRef<number | null>(null);
  const requiresRevalidation =
    currentEModeId !== null &&
    previousCurrentIdRef.current !== null &&
    previousCurrentIdRef.current !== currentEModeId &&
    selection.userSelection !== null &&
    !selection.resetTarget;
  useEffect(() => {
    previousCurrentIdRef.current = currentEModeId;
    if (requiresRevalidation && selection.userSelection !== null) {
      void runCheck(selection.userSelection);
    }
  }, [currentEModeId, requiresRevalidation, runCheck, selection.userSelection]);

  const onSelectCategory = useCallback(
    (eModeId: number) => {
      if (eModeId === eModeStatus?.eModeId) {
        setUserSelection(null);
        resetTarget();
        return;
      }
      setUserSelection(eModeId);
      void runCheck(eModeId);
    },
    [eModeStatus?.eModeId, resetTarget, runCheck],
  );

  const openNeedAction = useCallback(
    (eModeId: number, label: string) => {
      navigation.push(EModalStakingRoutes.BorrowEModeNeedAction, {
        accountId,
        indexedAccountId,
        networkId,
        provider,
        marketAddress,
        targetEModeId: eModeId,
        categoryLabel: label,
      });
    },
    [
      accountId,
      indexedAccountId,
      marketAddress,
      navigation,
      networkId,
      provider,
    ],
  );

  const effectiveSelection = selection.effectiveSelection;
  const selectedRow = rows.find((row) => row.eModeId === effectiveSelection);
  const viewState = resolveEModeViewState({
    effectiveSelection,
    currentEModeId,
    isChecking,
    requiresRevalidation,
    check,
  });
  const blockerItems = buildNeedActionItems(check);
  const blockerTitle = blockerItems.length
    ? intl.formatMessage(
        { id: ETranslations.defi_emode_resolve_count },
        { count: blockerItems.length },
      )
    : intl.formatMessage(
        { id: ETranslations.defi_emode_need_action_subtitle },
        { category: selectedRow?.displayLabel ?? '' },
      );

  const onRetryCheck = useCallback(() => {
    if (effectiveSelection !== null) {
      void runCheck(effectiveSelection);
    }
  }, [effectiveSelection, runCheck]);

  const onFooterConfirm = useCallback(() => {
    if (!selectedRow || pendingGuardActive) {
      return;
    }
    if (viewState === 'blocked') {
      openNeedAction(selectedRow.eModeId, selectedRow.displayLabel);
      return;
    }
    if (viewState === 'switchable') {
      void confirmSwitch();
    }
  }, [
    confirmSwitch,
    openNeedAction,
    pendingGuardActive,
    selectedRow,
    viewState,
  ]);

  let footerText = intl.formatMessage({
    id: ETranslations.defi_emode_switch_to,
  });
  if (viewState === 'current') {
    footerText = intl.formatMessage({
      id: ETranslations.defi_emode_current,
    });
  } else if (viewState === 'blocked') {
    footerText = intl.formatMessage({
      id: ETranslations.defi_emode_resolve_requirements,
    });
  } else if (viewState === 'switchable') {
    footerText = selectedRow?.isOff
      ? intl.formatMessage({ id: ETranslations.defi_emode_turn_off })
      : intl.formatMessage(
          { id: ETranslations.defi_emode_switch_to__action },
          { category: selectedRow?.displayLabel ?? '' },
        );
  }

  // usePromiseResult exposes no error field; a settled load with no status is
  // the existing signal that the request failed.
  if (isLoading === false && !eModeStatus && accountId) {
    return (
      <Page scrollEnabled>
        <Page.Header
          title={intl.formatMessage({ id: ETranslations.defi_emode_title })}
        />
        <Page.Body px="$5">
          <YStack gap="$4" py="$8" ai="center">
            <SizableText size="$bodyLg" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.defi_emode_load_error })}
            </SizableText>
            <Button
              size="medium"
              variant="secondary"
              testID="borrow-e-mode-retry"
              onPress={() => void refresh()}
            >
              {intl.formatMessage({ id: ETranslations.global_retry })}
            </Button>
          </YStack>
        </Page.Body>
      </Page>
    );
  }

  const showInitialSkeleton = !eModeStatus;
  const showFooter = !showInitialSkeleton && !!selectedRow;
  const footerDisabled =
    isSubmitting ||
    pendingGuardActive ||
    (viewState !== 'blocked' && viewState !== 'switchable');

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.defi_emode_title })}
      />
      <Page.Body px="$5" gap="$5">
        {showInitialSkeleton ? (
          <YStack gap="$3" py="$4">
            <Skeleton h="$12" w="100%" borderRadius="$3" />
            <Skeleton h="$24" w="100%" borderRadius="$3" />
          </YStack>
        ) : null}
        {!showInitialSkeleton && selectedRow ? (
          <>
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.defi_emode_intro })}
            </SizableText>
            <EModeCategorySelect
              rows={rows}
              currentEModeId={currentEModeId ?? 0}
              value={effectiveSelection}
              disabled={isSubmitting || pendingGuardActive}
              onChange={onSelectCategory}
            />
            <EModeImpactSection
              row={selectedRow}
              isCurrent={viewState === 'current'}
              check={viewState === 'current' ? null : check}
              isChecking={viewState === 'checking'}
              currentHealthFactor={healthFactorData?.healthFactor?.text}
              currentHealthFactorLoading={!!currentHealthFactorLoading}
            />
            {viewState === 'error' ? (
              <Alert
                type="critical"
                icon="ErrorOutline"
                title={intl.formatMessage({
                  id: ETranslations.defi_emode_load_error,
                })}
                action={{
                  primary: intl.formatMessage({
                    id: ETranslations.global_retry,
                  }),
                  primaryTestID: 'borrow-e-mode-check-retry',
                  onPrimaryPress: onRetryCheck,
                }}
              />
            ) : null}
            {viewState === 'blocked' ? (
              <Alert type="warning" icon="ErrorOutline" title={blockerTitle} />
            ) : null}
            <EModeAssetsTable row={selectedRow} />
          </>
        ) : null}
      </Page.Body>
      {showFooter ? (
        <Page.Footer>
          <Page.FooterActions
            onConfirmText={footerText}
            confirmButtonProps={{
              testID: 'borrow-e-mode-footer-confirm',
              onPress: onFooterConfirm,
              loading:
                viewState === 'checking' || isSubmitting || pendingGuardActive,
              disabled: footerDisabled,
            }}
          />
        </Page.Footer>
      ) : null}
    </Page>
  );
}

function BorrowEModeSwitch() {
  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home, sceneUrl: '' }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <DiscoveryBrowserProviderMirror>
          <BorrowEModeSwitchView />
        </DiscoveryBrowserProviderMirror>
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default BorrowEModeSwitch;
