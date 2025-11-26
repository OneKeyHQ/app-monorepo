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
import type { IRewardToken } from '@onekeyhq/shared/src/referralCode/type';

interface ITradingVolumeSummaryCardProps extends IXStackProps {
  titleId?: ETranslations;
  title?: string;
  totalFiatValue: string | number;
  token: IRewardToken;
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
      py="$2"
      px="$0"
      testID="TradingVolumeSummaryCard"
      {...rest}
    >
      {/* Left section: Title and total fiat value */}
      <YStack gap="$0">
        <SizableText size="$bodyMd" color="$text">
          {displayTitle}
        </SizableText>
        <Currency formatter="value" size="$bodySm" color="$textSubdued">
          {totalFiatValue}
        </Currency>
      </YStack>

      {/* Right section: Token icon, amount, and fiat value */}
      <XStack ai="center" gap="$2" borderRadius="$2">
        <Token size="xs" tokenImageUri={token.logoURI} />
        <XStack ai="center" gap="$1">
          <NumberSizeableText
            formatter="balance"
            size="$bodyMd"
            color="$text"
            formatterOptions={{
              tokenSymbol: token.symbol || '',
            }}
          >
            {tokenAmount}
          </NumberSizeableText>
          <XStack ai="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              (
            </SizableText>
            <Currency formatter="value" size="$bodyMd" color="$textSubdued">
              {tokenFiatValue}
            </Currency>
            <SizableText size="$bodyMd" color="$textSubdued">
              )
            </SizableText>
          </XStack>
        </XStack>
      </XStack>
    </XStack>
  );
}
