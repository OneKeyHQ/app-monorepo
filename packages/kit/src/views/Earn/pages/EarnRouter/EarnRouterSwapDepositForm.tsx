import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Alert,
  Divider,
  HeightTransition,
  IconButton,
  Image,
  Page,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
  useDeepCompareEffect,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { PercentageStageOnKeyboard } from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { ECheckAmountActionType } from '@onekeyhq/shared/types/staking';
import type {
  IBorrowTransactionConfirmation,
  IStakeTransactionConfirmation,
} from '@onekeyhq/shared/types/staking';

import { BorrowInfoCard } from '../../../Borrow/components/ManagePosition/modules/InfoDisplaySection';
import {
  EStakeProgressStep,
  StakeProgress,
} from '../../../Staking/components/StakeProgress';
import {
  StakingAmountInput,
  useOnBlurAmountValue,
} from '../../../Staking/components/StakingAmountInput';
import StakingFormWrapper from '../../../Staking/components/StakingFormWrapper';
import {
  StakingApyHeader,
  StakingRewardsSummary,
  hasStakingRewardsSummary,
} from '../../../Staking/components/UniversalStake/StakingConfirmationSummary';
import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';

import {
  EARN_ROUTER_FLOW_IDLE,
  earnRouterFlowReducer,
  estimateDepositAmount,
} from './earnRouter.utils';

import type {
  IEarnRouterFlowState,
  IEarnRouterPayToken,
} from './earnRouter.utils';

// How long the simulation waits on the "wallet" and then on the "chain", per
// transaction, and how long the finished path stays on screen
const CONFIRM_MS = 1200;
const SETTLE_MS = 2200;
const DONE_MS = 1600;
// The deposit amount shows at most this many decimals, rounded down
const DEPOSIT_DECIMALS = 6;
// As the deposit forms wait before asking for their card again
const SUMMARY_DEBOUNCE_MS = 350;
// Centers the arrow on the seam between the two boxes, as the Pendle form
// does
const ARROW_OVERLAY_STYLE = platformEnv.isNative
  ? { transform: [{ translateX: -13 }, { translateY: -13 }] as const }
  : { transform: 'translate(-50%, -50%)' as const };

/**
 * What the provider's own deposit form asks the server for its card: a
 * staking provider's summary, or a lending market's info. Pendle's form
 * reads its card off a swap quote, so it has none here
 */
export type IEarnRouterSummaryRequest =
  | {
      kind: 'staking';
      provider: string;
      symbol: string;
      vault: string;
      accountAddress: string;
      inputTokenAddress?: string;
      outputTokenAddress?: string;
    }
  | {
      kind: 'lending';
      provider: string;
      marketAddress: string;
      reserveAddress: string;
      accountId: string;
    };

type IDepositSummary = {
  staking?: IStakeTransactionConfirmation;
  lending?: IBorrowTransactionConfirmation;
  lendingLoading: boolean;
};

const NO_SUMMARY: IDepositSummary = { lendingLoading: false };

// The provider form's card for what reaches the provider, asked the way that
// form asks: a staking summary once there is an amount, kept while the next
// one loads; a lending card for any amount, its skeleton while each loads
function useDepositSummary({
  networkId,
  request,
  amount,
  isDisabled,
}: {
  networkId: string;
  request?: IEarnRouterSummaryRequest;
  amount: string;
  isDisabled?: boolean;
}) {
  const [summary, setSummary] = useState<IDepositSummary>(NO_SUMMARY);
  useDeepCompareEffect(() => {
    if (!request || isDisabled) {
      setSummary(NO_SUMMARY);
      return;
    }
    const hasAmount = new BigNumber(amount).gt(0);
    if (request.kind === 'staking' && !hasAmount) {
      setSummary(NO_SUMMARY);
      return;
    }
    if (request.kind === 'lending') {
      setSummary({ lendingLoading: true });
    }
    let isCurrent = true;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (request.kind === 'lending') {
            const lending =
              await backgroundApiProxy.serviceStaking.getBorrowTransactionConfirmation(
                {
                  networkId,
                  provider: request.provider,
                  marketAddress: request.marketAddress,
                  reserveAddress: request.reserveAddress,
                  accountId: request.accountId,
                  action: 'supply',
                  amount: hasAmount ? amount : '0',
                },
              );
            if (isCurrent) {
              setSummary({ lending, lendingLoading: false });
            }
            return;
          }
          const staking =
            await backgroundApiProxy.serviceStaking.getTransactionConfirmation({
              networkId,
              provider: request.provider,
              symbol: request.symbol,
              vault: request.vault,
              accountAddress: request.accountAddress,
              action: ECheckAmountActionType.STAKING,
              amount,
              inputTokenAddress: request.inputTokenAddress,
              outputTokenAddress: request.outputTokenAddress,
            });
          if (isCurrent) {
            setSummary({ staking, lendingLoading: false });
          }
        } catch {
          // A staking form keeps its last summary; a lending form drops its
          // card
          if (isCurrent && request.kind === 'lending') {
            setSummary(NO_SUMMARY);
          }
        }
      })();
    }, SUMMARY_DEBOUNCE_MS);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [networkId, request, amount, isDisabled]);
  return summary;
}

