import { memo } from 'react';

import {
  NumberSizeableText,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IMarketAccountPortfolioItem } from '@onekeyhq/shared/types/marketV2';

interface IPortfolioItemSmallProps {
  item: IMarketAccountPortfolioItem;
  index: number;
}

function PortfolioItemSmallBase({
  item,
}: IPortfolioItemSmallProps) {
  const [settingsPersistAtom] = useSettingsPersistAtom();

  return (
    <XStack
      px="$4"
      py="$3"
      borderBottomWidth={1}
      borderColor="$borderSubdued"
      justifyContent="space-between"
      alignItems="center"
    >
      {/* Amount */}
      <Stack flex={1}>
        <SizableText size="$bodySm" color="$textSubdued" mb="$1">
          Amount
        </SizableText>
        <NumberSizeableText
          size="$bodyMd"
          color="$text"
          formatter="balance"
        >
          {item.amount}
        </NumberSizeableText>
      </Stack>

      {/* Total Value */}
      <Stack flex={1} alignItems="flex-end">
        <SizableText size="$bodySm" color="$textSubdued" mb="$1">
          Value
        </SizableText>
        <NumberSizeableText
          size="$bodyMd"
          color="$text"
          formatter="value"
          formatterOptions={{
            currency: settingsPersistAtom.currencyInfo.symbol,
          }}
        >
          {item.totalPrice}
        </NumberSizeableText>
      </Stack>
    </XStack>
  );
}

const PortfolioItemSmall = memo(PortfolioItemSmallBase);

export { PortfolioItemSmall };
