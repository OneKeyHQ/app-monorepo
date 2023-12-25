import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import type { ISizableTextProps } from '@onekeyhq/components';
import { SizableText } from '@onekeyhq/components';

import { useTokenListMapAtom } from '../../states/jotai/contexts/token-list';

type IProps = {
  $key: string;
  symbol: string;
} & ISizableTextProps;

function TokenBalanceView(props: IProps) {
  const { $key, symbol, ...rest } = props;
  const [tokenListMap] = useTokenListMapAtom();
  const token = tokenListMap[$key];

  const content = useMemo(
    () => (
      <SizableText {...rest}>{`${new BigNumber(token.balanceParsed).toFixed(
        2,
      )} ${symbol}`}</SizableText>
    ),
    [rest, symbol, token.balanceParsed],
  );
  return content;
}

export { TokenBalanceView };
