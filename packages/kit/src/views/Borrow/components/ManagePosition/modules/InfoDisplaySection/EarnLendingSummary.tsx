import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Icon, XStack } from '@onekeyhq/components';
import { EARN_DESKTOP_DEMO_COPY } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopHomeCopy';
import type { ILoanLtvTone } from '@onekeyhq/kit/src/views/Earn/pages/EarnLoanRouter/loanLtvBar.types';
import {
  LOAN_HEALTH_TEXT_COLOR,
  getLoanHealthTone,
} from '@onekeyhq/kit/src/views/Earn/pages/EarnLoanRouter/loanRouter.utils';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import {
  EarnFormRow,
  EarnFormSummary,
} from '@onekeyhq/kit/src/views/Staking/components/UniversalStake/EarnFormSummary';
import type { IEarnOutcome } from '@onekeyhq/kit/src/views/Staking/components/UniversalStake/EarnFormSummary';
import { EARN_EMPTIED_HOLD_MS } from '@onekeyhq/kit/src/views/Staking/utils/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type {
  IBorrowTransactionConfirmation,
  IEarnText,
} from '@onekeyhq/shared/types/staking';

import { CollateralInfo } from './CollateralInfo';
import { FeeInfo } from './FeeInfo';

// The server sizes these for its own card; a row keeps the rows' size
const rowText = (text?: IEarnText): IEarnText | undefined => {
  if (!text) {
    return undefined;
  }
  const { size: _size, ...rest } = text;
  return rest;
};

// "10.0345 → 15.0345": what it is now, quieter, then what the supply makes it
function BeforeAfter({
  current: currentText,
  latest: latestText,
}: {
  current?: IEarnText;
  latest?: IEarnText;
}) {
  const current = rowText(currentText);
  const latest = rowText(latestText);
  if (!latest) {
    return current ? <EarnText text={current} size="$bodyMdMedium" /> : null;
  }
  return (
    <XStack ai="center" gap="$1.5" flexShrink={1}>
      {current ? (
        <EarnText
          text={current}
          size="$bodySm"
          color={current.color ?? '$textSubdued'}
        />
      ) : null}
      {current ? (
        <Icon name="ArrowRightOutline" size="$4" color="$iconDisabled" />
      ) : null}
      <EarnText text={latest} size="$bodyMdMedium" />
    </XStack>
  );
}

// A health factor the server can show as a number: an account without loans
// gets none, or a sign that isn't one
const readHealthFigure = (text?: IEarnText) =>
  Number((text?.text ?? '').replace(/[^\d.]/g, ''));
const isHealthFigure = (text?: IEarnText) => {
  const value = readHealthFigure(text);
  return Number.isFinite(value) && value > 0;
};

// A health factor's band, the server's, as the Loans window and My portfolio
// read one
const readHealthTone = (text?: IEarnText): ILoanLtvTone | undefined =>
  isHealthFigure(text) ? getLoanHealthTone(readHealthFigure(text)) : undefined;

/**
 * A lending supply's part under the amount, as the Earn forms show it: what a
 * year at the supply rate earns on the amount, then the position's rows
 * (My Supply; where the account has loans on the market, Health Factor and
 * Use as Collateral). Supplying only, collateral isn't something to weigh.
 * A withdrawal's: what arrives, then My Supply and Health Factor
 */
