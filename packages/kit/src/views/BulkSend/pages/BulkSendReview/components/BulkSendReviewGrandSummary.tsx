import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IToken } from '@onekeyhq/shared/types/token';

import { Token } from '@onekeyhq/kit/src/components/Token';

type Props = {
  tokenInfo: IToken;
  networkImageUri?: string;
  totalTokenAmount: string;
  totalFiatAmount: string;
};

function BulkSendReviewGrandSummary({
  tokenInfo,
  networkImageUri,
  totalTokenAmount,
  totalFiatAmount,
}: Props) {
  return (
    <YStack gap="$1" alignItems="center" py="$3">
      <SizableText size="$bodyLgMedium" color="$textSubdued">
        Sending amount
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
        formatterOptions={{ currency: '$' }}
      >
        {totalFiatAmount}
      </NumberSizeableText>
    </YStack>
  );
}

export default BulkSendReviewGrandSummary;
