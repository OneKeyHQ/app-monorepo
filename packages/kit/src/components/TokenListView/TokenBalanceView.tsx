import { useMemo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { SizableText } from '@onekeyhq/components';

import { useTokenListMapAtom } from '../../states/jotai/contexts/tokenList';
import { getFormattedNumber } from '../../utils/format';

type IProps = {
  $key: string;
  symbol: string;
} & ISizableTextProps;

function TokenBalanceView(props: IProps) {
  const { $key, symbol, ...rest } = props;
  const [tokenListMap] = useTokenListMapAtom();
  const token = tokenListMap[$key || ''];

  const balance = getFormattedNumber(token?.balanceParsed);

  const content = useMemo(
    () => (
      <SizableText {...rest}>{`${balance ?? 0} ${symbol ?? ''}`}</SizableText>
    ),
    [balance, rest, symbol],
  );
  return content;
}

export { TokenBalanceView };
