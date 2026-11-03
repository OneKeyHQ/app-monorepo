import { useRef } from 'react';
import type { ReactElement } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { EARN_DESKTOP_DEMO_COPY } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopHomeCopy';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import {
  EarnFormRow,
  EarnFormSummary,
} from '@onekeyhq/kit/src/views/Staking/components/UniversalStake/EarnFormSummary';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowTransactionConfirmation } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { ApyTextV2 } from '../../../BorrowTableList/ApyTextV2';

import { CollateralInfo } from './CollateralInfo';
import { BeforeAfter, withHealthTone } from './EarnLendingSummary';
import { FeeInfo } from './FeeInfo';
import { getReserveBorrowRowKinds } from './reserveBorrowRows';
import { SwapOrBridgeInfo } from './SwapOrBridgeInfo';

import type { IReserveBorrowRowKind } from './reserveBorrowRows';
import type { IBorrowReserveFormScope } from '../../reserveFormScope';

/**
 * A loan's side on a reserve's own page (demo 11-03): the outlined card's
 * rows as the plain rows its supply side lists, so the four sides read
 * alike. The manage window keeps its card
 */
export function ReserveBorrowSummary({
  action,
  amountValue,
  token,
  accountId,
  networkId,
  showApyDetail,
  showSwapOrBridge,
  transactionConfirmation,
  transactionConfirmationLoading,
  position,
}: {
  action: 'borrow' | 'repay';
  amountValue: string;
  token?: IToken;
  accountId: string;
  networkId: string;
  showApyDetail: boolean;
  showSwapOrBridge: boolean;
  transactionConfirmation?: IBorrowTransactionConfirmation;
  transactionConfirmationLoading?: boolean;
  position?: IBorrowReserveFormScope['position'];
}) {
  const intl = useIntl();
  const amountBN = new BigNumber(amountValue);
  const isTypedPositive = !amountBN.isNaN() && amountBN.gt(0);
  // While a new amount's answer comes, the last rows stay in place, dimmed,
  // as the supply side's do; the card shows its skeleton there instead
  const lastAnswerRef = useRef<
    | {
        confirmation: IBorrowTransactionConfirmation;
        isForTypedAmount: boolean;
      }
    | undefined
  >(undefined);
  if (transactionConfirmation) {
    lastAnswerRef.current = {
      confirmation: transactionConfirmation,
      isForTypedAmount: isTypedPositive,
    };
  }
  const keptAnswer =
    !transactionConfirmation && transactionConfirmationLoading
      ? lastAnswerRef.current
      : undefined;
  const confirmation = transactionConfirmation ?? keptAnswer?.confirmation;
  // A position row comes and goes with the answer it shows, not with the
  // keys, so the rows change together
  const isForTypedAmount = keptAnswer
    ? keptAnswer.isForTypedAmount
    : isTypedPositive;
  const kinds = getReserveBorrowRowKinds({
    action,
    confirmation,
    position,
    isForTypedAmount,
    showApyDetail,
    offersSwap: showSwapOrBridge && Boolean(token),
  });

  const renderRow = (kind: IReserveBorrowRowKind): ReactElement | null => {
    switch (kind) {
      case 'health-factor': {
        const healthFactor = confirmation?.healthFactor;
        return (
          <EarnFormRow
            key={kind}
            label={intl.formatMessage({ id: ETranslations.defi_health_factor })}
            value={
              <BeforeAfter
                current={withHealthTone(healthFactor?.current?.title)}
                latest={withHealthTone(healthFactor?.latest?.title)}
              />
            }
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
          />
        );
      }
      case 'my-supply':
        return confirmation?.mySupply ? (
          <EarnFormRow
            key={kind}
            label={intl.formatMessage({ id: ETranslations.defi_my_supply })}
            value={
              <BeforeAfter
                current={confirmation.mySupply.current?.title}
                latest={confirmation.mySupply.latest?.title}
              />
            }
          />
        ) : null;
      case 'my-borrow':
        return (
          <EarnFormRow
            key={kind}
            label={intl.formatMessage({ id: ETranslations.defi_my_borrow })}
            value={
              confirmation?.myBorrow ? (
                <BeforeAfter
                  current={confirmation.myBorrow.current?.title}
                  latest={confirmation.myBorrow.latest?.title}
                />
              ) : undefined
            }
          />
        );
      case 'apy':
        return (
          <EarnFormRow
            key={kind}
            label={intl.formatMessage({ id: ETranslations.defi_borrow_apy })}
            value={
              confirmation?.apyDetail ? (
                <ApyTextV2
                  apyDetail={confirmation.apyDetail}
                  triggerMode="icon"
                />
              ) : undefined
            }
          />
        );
      case 'refundable-fee':
        return confirmation?.refundableFee ? (
          <FeeInfo
            key={kind}
            type="refundable"
            data={confirmation.refundableFee}
          />
        ) : null;
      case 'refund-fee':
        return confirmation?.refundFee ? (
          <FeeInfo key={kind} type="refund" data={confirmation.refundFee} />
        ) : null;
      case 'collateral':
        return (
          <CollateralInfo
            key={kind}
            // The row only exists where the answer says either way
            canBeCollateral={confirmation?.canBeCollateral === true}
            usageAsCollateral={confirmation?.usageAsCollateral}
          />
        );
      case 'swap':
        return token ? (
          <SwapOrBridgeInfo
            key={kind}
            token={token}
            accountId={accountId}
            networkId={networkId}
          />
        ) : null;
      default:
        return null;
    }
  };
  // "Not enough X?" goes under the rows, so it never folds into "Details"
  const rows = kinds
    .filter((kind) => kind !== 'swap')
    .map(renderRow)
    .filter((row): row is ReactElement => row !== null);
  const swapRow = kinds.includes('swap') ? renderRow('swap') : null;

  return (
    <EarnFormSummary
      isLendingMarket
      rows={rows}
      footnote={swapRow}
      // As the supply side: an amount's figures dim while its answer comes,
      // and wait as placeholders before its first
      isLoading={isTypedPositive && Boolean(transactionConfirmationLoading)}
    />
  );
}

