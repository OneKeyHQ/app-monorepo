import { useIntl } from 'react-intl';

import { SizableText, Spinner, XStack, YStack } from '@onekeyhq/components';
import { BorrowTestIDs } from '@onekeyhq/kit/src/views/Borrow/testIDs';
import { ETranslations } from '@onekeyhq/shared/src/locale';

/**
 * The shortfall, stated on its own lines. The remedy lives in the page footer
 * beside the blocked action: a Top up button buried in here was the only live
 * control on a screen whose primary button is disabled for exactly as long as
 * the shortfall stands. Once a top-up is in flight the block drops its caution
 * tint — nothing is wrong any more, it is just waiting.
 *
 * The `$3` padding is load-bearing: StepRow pulls the card left by exactly that
 * much so the headline shares a left edge with the step title. Keep the text
 * column first in the row — a leading adornment would push the headline off
 * that edge.
 */
export function EModeShortfallCard({
  symbol,
  balanceLines,
  funding,
}: {
  symbol: string;
  balanceLines: string[];
  funding: boolean;
}) {
  const intl = useIntl();

  const headline = funding
    ? intl.formatMessage({ id: ETranslations.feedback_transaction_submitted })
    : intl.formatMessage(
        { id: ETranslations.send_error_insufficient_balance },
        { token: symbol },
      );
  const detailLines = funding
    ? [
        intl.formatMessage({
          id: ETranslations.defi_emode_waiting_confirmation__desc,
        }),
      ]
    : balanceLines;

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
        {detailLines.map((line) => (
          <SizableText key={line} size="$bodySm" color="$textSubdued">
            {line}
          </SizableText>
        ))}
      </YStack>
      {funding ? <Spinner size="small" /> : null}
    </XStack>
  );
}
