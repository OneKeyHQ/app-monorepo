import { useIntl } from 'react-intl';

import { SizableText, Spinner, XStack, YStack } from '@onekeyhq/components';
import { BorrowTestIDs } from '@onekeyhq/kit/src/views/Borrow/testIDs';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
