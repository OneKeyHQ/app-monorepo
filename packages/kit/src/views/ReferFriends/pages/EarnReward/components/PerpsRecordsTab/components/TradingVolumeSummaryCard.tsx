import { useIntl } from 'react-intl';

import {
  type IXStackProps,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPerpsRecordToken } from '@onekeyhq/shared/src/referralCode/type';

interface ITradingVolumeSummaryCardProps extends IXStackProps {
  titleId?: ETranslations;
  title?: string;
  totalFiatValue: string | number;
  token: IPerpsRecordToken;
  tokenAmount: string;
  tokenFiatValue: string;
}

export function TradingVolumeSummaryCard({
  titleId,
  title = 'Trading Volume',
  totalFiatValue,
  token,
  tokenAmount,
  tokenFiatValue,
  ...rest
}: ITradingVolumeSummaryCardProps) {
  const intl = useIntl();

  const displayTitle = titleId ? intl.formatMessage({ id: titleId }) : title;

  return (
    <XStack
      ai="center"
      jc="space-between"
      py="$3"
      px="$5"
      bg="$bgSubdued"
      borderRadius="$3"
      testID="TradingVolumeSummaryCard"
      {...rest}
    >
      {/* Left section: Title and total fiat value */}
      <YStack gap="$1">
        <SizableText size="$bodyMd" color="$textSubdued">
          {displayTitle}
        </SizableText>
        <Currency formatter="value" size="$heading3xl" fontWeight="600">
          {totalFiatValue}
        </Currency>
      </YStack>

      {/* Right section: Token icon, amount, and fiat value */}
      <XStack ai="center" gap="$2">
        <Token size="sm" tokenImageUri={token.logoURI} />
        <XStack ai="center" gap="$1">
          <NumberSizeableText
            formatter="balance"
            size="$bodyLgMedium"
            formatterOptions={{
              tokenSymbol: token.symbol || '',
            }}
          >
            {tokenAmount}
          </NumberSizeableText>
          <XStack ai="center">
            <SizableText size="$bodyLg" color="$textSubdued">
              (
            </SizableText>
            <Currency formatter="value" size="$bodyLg" color="$textSubdued">
              {tokenFiatValue}
            </Currency>
            <SizableText size="$bodyLg" color="$textSubdued">
              )
            </SizableText>
          </XStack>
        </XStack>
      </XStack>
    </XStack>
  );
}
