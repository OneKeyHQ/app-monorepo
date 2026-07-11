import { memo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { NumberSizeableText, TABULAR_NUMS } from '@onekeyhq/components';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  UNAVAILABLE_DISPLAY,
  isValidNumberValue,
} from '@onekeyhq/shared/src/utils/tokenValueUtils';

import { useTokenPrice24h } from './useTokenFiatField';

type IProps = {
  $key: string;
} & ISizableTextProps;

function TokenPriceChangeView(props: IProps) {
  const { $key, ...rest } = props;
  // 方案B: subscribe to `price24h` only. Seam handled inside the hook.
  const price24h = useTokenPrice24h($key);

  if (!isValidNumberValue(price24h)) {
    return (
      <NumberSizeableText
        formatter="priceChange"
        color="$textSubdued"
        fontVariant={TABULAR_NUMS}
        {...rest}
      >
        {UNAVAILABLE_DISPLAY}
      </NumberSizeableText>
    );
  }

  const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
    priceChange: price24h,
  });

  return (
    <NumberSizeableText
      formatter="priceChange"
      formatterOptions={{ showPlusMinusSigns }}
      color={changeColor}
      fontVariant={TABULAR_NUMS}
      {...rest}
    >
      {price24h}
    </NumberSizeableText>
  );
}

export default memo(TokenPriceChangeView);
