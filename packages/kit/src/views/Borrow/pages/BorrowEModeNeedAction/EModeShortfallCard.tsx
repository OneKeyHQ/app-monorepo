import { useIntl } from 'react-intl';

import type { IActionListItemProps } from '@onekeyhq/components';
import { SizableText, Spinner, XStack, YStack } from '@onekeyhq/components';
import { BorrowTestIDs } from '@onekeyhq/kit/src/views/Borrow/testIDs';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EModeGetFundsAction } from './EModeGetFundsAction';

/**
 * The shortfall and its remedy, stated together: an underfunded repay step is
 * only actionable if the fix travels with the numbers. Once a top-up is in
 * flight the block drops its caution tint — nothing is wrong any more, it is
 * just waiting.
 *
 * The `$3` padding is load-bearing: StepRow pulls the card left by exactly that
 * much so the headline shares a left edge with the step title. Keep the text
 * column first in the row — a leading adornment would push the headline off
 * that edge.
 */
export function EModeShortfallCard({
  symbol,
  balanceText,
  funding,
  items,
  onGetFundsPress,
}: {
  symbol: string;
  balanceText: string;
  funding: boolean;
  items?: IActionListItemProps[];
  onGetFundsPress: () => void;
}) {
  const intl = useIntl();

  const headline = funding
    ? intl.formatMessage({ id: ETranslations.feedback_transaction_submitted })
    : intl.formatMessage(
        { id: ETranslations.send_error_insufficient_balance },
        { token: symbol },
      );
  const detail = funding
    ? intl.formatMessage({
        id: ETranslations.defi_emode_waiting_confirmation__desc,
      })
    : balanceText;

  return (
    <XStack
      testID={BorrowTestIDs.eModeNeedActionShortfallCard}
      bg={funding ? '$bgSubdued' : '$bgCautionSubdued'}
      borderRadius="$3"
      borderCurve="continuous"
      p="$3"
      gap="$3"
      ai="center"
    >
      <YStack flex={1} gap="$0.5" minWidth={0}>
        <SizableText
          size="$bodyMdMedium"
          color={funding ? '$text' : '$textCaution'}
        >
          {headline}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {detail}
        </SizableText>
      </YStack>
      {/* The spinner takes the button's slot rather than a leading one: the
          submitted state then swaps the affordance in place, leaving the
          headline on the same left edge instead of shifting it. */}
      {funding ? <Spinner size="small" /> : null}
      {/* Without a resolvable funding token there is no swap/receive to offer,
          but the shortfall itself still has to be stated. The wrapper holds the
          button's width: as a row child it would otherwise shrink on web. */}
      {!funding && items?.length ? (
        <XStack flexShrink={0}>
          <EModeGetFundsAction
            symbol={symbol}
            items={items}
            onPress={onGetFundsPress}
          />
        </XStack>
      ) : null}
    </XStack>
  );
}
