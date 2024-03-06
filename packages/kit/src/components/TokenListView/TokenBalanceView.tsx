import { useMemo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { NumberSizeableText } from '@onekeyhq/components';

import { useTokenListMapAtom } from '../../states/jotai/contexts/tokenList';

type IProps = {
  $key: string;
  symbol: string;
} & ISizableTextProps;

function TokenBalanceView(props: IProps) {
  const { $key, symbol, ...rest } = props;
  const [tokenListMap] = useTokenListMapAtom();
  const token = tokenListMap[$key || ''];

  const content = useMemo(
    () => (
      <NumberSizeableText
        formatter="balance"
        formatterOptions={{ tokenSymbol: symbol }}
        {...rest}
      >
        {token?.balanceParsed ?? '0'}
      </NumberSizeableText>
    ),
    [rest, symbol, token?.balanceParsed],
  );
  return content;
}

export { TokenBalanceView };
