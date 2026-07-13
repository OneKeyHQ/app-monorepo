import { memo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { displayOrUnavailable } from '@onekeyhq/shared/src/utils/tokenValueUtils';

import { Currency } from '../Currency';

import { useTokenPriceSlice } from './useTokenFiatField';

type IProps = {
  $key: string;
} & ISizableTextProps;

function TokenPriceView(props: IProps) {
  const { $key, ...rest } = props;
  // 方案B: subscribe to { price, currency } only. Seam handled inside the hook.
  const { price, currency } = useTokenPriceSlice($key);

  return (
    <Currency
      formatter="price"
      sourceCurrency={currency}
      {...(rest as React.ComponentProps<typeof Currency>)}
    >
      {displayOrUnavailable(price)}
    </Currency>
  );
}

export default memo(TokenPriceView);
