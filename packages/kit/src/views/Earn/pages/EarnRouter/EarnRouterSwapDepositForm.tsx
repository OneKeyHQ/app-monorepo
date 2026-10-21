import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
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

import {
  EStakeProgressStep,
  StakeProgress,
} from '../../../Staking/components/StakeProgress';
import {
  StakingAmountInput,
  useOnBlurAmountValue,
} from '../../../Staking/components/StakingAmountInput';
import StakingFormWrapper from '../../../Staking/components/StakingFormWrapper';
import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';

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
// Centers the arrow on the seam between the two boxes, as the Pendle form
// does
const ARROW_OVERLAY_STYLE = platformEnv.isNative
  ? { transform: [{ translateX: -13 }, { translateY: -13 }] as const }
  : { transform: 'translate(-50%, -50%)' as const };

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
  // A year at the provider's rate, in the token deposited and in money
  const rewards = useMemo(() => {
    if (!depositAmount || !apr || apr <= 0) {
      return undefined;
    }
    const tokens = new BigNumber(depositAmount).times(apr).div(100);
    return {
      amount: tokens.toFixed(),
      fiat: toFiat(tokens.times(depositToken.priceUsd).toFixed()),
    };
  }, [apr, depositAmount, depositToken.priceUsd, toFiat]);

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
      {protocolSwitch}
      {/* The deposit form's summary card: the year's rewards once there is
          an amount, then the provider */}
      <YStack
        p="$3.5"
        pt={rewards ? '$5' : '$3.5'}
        borderRadius="$3"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
      >
        <HeightTransition>
          {rewards ? (
            <>
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
              <Divider my="$5" />
            </>
          ) : null}
        </HeightTransition>
        <XStack gap="$1.5" ai="center">
          <Image width="$5" height="$5" src={offerLogo} borderRadius="$2" />
          <SizableText size="$bodyMd">{offerName}</SizableText>
        </XStack>
      </YStack>
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