/**
 * The reserve page's form loading: the rows each side will list, with
 * dashes, where the manage window draws its outlined skeleton
 */
export function ReserveFormRowsSkeleton({
  action,
  hidesMySupply,
  hidesMyBorrow,
}: {
  action: 'supply' | 'withdraw' | 'borrow' | 'repay';
  hidesMySupply: boolean;
  hidesMyBorrow: boolean;
}) {
  const intl = useIntl();
  if (action === 'supply' || action === 'withdraw') {
    return (
      <EarnFormSummary
        isLendingMarket
        outcome={
          action === 'supply'
            ? {
                label: EARN_DESKTOP_DEMO_COPY.estAnnualRewards,
                values: [],
                isEarning: true,
              }
            : {
                label: intl.formatMessage({
                  id: ETranslations.swap_review_you_receive,
                }),
                values: [],
                isEarning: false,
              }
        }
        rows={
          hidesMySupply
            ? []
            : [
                <EarnFormRow
                  key="my-supply"
                  label={intl.formatMessage({
                    id: ETranslations.defi_my_supply,
                  })}
                />,
              ]
        }
      />
    );
  }
  const rows: ReactElement[] = [];
  if (!hidesMyBorrow) {
    rows.push(
      <EarnFormRow
        key="my-borrow"
        label={intl.formatMessage({ id: ETranslations.defi_my_borrow })}
      />,
    );
  }
  if (action === 'borrow') {
    rows.push(
      <EarnFormRow
        key="apy"
        label={intl.formatMessage({ id: ETranslations.defi_borrow_apy })}
      />,
    );
  }
  return <EarnFormSummary isLendingMarket rows={rows} />;
}
