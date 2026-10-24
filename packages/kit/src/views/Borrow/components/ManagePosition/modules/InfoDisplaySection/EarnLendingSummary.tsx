import type { ReactElement } from 'react';
import { useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Icon, XStack, YStack } from '@onekeyhq/components';
import { EARN_DESKTOP_DEMO_COPY } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopHomeCopy';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import {
  EarnFormRow,
  EarnFormSummary,
  EarnFormValue,
} from '@onekeyhq/kit/src/views/Staking/components/UniversalStake/EarnFormSummary';
import type { IEarnOutcome } from '@onekeyhq/kit/src/views/Staking/components/UniversalStake/EarnFormSummary';
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

/**
 * A lending supply's part under the amount, as the Earn forms show it: what a
 * year at the supply rate earns on the amount, then the position's rows
 * (My Supply; where the account has loans on the market, Health Factor and
 * Use as Collateral). Supplying only, collateral isn't something to weigh
 */
export function EarnLendingSummary({
  amountValue,
  tokenSymbol,
  price,
  currencySymbol,
  transactionConfirmation,
  transactionConfirmationLoading,
}: {
  amountValue: string;
  tokenSymbol?: string;
  price?: string;
  currencySymbol: string;
  transactionConfirmation?: IBorrowTransactionConfirmation;
  transactionConfirmationLoading?: boolean;
}) {
  const intl = useIntl();
  // While a new amount's rows load, the last ones stay in place
  const lastConfirmationRef = useRef<
    IBorrowTransactionConfirmation | undefined
  >(undefined);
  if (transactionConfirmation) {
    lastConfirmationRef.current = transactionConfirmation;
  }
  const confirmation = transactionConfirmation ?? lastConfirmationRef.current;
  const amountBN = new BigNumber(amountValue);
  const isPositiveAmount = !amountBN.isNaN() && amountBN.gt(0);

  // Worked out here from the supply rate, so it follows the typing at once
  const apy = new BigNumber(confirmation?.apyDetail?.apy ?? '');
  const outcome: IEarnOutcome = {
    label: EARN_DESKTOP_DEMO_COPY.estAnnualRewards,
    values: [],
    isEarning: true,
  };
  if (isPositiveAmount && apy.gt(0)) {
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
              isPositiveAmount ? confirmation.mySupply.latest?.title : undefined
            }
          />
        }
      />,
    );
  }
  // With loans the row is there from the first frame: the server gives the
  // liquidation line for an empty amount (only with loans) and the factor
  // once there is an amount, so a dash holds its place until then
  const healthFactor = isPositiveAmount
    ? confirmation?.healthFactor
    : undefined;
  const hasLoans = Boolean(
    confirmation?.healthFactor || confirmation?.liquidationAt,
  );
  if (confirmation && hasLoans) {
    rows.push(
      <EarnFormRow
        key="health-factor"
        label={intl.formatMessage({ id: ETranslations.defi_health_factor })}
        value={
          <YStack ai="flex-end">
            {healthFactor ? (
              <BeforeAfter
                current={healthFactor.current?.title}
                latest={healthFactor.latest?.title}
              />
            ) : (
              <EarnFormValue />
            )}
            <EarnText
              text={
                confirmation.liquidationAt?.description ?? {
                  text: intl.formatMessage({
                    id: ETranslations.defi_liquidation_at_less_than_1_00,
                  }),
                }
              }
              size="$bodySm"
              color="$textSubdued"
            />
          </YStack>
        }
      />,
    );
  }
  const canBeCollateral = confirmation?.canBeCollateral;
  const usageAsCollateral = confirmation?.usageAsCollateral;
  // Older responses omit usageAsCollateral; the switch state isn't guessed
  if (
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
  if (confirmation?.refundableFee) {
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
      // Worked out here once the supply rate is in (the first answer); the
      // rows wait for each amount's answer
      isOutcomeLoading={isPositiveAmount && !apy.gt(0)}
      isLoading={isPositiveAmount && Boolean(transactionConfirmationLoading)}
      rows={rows}
    />
  );
}
