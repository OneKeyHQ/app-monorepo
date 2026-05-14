import { memo } from 'react';

import { type ISizableTextProps, SizableText } from '@onekeyhq/components';

import {
  useFlattenAggregateTokensMapAtom,
  useTokenListMapAtom,
} from '../../states/jotai/contexts/tokenList';
import NumberSizeableTextWrapper from '../NumberSizeableTextWrapper';

import { useTokenListViewContext } from './TokenListViewContext';

type IProps = {
  $key: string;
  symbol: string;
  hideValue?: boolean;
} & ISizableTextProps;

function TokenBalanceView(props: IProps) {
  const { $key, symbol, ...rest } = props;
  const { tokenListMap: contextTokenListMap } = useTokenListViewContext();
  const [globalTokenListMap] = useTokenListMapAtom();
  const [aggregateTokensMap] = useFlattenAggregateTokensMapAtom();
  const tokenListMap = contextTokenListMap ?? globalTokenListMap;
  const token = tokenListMap[$key || ''] ?? aggregateTokensMap[$key || ''];

  if (!token) {
    return <SizableText {...rest}>-</SizableText>;
  }

  return (
    <NumberSizeableTextWrapper
      formatter="balance"
      formatterOptions={{ tokenSymbol: symbol }}
      {...rest}
    >
      {token?.balanceParsed || '0'}
    </NumberSizeableTextWrapper>
  );
}

export default memo(TokenBalanceView);
