import { memo } from 'react';

import {
  type ISizableTextProps,
  SizableText,
  TABULAR_NUMS,
} from '@onekeyhq/components';
import { displayOrUnavailable } from '@onekeyhq/shared/src/utils/tokenValueUtils';

import NumberSizeableTextWrapper from '../NumberSizeableTextWrapper';

import { useTokenBalanceParsed } from './useTokenFiatField';

type IProps = {
  $key: string;
  symbol: string;
  hideValue?: boolean;
} & ISizableTextProps;

function TokenBalanceView(props: IProps) {
  const { $key, symbol, ...rest } = props;
  // 方案B: subscribe to `balanceParsed` ONLY (field-scoped). The balance leaf no
  // longer re-renders on a pure price tick — only when the balance itself moves.
  // Seam (home cell vs context map) is handled inside the hook. `undefined`
  // means no fiat for this $key (equiv. to the old `!token`), since a present
  // `ITokenFiat` always carries `balanceParsed`.
  const balanceParsed = useTokenBalanceParsed($key || '');

  if (balanceParsed === undefined) {
    return (
      <SizableText fontVariant={TABULAR_NUMS} {...rest}>
        -
      </SizableText>
    );
  }

  return (
    <NumberSizeableTextWrapper
      formatter="balance"
      formatterOptions={{ tokenSymbol: symbol }}
      fontVariant={TABULAR_NUMS}
      {...rest}
    >
      {displayOrUnavailable(balanceParsed)}
    </NumberSizeableTextWrapper>
  );
}

export default memo(TokenBalanceView);
