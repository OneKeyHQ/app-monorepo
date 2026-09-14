import { memo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { displayOrUnavailable } from '@onekeyhq/shared/src/utils/tokenValueUtils';

import NumberSizeableTextWrapper from '../NumberSizeableTextWrapper';

import { useTokenBalanceParsed } from './useTokenFiatField';

type IProps = {
  $key: string;
  // Row network; lets the zero-fill gate tell "fetched, not held" apart from
  // "never fetched" (see resolveMapTokenFiat).
  networkId?: string;
  symbol: string;
  hideValue?: boolean;
} & ISizableTextProps;

function TokenBalanceView(props: IProps) {
  const { $key, networkId, symbol, ...rest } = props;
  // 方案B: subscribe to `balanceParsed` ONLY (field-scoped). The balance leaf no
  // longer re-renders on a pure price tick — only when the balance itself moves.
  // Seam (home cell vs context map) is handled inside the hook. `undefined`
  // means no fiat for this $key (equiv. to the old `!token`), since a present
  // `ITokenFiat` always carries `balanceParsed`.
  const balanceParsed = useTokenBalanceParsed($key || '', networkId);

  // No balance record for this $key (e.g. backend search results the account
  // never held): render nothing — a "-" placeholder carries no information
  // and reads as a glitch.
  if (balanceParsed === undefined) {
    return null;
  }

  return (
    <NumberSizeableTextWrapper
      formatter="balance"
      formatterOptions={{ tokenSymbol: symbol }}
      {...rest}
    >
      {displayOrUnavailable(balanceParsed)}
    </NumberSizeableTextWrapper>
  );
}

export default memo(TokenBalanceView);
