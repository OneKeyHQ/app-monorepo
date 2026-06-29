import { memo } from 'react';

import { type ISizableTextProps, SizableText } from '@onekeyhq/components';
import { displayFiatValueOrUnavailable } from '@onekeyhq/shared/src/utils/tokenValueUtils';

import { Currency } from '../Currency';

import { useTokenValueSlice } from './useTokenFiatField';

type IProps = {
  $key: string;
  hideValue?: boolean;
} & ISizableTextProps;

function TokenValueView(props: IProps) {
  const { $key, ...rest } = props;
  // 方案B: subscribe to the value slice only ({ fiatValue, balanceParsed,
  // currency }); `has` distinguishes "no fiat" (old `!token`) from a present
  // token. Seam handled inside the hook.
  const { has, fiatValue, balanceParsed, currency } = useTokenValueSlice($key);

  if (!has) {
    return <SizableText {...rest}>-</SizableText>;
  }

  return (
    <Currency
      formatter="value"
      sourceCurrency={currency}
      {...(rest as React.ComponentProps<typeof Currency>)}
    >
      {displayFiatValueOrUnavailable(fiatValue, balanceParsed)}
    </Currency>
  );
}

export default memo(TokenValueView);
