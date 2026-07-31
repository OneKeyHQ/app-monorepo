import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IActionListItemProps } from '@onekeyhq/components';
import {
  Alert,
  Divider,
  Icon,
  Page,
  SizableText,
  Skeleton,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { buildBorrowTokenFromAsset } from '@onekeyhq/kit/src/views/Borrow/components/borrowRepayPosition.utils';
import { BorrowTestIDs } from '@onekeyhq/kit/src/views/Borrow/testIDs';
import { useStakingPendingTxsByInfo } from '@onekeyhq/kit/src/views/Earn/hooks/useStakingPendingTxs';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import {
  EModalReceiveRoutes,
  EModalRoutes,
  EModalSwapRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapSource,
  ESwapTabSwitchType,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { EarnProviderMirror } from '../../../Earn/EarnProviderMirror';
import { EarnAmountText } from '../../../Staking/components/ProtocolDetails/EarnAmountText';
import { useEarnAccount } from '../../../Staking/hooks/useEarnAccount';
import {
  E_MODE_PENDING_GUARD_ACTIONS,
  isEModeBorrowActionTag,
  isEModeFocusActivationPending,
  isEModePendingGuardActive,
} from '../BorrowEModeSwitch/emodeUtils';

import { EModeShortfallCard } from './EModeShortfallCard';
import {
  balanceLookupAddress,
  formatBalanceDisplay,
} from './needActionBalances';
import { isEModeBlockerDataUnavailable } from './needActionContract';
import {
  type ICompactStepStatus,
  getAuxiliaryLineKind,
  getCompactStepStatus,
  getPrimaryLineKind,
  isStepConfirming,
  normalizeApproveSubStatusForConfirmation,
} from './needActionPresentation';
import { type IEModeStep } from './needActionSteps';
import {
  shouldDisarmFundingIntentOnFocus,
  useEModeFundingTx,
} from './useEModeFundingTx';
import {
  type IEModeApproveSubStatus,
  useEModeNeedActionFlow,
} from './useEModeNeedActionFlow';

// While a repay step stays underfunded the user is off topping the wallet up
// (swap, transfer-in); the balance indexer lags those txs, so a single fetch on
// focus return routinely lands the stale pre-top-up balance. Poll at the same
// cadence as the flow's unlock recheck until the shortfall clears.
const FUNDING_BALANCE_POLL_INTERVAL_MS = 5000;

function StepIndicator({
  status,
  stepNumber,
  busy,
}: {
  status: ICompactStepStatus;
  stepNumber: number;
  busy: boolean;
}) {
  if (status === 'done') {
    return <Icon name="CheckRadioSolid" size="$6" color="$iconSuccess" />;
  }
  if (status === 'failed') {
    return <Icon name="XCircleSolid" size="$6" color="$iconCritical" />;
  }
  if (status === 'active' && busy) {
    return <Spinner size="small" />;
  }
  const isActive = status === 'active';
  return (
    <Stack
      w="$6"
      h="$6"
      borderRadius="$full"
      borderWidth={1}
      borderColor={isActive ? '$borderActive' : '$borderSubdued'}
      ai="center"
      jc="center"
    >
      <SizableText
        size={isActive ? '$bodySmMedium' : '$bodySm'}
        color={isActive ? '$text' : '$textSubdued'}
      >
        {stepNumber}
      </SizableText>
    </Stack>
  );
}

function StepRow({
  step,
  stepNumber,
  status,
  isBusy,
  usdtResetHint,
  waitingSwitchUnlock,
  confirming,
  shortfallText,
  walletBalance,
  categoryLabel,
  approveSubStatus,
  funding,
  getFundsActionItems,
  onGetFundsPress,
}: {
  step: IEModeStep;
  stepNumber: number;
  status: ICompactStepStatus;
  isBusy: boolean;
  usdtResetHint: boolean;
  waitingSwitchUnlock: boolean;
  confirming: boolean;
  shortfallText?: string;
  walletBalance?: string; // display-trimmed, e.g. "5.234567"
  categoryLabel: string;
  approveSubStatus: IEModeApproveSubStatus;
  funding: boolean;
  getFundsActionItems: (step: IEModeStep) => IActionListItemProps[] | undefined;
  onGetFundsPress: () => void;
}) {
  const intl = useIntl();

  let title: string;
  if (step.kind === 'switch') {
    title = intl.formatMessage(
      { id: ETranslations.defi_emode_switch_to__action },
      { category: categoryLabel },
    );
  } else if (step.kind === 'repay') {
    title = intl.formatMessage(
      { id: ETranslations.defi_emode_repay_symbol },
      { symbol: step.symbol ?? '' },
    );
  } else {
    title = intl.formatMessage(
      { id: ETranslations.defi_emode_disable_collateral },
      { symbol: step.symbol ?? '' },
    );
  }

  const withSymbol = (amount: string) =>
    `${amount} ${step.symbol ?? ''}`.trim();
  const amountText = step.amount?.text ? withSymbol(step.amount.text) : null;
  const fiatText = step.amountFiat?.text || null;
  const isActionable = status === 'active' || status === 'failed';
  const isMuted = status === 'done' || status === 'upcoming';
  const presentationApproveSubStatus = normalizeApproveSubStatusForConfirmation(
    {
      approveSubStatus,
      confirming,
    },
  );
  const underfunded =
    status === 'active' && step.kind === 'repay' && !!shortfallText;
  const primaryLineKind = getPrimaryLineKind({
    active: status === 'active',
    approveSubStatus: presentationApproveSubStatus,
    confirming,
    waitingSwitchUnlock,
    kind: step.kind,
    hasWalletBalance: walletBalance !== undefined,
    hasShortfall: underfunded,
  });
  const auxiliaryLineKind = getAuxiliaryLineKind({
    status,
    kind: step.kind,
    usdtResetHint,
  });

  let primaryLine: string | null = null;
  if (primaryLineKind === 'approving') {
    primaryLine = intl.formatMessage({ id: ETranslations.swap_btn_approving });
  } else if (primaryLineKind === 'repaying') {
    primaryLine = intl.formatMessage({
      id: ETranslations.defi_emode_repaying,
    });
  } else if (primaryLineKind === 'preparing') {
    primaryLine = intl.formatMessage({ id: ETranslations.global_preparing });
  } else if (
    primaryLineKind === 'confirmation' ||
    primaryLineKind === 'waitingSwitchUnlock'
  ) {
    primaryLine = intl.formatMessage({
      id: ETranslations.defi_emode_waiting_confirmation__desc,
    });
  } else if (primaryLineKind === 'walletBalance' && walletBalance) {
    primaryLine = intl.formatMessage(
      { id: ETranslations.defi_emode_wallet_balance },
      { balance: withSymbol(walletBalance) },
    );
  }

  let auxiliaryLine: string | null = null;
  if (auxiliaryLineKind === 'lowersHealthFactor') {
    auxiliaryLine = intl.formatMessage({
      id: ETranslations.defi_emode_lowers_health_factor__desc,
    });
  } else if (auxiliaryLineKind === 'usdtReset') {
    auxiliaryLine = intl.formatMessage({
      id: ETranslations.defi_emode_usdt_reset_two_sigs__desc,
    });
  }

  const balanceText =
    underfunded && walletBalance
      ? intl.formatMessage(
          { id: ETranslations.defi_emode_wallet_balance_short },
          {
            balance: withSymbol(walletBalance),
            short: withSymbol(shortfallText ?? ''),
          },
        )
      : '';

  return (
    <XStack gap="$3" p="$3.5" ai="flex-start">
      <YStack w="$6" h="$6" ai="center" jc="center">
        <StepIndicator status={status} stepNumber={stepNumber} busy={isBusy} />
      </YStack>
      {/* Keep the shortfall card outside the text column so it does not compete
          with the amount for room. */}
      <YStack gap="$3" flex={1}>
        <XStack gap="$2" ai="flex-start">
          {step.kind !== 'switch' ? (
            <Token size="sm" tokenImageUri={step.logoURI} />
          ) : (
            <Icon
              testID={BorrowTestIDs.eModeNeedActionSwitchIcon}
              name="FlashOutline"
              size="$6"
              color={isMuted ? '$iconSubdued' : '$icon'}
            />
          )}
          <YStack gap="$1" flex={1}>
            <SizableText
              size={isActionable ? '$bodyLgMedium' : '$bodyLg'}
              color={isMuted ? '$textSubdued' : '$text'}
            >
              {title}
            </SizableText>
            {primaryLine ? (
              <SizableText size="$bodyMd" color="$textSubdued">
                {primaryLine}
              </SizableText>
            ) : null}
            {auxiliaryLine ? (
              <SizableText size="$bodyMd" color="$textSubdued">
                {auxiliaryLine}
              </SizableText>
            ) : null}
          </YStack>
          {amountText ? (
            <YStack ai="flex-end">
              <EarnAmountText
                size="$bodyMdMedium"
                color={isMuted ? '$textSubdued' : '$text'}
              >
                {amountText}
              </EarnAmountText>
              {fiatText && status !== 'done' ? (
                <SizableText size="$bodySm" color="$textSubdued">
                  {fiatText}
                </SizableText>
              ) : null}
            </YStack>
          ) : null}
        </XStack>
        {underfunded ? (
          // Align the card's text with the title text, not its border. The
          // title column starts $8 in ($6 token slot + $2 gap), so the card
          // hangs back by exactly its own $3 padding and its headline lands on
          // the same left edge as the step title.
          <Stack ml="$5">
            <EModeShortfallCard
              symbol={step.symbol ?? ''}
              balanceText={balanceText}
              funding={funding}
              items={getFundsActionItems(step)}
              onGetFundsPress={onGetFundsPress}
            />
          </Stack>
        ) : null}
      </YStack>
    </XStack>
  );
}

function BorrowEModeNeedActionView() {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.BorrowEModeNeedAction
  >();
  const {
    accountId: routeAccountId,
    indexedAccountId,
    networkId,
    provider,
    marketAddress,
    targetEModeId,
    categoryLabel,
  } = route.params;
  const intl = useIntl();
  const navigation = useAppNavigation();
  const isFocused = useRouteIsFocused();
  const { earnAccount } = useEarnAccount({
    networkId,
    accountId: routeAccountId,
    indexedAccountId,
  });
  const accountId = earnAccount?.account?.id || routeAccountId || '';

  const {
    steps,
    stepIndex,
    activeStep,
    isBusy,
    settlingStepKey,
    approveSubStatus,
    shouldApprove,
    shortfallByKey,
    balanceByKey,
    activeShortfall,
    checkingActiveBalance,
    failedKey,
    submittedKey,
    run,
    disarm,
    refreshFundingBalances,
    check,
    isChecking,
    hasCheckedOnce,
    refresh,
  } = useEModeNeedActionFlow({
    networkId,
    accountId,
    provider,
    marketAddress,
    targetEModeId,
    onAllDone: () => navigation.popStack(),
  });

  // Anti-flicker: runCheck sets check=null on every recheck. Keep the last
  // result available for fallback reasons and the Get-funds token lookup;
  // submit + auto-chain still key off the live `check`.
  const lastCheckRef = useRef(check);
  if (check) {
    lastCheckRef.current = check;
  }
  const displayCheck = check ?? lastCheckRef.current;
  const blockerDataUnavailable = isEModeBlockerDataUnavailable(displayCheck);

  // Routed escape-hatch path: a Repay/Withdraw modal returns here on focus, and
  // a confirmed routed tx drops out of the pending list — both re-check so the
  // resolved blocker advances the stepper.
  const pendingTagMatcher = useCallback(
    (tag: string) =>
      isEModeBorrowActionTag({
        tag,
        provider,
        actions: E_MODE_PENDING_GUARD_ACTIONS,
      }),
    [provider],
  );
  const {
    pendingCount,
    isLoading: pendingHistoryLoading,
    isPendingHistoryVerified,
    refreshPending,
  } = useStakingPendingTxsByInfo({
    networkIds: [networkId],
    accountId,
    indexedAccountId,
    tagMatcher: pendingTagMatcher,
    onRefresh: refresh,
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
        await Promise.all([refreshPending(), refresh()]);
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
  }, [isFocused, accountId, refresh, refreshPending]);

  // Recovery loop for the Get-funds detour: while the active repay step is
  // underfunded, refetch its funding balance so the shortfall warning (and the
  // disabled footer) clear on their own once the top-up lands and the indexer
  // catches up — without forcing the user to leave and re-enter the screen.
  useEffect(() => {
    if (!isFocused || !activeShortfall || isBusy) {
      return;
    }
    const timer = setInterval(
      refreshFundingBalances,
      FUNDING_BALANCE_POLL_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [isFocused, activeShortfall, isBusy, refreshFundingBalances]);

  // Fast path for the same detour: the moment a swap into this network
  // confirms, refetch the funding balance — even while the Swap modal still
  // covers this screen — so the user returns to an already-updated row.
  useEffect(() => {
    const onSwapHistoryUpdate = (
      payload: IAppEventBusPayload[EAppEventBusNames.SwapTxHistoryStatusUpdate],
    ) => {
      const deliversFunds =
        payload.status === ESwapTxHistoryStatus.SUCCESS ||
        payload.status === ESwapTxHistoryStatus.PARTIALLY_FILLED;
      if (deliversFunds && payload.toToken?.networkId === networkId) {
        refreshFundingBalances();
      }
    };
    appEventBus.on(
      EAppEventBusNames.SwapTxHistoryStatusUpdate,
      onSwapHistoryUpdate,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.SwapTxHistoryStatusUpdate,
        onSwapHistoryUpdate,
      );
    };
  }, [networkId, refreshFundingBalances]);

  const pendingGuardActive = isEModePendingGuardActive({
    pendingHistoryLoading,
    isPendingHistoryVerified,
    pendingCount,
    focusRevalidating: focusRevalidating || focusActivationPending,
  });

  const shouldApproveActiveRepay =
    activeStep?.kind === 'repay' && shouldApprove;
  const activeRepayNeedsUsdtReset =
    shouldApproveActiveRepay &&
    earnUtils.isUSDTonETHNetwork({
      networkId,
      symbol: activeStep?.symbol ?? '',
    });
  const waitingForSwitchUnlock =
    activeStep?.kind === 'switch' &&
    hasCheckedOnce &&
    !!displayCheck &&
    !blockerDataUnavailable &&
    !displayCheck.canSwitch;

  const activeUnderfundedRepay =
    activeStep?.kind === 'repay' && activeShortfall ? activeStep : null;

  const { fundingTxKey, funding, armFunding, disarmFunding } =
    useEModeFundingTx({
      networkId,
      accountId,
      activeStepKey: activeStep?.key,
      activeFundingAddress: activeStep
        ? balanceLookupAddress({ step: activeStep })
        : null,
    });

  // Swap is armed immediately before its modal opens. If that detour returns
  // without producing a matching pending transaction, it was cancelled; clear
  // the intent so a later same-token swap cannot pull the user back here.
  useEffect(() => {
    if (
      shouldDisarmFundingIntentOnFocus({
        isFocused,
        previousIsFocused,
        fundingTxKey,
      })
    ) {
      disarmFunding();
    }
  }, [disarmFunding, fundingTxKey, isFocused, previousIsFocused]);

  // Once the funded step clears, the intent has finished serving its purpose.
  useEffect(() => {
    if (isFocused && !activeShortfall) {
      disarmFunding();
    }
  }, [isFocused, activeShortfall, disarmFunding]);

  const handleGetFundsPress = useCallback(() => {
    // User-initiated divergence, same rule as Manage positions: never let a
    // focus recheck on return auto-pop a signature sheet.
    disarm();
    // Opening or dismissing the menu is not a funding intent. It also cancels
    // any stale Swap detour before the user chooses the next action.
    disarmFunding();
  }, [disarm, disarmFunding]);

  const getFundsActionItems = useCallback(
    (step: IEModeStep): IActionListItemProps[] | undefined => {
      if (step.kind !== 'repay' || step.reserveAddress === undefined) {
        return undefined;
      }
      const asset =
        displayCheck?.repayAssets?.find(
          (a) => a.reserveAddress === step.reserveAddress,
        ) ??
        displayCheck?.additionalRepayAssets?.find(
          (a) => a.reserveAddress === step.reserveAddress,
        );
      const token = buildBorrowTokenFromAsset({ asset, networkId });
      if (!token) {
        return undefined;
      }

      return [
        {
          label: intl.formatMessage({ id: ETranslations.global_swap }),
          icon: 'SwitchHorOutline',
          onPress: () => {
            armFunding();
            const importToToken: ISwapToken = {
              contractAddress: token.address,
              symbol: token.symbol,
              networkId,
              isNative: !!token.isNative,
              decimals: token.decimals,
              name: token.name,
              logoURI: token.logoURI,
            };
            navigation.pushModal(EModalRoutes.SwapModal, {
              screen: EModalSwapRoutes.SwapMainLand,
              params: {
                importNetworkId: networkId,
                importToToken,
                swapTabSwitchType: ESwapTabSwitchType.SWAP,
                swapSource: ESwapSource.EARN,
                closeModalAfterSwapBroadcast: true,
              },
            });
          },
        },
        {
          label: intl.formatMessage({ id: ETranslations.global_receive }),
          icon: 'ArrowBottomOutline',
          onPress: () => {
            navigation.pushModal(EModalRoutes.ReceiveModal, {
              screen: EModalReceiveRoutes.ReceiveToken,
              params: {
                networkId,
                accountId,
                walletId: accountUtils.getWalletIdFromAccountId({
                  accountId,
                }),
                token,
                disableSelector: true,
              },
            });
          },
        },
      ];
    },
    [accountId, armFunding, displayCheck, intl, navigation, networkId],
  );

  let activeActionLabel = '';
  if (activeStep?.kind === 'switch') {
    activeActionLabel = intl.formatMessage(
      { id: ETranslations.defi_emode_switch_to__action },
      { category: categoryLabel },
    );
  } else if (activeStep?.kind === 'repay') {
    activeActionLabel = shouldApprove
      ? intl.formatMessage({ id: ETranslations.global_approve })
      : intl.formatMessage(
          { id: ETranslations.defi_emode_repay_symbol },
          { symbol: activeStep.symbol ?? '' },
        );
  } else if (activeStep?.kind === 'removeCollateral') {
    activeActionLabel = intl.formatMessage(
      { id: ETranslations.defi_emode_disable_collateral },
      { symbol: activeStep.symbol ?? '' },
    );
  }

  // Retry only for the step that actually failed; once a recheck advances past
  // it, a stale failedKey must not relabel the next step's button (matches the
  // checklist failure indicator, which also requires the active step's key).
  // Underfunded keeps the footer on its Repay/Approve label but disabled (fork
  // B): "Get {symbol}" lives inline on the step, not on the footer.
  let confirmText = activeActionLabel;
  if (failedKey && failedKey === activeStep?.key) {
    confirmText = intl.formatMessage({ id: ETranslations.global_retry });
  }
  const canRetryCheck =
    isFocused &&
    !focusRevalidating &&
    !isChecking &&
    (!check || blockerDataUnavailable);
  // A retry only rechecks the exact submitted tx and switch state; it never
  // broadcasts. Keep that recovery path available even while serialized
  // history still reports the original transaction as pending.
  const pendingGuardBlocksAction = pendingGuardActive && !canRetryCheck;

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.defi_emode_need_action_title,
        })}
      />
      <Page.Body px="$5" gap="$4">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage(
            { id: ETranslations.defi_emode_need_action_subtitle },
            { category: categoryLabel },
          )}{' '}
          {intl.formatMessage({
            id: ETranslations.defi_emode_confirm_each_step__desc,
          })}
        </SizableText>

        {blockerDataUnavailable ? (
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
              primaryTestID: 'borrow-e-mode-blocker-retry',
              onPrimaryPress: () => void refresh(),
            }}
          />
        ) : null}
        {!blockerDataUnavailable && !hasCheckedOnce && isChecking ? (
          <YStack gap="$3">
            <Skeleton h="$16" w="100%" borderRadius="$3" />
            <Skeleton h="$16" w="100%" borderRadius="$3" />
          </YStack>
        ) : null}
        {!blockerDataUnavailable && (hasCheckedOnce || !isChecking) ? (
          <YStack
            borderWidth={1}
            borderColor="$borderSubdued"
            borderRadius="$3"
            overflow="hidden"
          >
            {steps.map((step, index) => {
              const status = getCompactStepStatus({
                index,
                stepIndex,
                failedKey,
                stepKey: step.key,
              });
              return (
                <YStack key={step.key}>
                  <StepRow
                    step={step}
                    stepNumber={index + 1}
                    status={status}
                    isBusy={Boolean(isBusy && status === 'active')}
                    usdtResetHint={activeRepayNeedsUsdtReset}
                    waitingSwitchUnlock={waitingForSwitchUnlock}
                    confirming={isStepConfirming({
                      submittedKey,
                      stepKey: step.key,
                      stepKind: step.kind,
                      settlingStepKey,
                    })}
                    shortfallText={shortfallByKey[step.key]}
                    walletBalance={
                      formatBalanceDisplay(balanceByKey[step.key]) ?? undefined
                    }
                    categoryLabel={categoryLabel}
                    approveSubStatus={approveSubStatus}
                    funding={funding}
                    getFundsActionItems={getFundsActionItems}
                    onGetFundsPress={handleGetFundsPress}
                  />
                  {index < steps.length - 1 ? <Divider /> : null}
                </YStack>
              );
            })}
          </YStack>
        ) : null}

        {/* Server prose is a fallback for checks with no structured blocker
            rows; with rows on screen it only restates them. `steps` always
            holds at least the terminal switch step. */}
        {steps.length <= 1 && displayCheck?.reasons?.length ? (
          <YStack gap="$2">
            {displayCheck.reasons.map((reason) => (
              <XStack key={reason} gap="$2" ai="flex-start">
                <Icon
                  name="InfoCircleOutline"
                  size="$4"
                  color="$iconSubdued"
                  mt="$0.5"
                />
                <SizableText size="$bodySm" color="$textSubdued" flex={1}>
                  {reason}
                </SizableText>
              </XStack>
            ))}
          </YStack>
        ) : null}
      </Page.Body>
      <Page.Footer
        onConfirmText={
          canRetryCheck
            ? intl.formatMessage({ id: ETranslations.global_retry })
            : confirmText
        }
        confirmButtonProps={{
          testID: BorrowTestIDs.eModeNeedActionConfirmBtn,
          loading: isBusy || pendingGuardBlocksAction || isChecking,
          disabled:
            isBusy ||
            pendingGuardBlocksAction ||
            (!canRetryCheck &&
              (!check ||
                checkingActiveBalance ||
                !!activeUnderfundedRepay ||
                (activeStep?.kind === 'switch' && !check.canSwitch))),
        }}
        onConfirm={canRetryCheck ? refresh : run}
      />
    </Page>
  );
}

function BorrowEModeNeedAction() {
  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home, sceneUrl: '' }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <DiscoveryBrowserProviderMirror>
          <BorrowEModeNeedActionView />
        </DiscoveryBrowserProviderMirror>
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default BorrowEModeNeedAction;
