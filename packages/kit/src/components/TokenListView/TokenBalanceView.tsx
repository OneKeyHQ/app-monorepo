import { useMemo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';

import { useTokenListMapAtom } from '../../states/jotai/contexts/tokenList';
import NumberSizeableTextWrapper from '../NumberSizeableTextWrapper';

type IProps = {
  $key: string;
  symbol: string;
  hideValue?: boolean;
} & ISizableTextProps;

function TokenBalanceView(props: IProps) {
  const { $key, symbol, ...rest } = props;
  const [tokenListMap] = useTokenListMapAtom();
  const token = tokenListMap[$key || ''];

  const content = useMemo(
    () => (
      <NumberSizeableTextWrapper
        formatter="balance"
        formatterOptions={{ tokenSymbol: symbol }}
        {...rest}
      >
        {token?.balanceParsed ?? '0'}
      </NumberSizeableTextWrapper>
    ),
    [rest, symbol, token?.balanceParsed],
  );

  if (!token) {
    return null;
  }

  return content;
}

export { TokenBalanceView };
