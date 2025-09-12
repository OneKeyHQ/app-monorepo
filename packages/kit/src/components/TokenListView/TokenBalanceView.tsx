import { memo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';

import {
  useAggregateTokensMapAtom,
  useTokenListMapAtom,
} from '../../states/jotai/contexts/tokenList';
import NumberSizeableTextWrapper from '../NumberSizeableTextWrapper';

type IProps = {
  $key: string;
  symbol: string;
  hideValue?: boolean;
} & ISizableTextProps;

function TokenBalanceView(props: IProps) {
  const { $key, symbol, ...rest } = props;
  const [tokenListMap] = useTokenListMapAtom();
  const [aggregateTokensMap] = useAggregateTokensMapAtom();
  const token = tokenListMap[$key || ''] ?? aggregateTokensMap[$key || ''];

  if (!token) {
    return null;
  }

  return (
    <NumberSizeableTextWrapper
      formatter="balance"
      formatterOptions={{ tokenSymbol: symbol }}
      {...rest}
    >
      {token?.balanceParsed ?? '0'}
    </NumberSizeableTextWrapper>
  );
}

export default memo(TokenBalanceView);
