import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
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
} from '@onekeyhq/shared/types/swap/types';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { EarnProviderMirror } from '../../../Earn/EarnProviderMirror';
import { useEarnAccount } from '../../../Staking/hooks/useEarnAccount';
import {
  isEModeBorrowActionTag,
  isEModeFocusActivationPending,
  isEModePendingGuardActive,
} from '../BorrowEModeSwitch/emodeUtils';

import { formatBalanceDisplay } from './needActionBalances';
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
  type IEModeApproveSubStatus,
  useEModeNeedActionFlow,
} from './useEModeNeedActionFlow';

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
  onGetFunds,
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
  onGetFunds: (step: IEModeStep) => void;
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

  const amountText = step.amount?.text
    ? `${step.amount.text} ${step.symbol ?? ''}`.trim()
    : null;
  const fiatText = step.amountFiat?.text || null;
  const isActionable = status === 'active' || status === 'failed';
  const isMuted = status === 'done' || status === 'upcoming';
  const presentationApproveSubStatus = normalizeApproveSubStatusForConfirmation(
    {
      approveSubStatus,
      confirming,
    },
  );
  const primaryLineKind = getPrimaryLineKind({
    active: status === 'active',
    approveSubStatus: presentationApproveSubStatus,
    confirming,
    waitingSwitchUnlock,
    kind: step.kind,
    hasWalletBalance: walletBalance !== undefined,
  });
  const auxiliaryLineKind = getAuxiliaryLineKind({
    status,
    kind: step.kind,
    usdtResetHint,
  });

  let primaryLine: string | null = null;
  let primaryLineIsCaution = false;
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
    const balanceLabel = `${walletBalance} ${step.symbol ?? ''}`.trim();
    if (shortfallText) {
      primaryLine = intl.formatMessage(
        { id: ETranslations.defi_emode_wallet_balance_short },
        {
          balance: balanceLabel,
          short: `${shortfallText} ${step.symbol ?? ''}`.trim(),
        },
      );
      primaryLineIsCaution = true;
    } else {
      primaryLine = intl.formatMessage(
        { id: ETranslations.defi_emode_wallet_balance },
        { balance: balanceLabel },
      );
    }
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

  const underfunded =
    status === 'active' && step.kind === 'repay' && !!shortfallText;

  return (
    <XStack gap="$3" p="$3.5" ai="flex-start">
      <YStack w="$6" h="$6" ai="center" jc="center">
        <StepIndicator status={status} stepNumber={stepNumber} busy={isBusy} />
      </YStack>
      <XStack gap="$2" flex={1} ai="flex-start">
        {step.kind !== 'switch' ? (
          <Token size="sm" tokenImageUri={step.logoURI} />
        ) : (
          <Stack w="$6" h="$6" />
        )}
        <YStack gap="$1" flex={1}>
          <SizableText
            size={isActionable ? '$bodyLgMedium' : '$bodyLg'}
            color={isMuted ? '$textSubdued' : '$text'}
          >
            {title}
          </SizableText>
          {primaryLine ? (
            <SizableText
              size="$bodyMd"
              color={primaryLineIsCaution ? '$textCaution' : '$textSubdued'}
            >
              {primaryLine}
            </SizableText>
          ) : null}
          {auxiliaryLine ? (
            <SizableText size="$bodyMd" color="$textSubdued">
              {auxiliaryLine}
            </SizableText>
          ) : null}
          {underfunded ? (
            <XStack
              alignSelf="flex-start"
              ai="center"
              cursor="pointer"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => onGetFunds(step)}
              hoverStyle={{ opacity: 0.8 }}
              pressStyle={{ opacity: 0.6 }}
            >
              <SizableText size="$bodyMdMedium" color="$textInfo">
                {intl.formatMessage(
                  { id: ETranslations.defi_emode_get_symbol__action },
                  { symbol: step.symbol ?? '' },
                )}
              </SizableText>
            </XStack>
          ) : null}
        </YStack>
        {amountText ? (
          <YStack ai="flex-end">
            <SizableText
              size="$bodyMdMedium"
              color={isMuted ? '$textSubdued' : '$text'}
            >
              {amountText}
            </SizableText>
            {fiatText && status !== 'done' ? (
              <SizableText size="$bodySm" color="$textSubdued">
                {fiatText}
              </SizableText>
            ) : null}
          </YStack>
        ) : null}
      </XStack>
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

  // Routed escape-hatch path: a Repay/Withdraw modal returns here on focus, and
  // a confirmed routed tx drops out of the pending list — both re-check so the
  // resolved blocker advances the stepper.
  const pendingTagMatcher = useCallback(
    (tag: string) =>
      isEModeBorrowActionTag({
        tag,
        provider,
        actions: ['repay', 'setCollateral', 'setEMode'],
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

  const pendingGuardActive = isEModePendingGuardActive({
    pendingHistoryLoading,
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
    !displayCheck.canSwitch;

  const activeUnderfundedRepay =
    activeStep?.kind === 'repay' && activeShortfall ? activeStep : null;

  const onGetFunds = useCallback(
    (step: IEModeStep) => {
      if (step.kind !== 'repay' || step.reserveAddress === undefined) {
        return;
      }
      // User-initiated divergence, same rule as Manage positions: never let a
      // focus recheck on return auto-pop a signature sheet.
      disarm();
      const asset =
        displayCheck?.repayAssets?.find(
          (a) => a.reserveAddress === step.reserveAddress,
        ) ??
        displayCheck?.additionalRepayAssets?.find(
          (a) => a.reserveAddress === step.reserveAddress,
        );
      const token = buildBorrowTokenFromAsset({ asset, networkId });
      if (!token) {
        return;
      }
      ActionList.show({
        title: intl.formatMessage(
          { id: ETranslations.defi_emode_get_symbol__action },
          { symbol: step.symbol ?? '' },
        ),
        items: [
          {
            label: intl.formatMessage({ id: ETranslations.global_swap }),
            icon: 'SwitchHorOutline',
            onPress: () => {
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
        ],
      });
    },
    [disarm, displayCheck, intl, navigation, networkId, accountId],
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

        {!hasCheckedOnce && isChecking ? (
          <YStack gap="$3">
            <Skeleton h="$16" w="100%" borderRadius="$3" />
            <Skeleton h="$16" w="100%" borderRadius="$3" />
          </YStack>
        ) : (
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
                    onGetFunds={onGetFunds}
                  />
                  {index < steps.length - 1 ? <Divider /> : null}
                </YStack>
              );
            })}
          </YStack>
        )}

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
        onConfirmText={confirmText}
        confirmButtonProps={{
          testID: BorrowTestIDs.eModeNeedActionConfirmBtn,
          loading: isBusy || pendingGuardActive,
          disabled:
            isBusy ||
            pendingGuardActive ||
            !check ||
            checkingActiveBalance ||
            !!activeUnderfundedRepay ||
            (activeStep?.kind === 'switch' && !check.canSwitch),
        }}
        onConfirm={run}
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
