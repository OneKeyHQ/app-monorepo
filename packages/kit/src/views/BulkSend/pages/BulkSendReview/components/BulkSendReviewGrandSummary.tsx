import { useIntl } from 'react-intl';

import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useBulkSendReviewContext } from './Context';

function BulkSendReviewGrandSummary() {
  const intl = useIntl();
  const { tokenInfo, networkImageUri, totalTokenAmount, totalFiatAmount } =
    useBulkSendReviewContext();
  const currencyInfo = useCurrency();
  return (
    <YStack gap="$1" alignItems="center">
      <SizableText size="$bodyLgMedium" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.wallet_bulk_send_sending_amount,
        })}
      </SizableText>
      <XStack gap="$3" alignItems="center" justifyContent="center">
        <Token
          size="sm"
          tokenImageUri={tokenInfo.logoURI}
          networkImageUri={networkImageUri}
        />
        <NumberSizeableText
          size="$heading3xl"
          formatter="balance"
          formatterOptions={{
            tokenSymbol: tokenInfo.symbol,
            showPlusMinusSigns: true,
          }}
        >
          {`-${totalTokenAmount}`}
        </NumberSizeableText>
      </XStack>
      <NumberSizeableText
        size="$bodyLg"
        color="$textSubdued"
        formatter="value"
        formatterOptions={{ currency: currencyInfo.symbol }}
      >
        {totalFiatAmount}
      </NumberSizeableText>
    </YStack>
  );
}

export default BulkSendReviewGrandSummary;