// Where the path is, in the deposit form's own two-step indicator
function getProgressStep(flow: IEarnRouterFlowState) {
  switch (flow.status) {
    case 'done':
      return EStakeProgressStep.unstake;
    case 'swapped':
      return EStakeProgressStep.deposit;
    case 'running':
      return flow.step === 'swap'
        ? EStakeProgressStep.approve
        : EStakeProgressStep.deposit;
    default:
      return EStakeProgressStep.approve;
  }
}

// Paying with a token the provider doesn't take, with no one-transaction
// route for it: swap, then deposit. It is the deposit form with a second box
// for what reaches the provider, the way the Pendle form shows a swap, and
// one press runs both transactions. This demo simulates them and sends
// nothing
export function EarnRouterSwapDepositForm({
  networkId,
  actionLabel,
  isDisabled,
  offerName,
  offerLogo,
  apr,
  payToken,
  depositToken,
  onOpenPayWith,
  onDone,
  isInModalContext,
  protocolSwitch,
  summaryRequest,
  showApyDetail,
}: {
  networkId: string;
  /** What the deposit form calls the action: Deposit, or Supply */
  actionLabel: string;
  /** The provider takes no deposits now (paused, capped) */
  isDisabled?: boolean;
  offerName: string;
  offerLogo?: string;
  /** The provider's rate, in percent, when known */
  apr?: number;
  payToken: IEarnRouterPayToken;
  depositToken: { symbol: string; logoURI?: string; priceUsd: string };
  onOpenPayWith: () => void;
  /** Once the deposit is in; the form starts over either way */
  onDone?: () => void;
  // In a modal the action goes in the page footer, as the deposit form's does
  isInModalContext?: boolean;
  // The deposit form's protocol switcher, where that form has one
  protocolSwitch?: ReactNode;
  /**
   * Asked for the provider form's own card, for what reaches the provider.
   * Without it the card estimates the year at the provider's rate
   */
  summaryRequest?: IEarnRouterSummaryRequest;
  /** The form shows the rate atop its summary card (a modal) */
  showApyDetail?: boolean;
}) {
  const intl = useIntl();
  const [{ currencyInfo }] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const { result: network } = usePromiseResult(
    () => backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
    [networkId],
  );
  const [amount, setAmount] = useState('');
  const onBlurAmount = useOnBlurAmountValue(amount, setAmount);
  const [flow, dispatch] = useReducer(
    earnRouterFlowReducer,
    EARN_ROUTER_FLOW_IDLE,
  );

  // USD to the currency the app shows
  const toFiat = useCallback(
    (valueUsd: string) =>
      convertFiat({
        value: valueUsd,
        sourceCurrency: USD_CURRENCY_ID,
        targetCurrency: currencyInfo.id,
        currencyMap,
      }),
    [currencyInfo.id, currencyMap],
  );

  const amountValue = new BigNumber(amount);
  const hasAmount = amountValue.isFinite() && amountValue.gt(0);
  const isInsufficient = hasAmount && amountValue.gt(payToken.amount);
  const depositAmount = useMemo(() => {
    const estimate = new BigNumber(
      estimateDepositAmount({
        payAmount: amount,
        payPrice: payToken.priceUsd,
        depositPrice: depositToken.priceUsd,
      }),
    ).decimalPlaces(DEPOSIT_DECIMALS, BigNumber.ROUND_DOWN);
    return estimate.gt(0) ? estimate.toFixed() : '';
  }, [amount, depositToken.priceUsd, payToken.priceUsd]);
  const payFiat = hasAmount
    ? toFiat(amountValue.times(payToken.priceUsd).toFixed())
    : '';
  const depositFiat = depositAmount
    ? toFiat(
        new BigNumber(depositAmount).times(depositToken.priceUsd).toFixed(),
      )
    : '';
  const depositSummary = useDepositSummary({
    networkId,
    request: summaryRequest,
    amount: depositAmount,
    isDisabled,
  });

  // With no card to ask for: a year at the provider's rate, in the token
  // deposited and in money
  const rewards = useMemo(() => {
    if (summaryRequest || !depositAmount || !apr || apr <= 0) {
      return undefined;
    }
    const tokens = new BigNumber(depositAmount).times(apr).div(100);
    return {
      amount: tokens.toFixed(),
      fiat: toFiat(tokens.times(depositToken.priceUsd).toFixed()),
    };
  }, [apr, depositAmount, depositToken.priceUsd, summaryRequest, toFiat]);

  // Each transaction waits on the wallet, then on the chain; the deposit asks
  // for its confirmation as soon as the swap settles
  useEffect(() => {
    if (flow.status !== 'running') {
      return;
    }
    const timer = setTimeout(
      () =>
        dispatch({
          type: flow.phase === 'confirm' ? 'confirmed' : 'settled',
        }),
      flow.phase === 'confirm' ? CONFIRM_MS : SETTLE_MS,
    );
    return () => clearTimeout(timer);
  }, [flow]);

  // As a deposit ends: "Transaction submitted", the finished path for a
  // moment, then the form starts over (a modal closes)
  useEffect(() => {
    if (flow.status !== 'done') {
      return;
    }
    Toast.success({
      title: intl.formatMessage({
        id: ETranslations.feedback_transaction_submitted,
      }),
    });
    const timer = setTimeout(() => {
      setAmount('');
      dispatch({ type: 'reset' });
      onDone?.();
    }, DONE_MS);
    return () => clearTimeout(timer);
  }, [flow.status, intl, onDone]);

  const isBusy = flow.status !== 'idle';
  // Nothing to change while the path runs, or while the provider is off
  const isLocked = isBusy || Boolean(isDisabled);
  const canStart =
    !isDisabled && hasAmount && !isInsufficient && Boolean(depositAmount);

  const handleSelectPercentage = useCallback(
    (percent: number) => {
      setAmount(
        new BigNumber(payToken.amount)
          .times(percent)
          .div(100)
          .decimalPlaces(payToken.token.decimals, BigNumber.ROUND_DOWN)
          .toFixed(),
      );
    },
    [payToken.amount, payToken.token.decimals],
  );
  const handleMax = useCallback(() => {
    setAmount(payToken.amount);
  }, [payToken.amount]);
  const handleStart = useCallback(() => dispatch({ type: 'start' }), []);

  // One press runs both, as "Approve and Deposit" does. Once a swap went
  // through without its deposit, the deposit alone is left
  const confirmText =
    flow.status === 'swapped'
      ? actionLabel
      : EARN_DESKTOP_DEMO_COPY.swapAnd(actionLabel);
  const confirmButtonProps = {
    testID: 'earn-router-swap-deposit',
    onPress: handleStart,
    loading: flow.status === 'running',
    disabled: flow.status === 'done' || (flow.status === 'idle' && !canStart),
  };
  const progress =
    hasAmount || isBusy ? (
      <StakeProgress
        currentStep={getProgressStep(flow)}
        step1Label={intl.formatMessage({ id: ETranslations.global_swap })}
        step2Label={actionLabel}
      />
    ) : null;

  const hasSwitch = Boolean(protocolSwitch);
  const stakingSummary = depositSummary.staking;
  const apyDetail =
    showApyDetail && !hasSwitch ? stakingSummary?.apyDetail : undefined;
  let summary: ReactNode = null;
  if (summaryRequest?.kind === 'staking') {
    if (
      hasStakingRewardsSummary({
        transactionConfirmation: stakingSummary,
        infoOnly: hasSwitch,
      })
    ) {
      summary = (
        <StakingRewardsSummary
          transactionConfirmation={stakingSummary}
          infoOnly={hasSwitch}
        />
      );
    }
  } else if (rewards) {
    summary = (
      <YStack gap="$1.5">
        <SizableText size="$bodyMd" color="$textSubdued">
          {EARN_DESKTOP_DEMO_COPY.estAnnualRewards}
        </SizableText>
        <XStack gap="$1" ai="center" flexWrap="wrap">
          <SizableText size="$bodyLgMedium">
            {`${numberFormat(rewards.amount, {
              formatter: 'balance',
            })} ${depositToken.symbol}`}
          </SizableText>
          <SizableText size="$bodyLgMedium" color="$textSubdued">
            {`(${numberFormat(rewards.fiat, {
              formatter: 'value',
              formatterOptions: { currency: currencyInfo.symbol },
            })})`}
          </SizableText>
        </XStack>
      </YStack>
    );
  }

  // As the deposit forms: no card while the provider takes nothing
  let card: ReactNode = null;
  if (!isDisabled && summaryRequest?.kind === 'lending') {
    // The lending form's own card; its swap row is left out, as this form
    // is that swap
    card = (
      <BorrowInfoCard
        action="supply"
        isDisabled={false}
        accountId={summaryRequest.accountId}
        networkId={networkId}
        showApyDetail={Boolean(showApyDetail)}
        transactionConfirmation={depositSummary.lending}
        transactionConfirmationLoading={depositSummary.lendingLoading}
        showSwapOrBridge={false}
      />
    );
  } else if (!isDisabled && (!hasSwitch || apyDetail || summary)) {
    // The staking form's card: the rate in a modal, the year's rewards,
    // then the provider. With a protocol switcher only highlighted rewards
    // stay, and no card when there are none
    card = (
      <YStack
        p="$3.5"
        pt={apyDetail || summary ? '$5' : '$3.5'}
        borderRadius="$3"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
      >
        {apyDetail ? <StakingApyHeader apyDetail={apyDetail} /> : null}
        <HeightTransition>
          {summary ? (
            <>
              {summary}
              {hasSwitch ? null : <Divider my="$5" />}
            </>
          ) : null}
        </HeightTransition>
        {hasSwitch ? null : (
          <XStack gap="$1.5" ai="center">
            <Image width="$5" height="$5" src={offerLogo} borderRadius="$2" />
            <SizableText size="$bodyMd">{offerName}</SizableText>
          </XStack>
        )}
      </YStack>
    );
  }

  return (
    <StakingFormWrapper>
      <Stack position="relative">
        <YStack gap="$2">
          <StakingAmountInput
            title={EARN_DESKTOP_DEMO_COPY.payWith}
            disabled={isLocked}
            hasError={isInsufficient}
            value={amount}
            onChange={setAmount}
            onBlur={onBlurAmount}
            tokenSelectorTriggerProps={{
              selectedTokenImageUri: payToken.token.logoURI,
              selectedTokenSymbol: payToken.token.symbol,
              selectedNetworkImageUri: network?.logoURI,
              disabled: isLocked,
              onPress: onOpenPayWith,
              ...buildKeyboardPressProps(isLocked ? undefined : onOpenPayWith),
            }}
            balanceProps={{
              value: payToken.amount,
              onPress: isLocked ? undefined : handleMax,
            }}
            inputProps={{ placeholder: '0', autoFocus: !isLocked }}
            valueProps={{
              value: payFiat,
              currency: payFiat ? currencyInfo.symbol : undefined,
            }}
            enableMaxAmount
            onSelectPercentageStage={handleSelectPercentage}
          />
          {/* What reaches the provider, as the Pendle form's receive box */}
          <StakingAmountInput
            title={actionLabel}
            disabled
            forceSubduedBackground
            value={depositAmount}
            onChange={() => {}}
            onBlur={() => {}}
            tokenSelectorTriggerProps={{
              selectedTokenImageUri: depositToken.logoURI,
              selectedTokenSymbol: depositToken.symbol,
              selectedNetworkImageUri: network?.logoURI,
              disabled: true,
            }}
            inputProps={{ placeholder: '0' }}
            valueProps={{
              value: depositFiat,
              currency: depositFiat ? currencyInfo.symbol : undefined,
            }}
            onSelectPercentageStage={() => {}}
          />
        </YStack>
        <Stack
          ai="center"
          position="absolute"
          top="50%"
          left="50%"
          zIndex={2}
          pointerEvents="none"
          style={ARROW_OVERLAY_STYLE}
        >
          <IconButton
            testID="earn-router-swap-arrow"
            alignSelf="center"
            bg="$bgApp"
            variant="tertiary"
            icon="ArrowBottomOutline"
            iconProps={{ color: '$icon' }}
            size="small"
            disabled
            opacity={1}
          />
        </Stack>
      </Stack>
      {/* Where the deposit form warns about its amount */}
      {isInsufficient ? (
        <Alert
          icon="InfoCircleOutline"
          type="critical"
          title={intl.formatMessage({
            id: ETranslations.earn_insufficient_balance,
          })}
        />
      ) : null}
      {protocolSwitch}
      {card}
      {isInModalContext ? (
        <Page.Footer>
          <Stack
            bg="$bgApp"
            flexDirection="column"
            $gtMd={{
              flexDirection: 'row',
              alignItems: 'center',
              jc: 'space-between',
            }}
          >
            <Stack pl="$5" $md={{ pt: '$5' }}>
              {progress}
            </Stack>
            <Page.FooterActions
              onConfirmText={confirmText}
              confirmButtonProps={confirmButtonProps}
            />
          </Stack>
          <PercentageStageOnKeyboard
            onSelectPercentageStage={
              isLocked ? undefined : handleSelectPercentage
            }
            reserveSpaceUntilKeyboardShown={!isLocked}
          />
        </Page.Footer>
      ) : (
        <YStack bg="$bgApp" gap="$5">
          {progress}
          <Page.FooterActions
            p={0}
            onConfirmText={confirmText}
            buttonContainerProps={{ $gtMd: { ml: '0' }, w: '100%' }}
            confirmButtonProps={{ ...confirmButtonProps, w: '100%' }}
          />
        </YStack>
      )}
    </StakingFormWrapper>
  );
}
