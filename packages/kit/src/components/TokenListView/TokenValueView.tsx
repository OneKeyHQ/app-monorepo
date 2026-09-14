import { memo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { displayFiatValueOrUnavailable } from '@onekeyhq/shared/src/utils/tokenValueUtils';

import { Currency } from '../Currency';

import { useTokenValueSlice } from './useTokenFiatField';

type IProps = {
  $key: string;
  // Row network; see TokenBalanceView.
  networkId?: string;
  hideValue?: boolean;
} & ISizableTextProps;

function TokenValueView(props: IProps) {
  const { $key, networkId, ...rest } = props;
  // 方案B: subscribe to the value slice only ({ fiatValue, balanceParsed,
  // currency }); `has` distinguishes "no fiat" (old `!token`) from a present
  // token. Seam handled inside the hook.
  const { has, fiatValue, balanceParsed, currency } = useTokenValueSlice(
    $key,
    networkId,
  );

  // See TokenBalanceView: no fiat record means render nothing, not "-".
  if (!has) {
    return null;
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
