import { memo } from 'react';

import { PROPORTIONAL_NUMS, Skeleton, YStack } from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import {
  displayFiatValueOrUnavailable,
  displayOrUnavailable,
} from '@onekeyhq/shared/src/utils/tokenValueUtils';

type IProps = {
  isLoading: boolean;
  currency?: string;
  fiatValue?: string;
  balanceParsed?: string;
};

// The large fiat-value + balance block shared by the per-network header and
// the aggregate Overview tab.
function TokenDetailsBalanceHero({
  isLoading,
  currency,
  fiatValue,
  balanceParsed,
}: IProps) {
  return (
    <YStack gap="$2" mb="$5">
      {isLoading ? (
        <Skeleton.Group show>
          <Skeleton.Heading5Xl />
          <Skeleton.BodyLg />
        </Skeleton.Group>
      ) : (
        <>
          <Currency
            hideValue
            splitDecimal
            formatter="value"
            sourceCurrency={currency}
            fontSize={48}
            lineHeight={48}
            fontWeight={500}
            // Large hero value uses natural proportional figures (matches the
            // home total-balance hero); tabular is reserved for tables /
            // ticking data.
            fontVariant={PROPORTIONAL_NUMS}
          >
            {displayFiatValueOrUnavailable(fiatValue, balanceParsed)}
          </Currency>
          <NumberSizeableTextWrapper
            hideValue
            formatter="balance"
            color="$textSubdued"
            size="$bodyLg"
          >
            {displayOrUnavailable(balanceParsed)}
          </NumberSizeableTextWrapper>
        </>
      )}
    </YStack>
  );
}

export default memo(TokenDetailsBalanceHero);