export function EarnLendingSummary({
  action = 'supply',
  currentHealthFactor,
  amountValue,
  tokenSymbol,
  price,
  currencySymbol,
  transactionConfirmation,
  rowsStandIn,
  transactionConfirmationLoading,
  isAmountComing,
  isDimmed = false,
  keepsFiguresWhenEmptied = true,
}: {
  action?: 'supply' | 'withdraw';
  // The position's health factor now, from the market: shown until an
  // amount has its own (the answer for an empty amount doesn't carry it)
  currentHealthFactor?: IEarnText;
  amountValue: string;
  tokenSymbol?: string;
  price?: string;
  currencySymbol: string;
  transactionConfirmation?: IBorrowTransactionConfirmation;
  // Before the first answer (a form opened with an amount): the market's
  // answer for an empty amount, as last read. The rows take their places
  // and what doesn't depend on the amount from it (My Supply as it is, the
  // liquidation line, Use as Collateral, the supply rate); the figures for
  // the amount wait for the answer
  rowsStandIn?: IBorrowTransactionConfirmation;
  transactionConfirmationLoading?: boolean;
  // The amount supplied is still being worked out (a swap's estimate): the
  // figures wait, dimmed, or placeholders where there are none yet
  isAmountComing?: boolean;
  // The figures dim with nothing on its way (the caller's emptied box, after
  // an answer that failed): the dashes stay dashes
  isDimmed?: boolean;
  // Off where the amount given already stays a moment through an emptied
  // box (a swap's estimate), so the figures don't wait twice
  keepsFiguresWhenEmptied?: boolean;
}) {
  const intl = useIntl();
  // The factor in its band's color, the Borrow page's own
  const withHealthTone = (text?: IEarnText): IEarnText | undefined => {
    const tone = readHealthTone(text);
    return text && tone
      ? { ...text, color: LOAN_HEALTH_TEXT_COLOR[tone] }
      : text;
  };
  // While a new amount's rows load, the last ones stay in place
  const lastConfirmationRef = useRef<
    IBorrowTransactionConfirmation | undefined
  >(undefined);
  // Their projections (My Supply's new value, the health factor after) are
  // for an amount the box has let go of (it went to dashes) until the market
  // answers again: a new amount waits for its own with placeholders, as it
  // does once the market has answered for the empty box
  const isKeptForEmptiedRef = useRef(false);
  const typedBN = new BigNumber(amountValue);
  const isTypedPositive = !typedBN.isNaN() && typedBN.gt(0);
  // Emptied with figures on screen: the last amount's stay a moment, dimmed;
  // left empty, dashes
  const lastPositiveAmountRef = useRef('');
  const wasPositiveRef = useRef(isTypedPositive);
  const isEmptiedRef = useRef(false);
  if (wasPositiveRef.current !== isTypedPositive) {
    wasPositiveRef.current = isTypedPositive;
    isEmptiedRef.current =
      keepsFiguresWhenEmptied &&
      !isTypedPositive &&
      Boolean(lastPositiveAmountRef.current);
  }
  const [, setSettleTick] = useState(0);
  // Each key typed into it while it still has no amount ("0." on the way to
  // "0.5") keeps them a moment more: dashes come with a pause, not mid-word
  useEffect(() => {
    if (isTypedPositive || !isEmptiedRef.current) {
      return undefined;
    }
    const timer = setTimeout(() => {
      isEmptiedRef.current = false;
      isKeptForEmptiedRef.current = true;
      setSettleTick((tick) => tick + 1);
    }, EARN_EMPTIED_HOLD_MS);
    return () => clearTimeout(timer);
  }, [isTypedPositive, amountValue]);
  const isEmptySettling = !isTypedPositive && isEmptiedRef.current;
  // The market's answer for the emptied box doesn't replace the figures it
  // keeps while keys are still coming: they stay until the box settles on
  // empty (dashes), or until the amount typed has its own
  const freshConfirmation = isEmptySettling
    ? undefined
    : transactionConfirmation;
  if (freshConfirmation) {
    lastConfirmationRef.current = freshConfirmation;
    isKeptForEmptiedRef.current = false;
  }
  const isStandingIn =
    !freshConfirmation && !lastConfirmationRef.current && Boolean(rowsStandIn);
  const confirmation =
    freshConfirmation ?? lastConfirmationRef.current ?? rowsStandIn;
  if (isTypedPositive) {
    lastPositiveAmountRef.current = amountValue;
  } else if (!isEmptySettling) {
    lastPositiveAmountRef.current = '';
  }
  const amountBN = isEmptySettling
    ? new BigNumber(lastPositiveAmountRef.current)
    : typedBN;
  const isPositiveAmount = !amountBN.isNaN() && amountBN.gt(0);
  // The market had no answer for the amount typed (it failed): its
  // projections are dashes, not another amount's figures at full strength
  const isAnswerMissing =
    isTypedPositive &&
    !isAmountComing &&
    !transactionConfirmation &&
    !transactionConfirmationLoading;
  // And they stay dashes through an emptied box's moment: nothing is on its
  // way, so the figures there dim and no placeholder comes
  const showedDashesRef = useRef(false);
  if (isTypedPositive) {
    showedDashesRef.current = isAnswerMissing;
  }
  const isHoldingDashes = isEmptySettling && showedDashesRef.current;
  const isWaiting =
    Boolean(isAmountComing) || (isEmptySettling && !isHoldingDashes);
  const showsProjections =
    isPositiveAmount &&
    !isStandingIn &&
    !isAnswerMissing &&
    !isHoldingDashes &&
    (Boolean(freshConfirmation) || !isKeptForEmptiedRef.current);

  const isWithdraw = action === 'withdraw';
  // Worked out here from the supply rate, so it follows the typing at once
  const apy = new BigNumber(confirmation?.apyDetail?.apy ?? '');
  const outcome: IEarnOutcome = isWithdraw
    ? {
        label: intl.formatMessage({
          id: ETranslations.swap_review_you_receive,
        }),
        values: [],
        isEarning: false,
      }
    : {
        label: EARN_DESKTOP_DEMO_COPY.estAnnualRewards,
        values: [],
        isEarning: true,
      };
  // A withdrawal hands back the amount itself
  if (isWithdraw && isPositiveAmount) {
    const fiat = Number(price) > 0 ? amountBN.times(price ?? '0') : null;
    outcome.values = [
      {
        main: `${numberFormat(amountBN.toFixed(), {
          formatter: 'balance',
        })} ${tokenSymbol ?? ''}`.trim(),
        suffix: fiat
          ? numberFormat(fiat.toFixed(), {
              formatter: 'value',
              formatterOptions: { currency: currencySymbol },
            })
          : undefined,
      },
    ];
  } else if (isPositiveAmount && apy.gt(0)) {
    const yearly = amountBN.times(apy).div(100);
    const yearlyFiat = Number(price) > 0 ? yearly.times(price ?? '0') : null;
    outcome.values = [
      {
        main: `${numberFormat(yearly.toFixed(), {
          formatter: 'balance',
        })} ${tokenSymbol ?? ''}`.trim(),
        suffix: yearlyFiat
          ? numberFormat(yearlyFiat.toFixed(), {
              formatter: 'value',
              formatterOptions: { currency: currencySymbol },
            })
          : undefined,
      },
    ];
  }

  const rows: ReactElement[] = [];
  // Before the first answer: a supply always has this one, so it holds its
  // place with a dash and the button doesn't move when it lands
  if (!confirmation) {
    rows.push(
      <EarnFormRow
        key="my-supply"
        label={intl.formatMessage({ id: ETranslations.defi_my_supply })}
      />,
    );
  }
  if (confirmation?.mySupply) {
    rows.push(
      <EarnFormRow
        key="my-supply"
        label={intl.formatMessage({ id: ETranslations.defi_my_supply })}
        value={
          <BeforeAfter
            current={confirmation.mySupply.current?.title}
            latest={
              showsProjections ? confirmation.mySupply.latest?.title : undefined
            }
          />
        }
      />,
    );
  }
  // With loans the row is there from the first frame: the server gives the
  // liquidation line for an empty amount (only with loans) and the factor
  // once there is an amount, so a dash holds its place until then
  const healthFactor = showsProjections
    ? confirmation?.healthFactor
    : undefined;
  const hasLoans =
    Boolean(confirmation?.healthFactor || confirmation?.liquidationAt) ||
    isHealthFigure(currentHealthFactor);
  // Until an amount has its own, the factor as it is now
  let healthValue: ReactElement | undefined;
  if (healthFactor) {
    healthValue = (
      <BeforeAfter
        current={withHealthTone(healthFactor.current?.title)}
        latest={withHealthTone(healthFactor.latest?.title)}
      />
    );
  } else if (isHealthFigure(currentHealthFactor)) {
    healthValue = <BeforeAfter current={withHealthTone(currentHealthFactor)} />;
  }
  if (hasLoans) {
    rows.push(
      <EarnFormRow
        key="health-factor"
        label={intl.formatMessage({ id: ETranslations.defi_health_factor })}
        value={healthValue}
        // The same for every amount, so it stays as it is while the factor
        // above it changes
        note={
          <EarnText
            text={
              confirmation?.liquidationAt?.description ?? {
                text: intl.formatMessage({
                  id: ETranslations.defi_liquidation_at_less_than_1_00,
                }),
              }
            }
            size="$bodySm"
            color="$textSubdued"
          />
        }
      />,
    );
  }
  const canBeCollateral = confirmation?.canBeCollateral;
  const usageAsCollateral = confirmation?.usageAsCollateral;
  // Older responses omit usageAsCollateral; the switch state isn't guessed
  if (
    !isWithdraw &&
    hasLoans &&
    (canBeCollateral === false ||
      (canBeCollateral === true && usageAsCollateral !== undefined))
  ) {
    rows.push(
      <CollateralInfo
        key="collateral"
        canBeCollateral={canBeCollateral}
        usageAsCollateral={usageAsCollateral}
      />,
    );
  }
  if (!isWithdraw && confirmation?.refundableFee) {
    rows.push(
      <FeeInfo
        key="refundable-fee"
        type="refundable"
        data={confirmation.refundableFee}
      />,
    );
  }

  return (
    <EarnFormSummary
      outcome={outcome}
      isLendingMarket
      // Worked out here once the supply rate is in (the first answer); the
      // rows wait for each amount's answer
      isOutcomeLoading={
        (!isWithdraw && isPositiveAmount && !apy.gt(0)) || isWaiting
      }
      // For the amount typed: the emptied box's own answer, on its way through
      // its moment, replaces nothing
      isLoading={
        (isTypedPositive && Boolean(transactionConfirmationLoading)) ||
        isWaiting
      }
      isDimmed={isHoldingDashes || isDimmed}
      rows={rows}
    />
  );
}
