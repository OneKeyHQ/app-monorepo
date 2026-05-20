import { memo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';

import {
  useFlattenAggregateTokensMapAtom,
  useTokenListMapAtom,
} from '../../states/jotai/contexts/tokenList';
import { Currency } from '../Currency';

import { useTokenListViewContext } from './TokenListViewContext';

type IProps = {
  $key: string;
} & ISizableTextProps;

function TokenPriceView(props: IProps) {
  const { $key, ...rest } = props;
  const { tokenListMap: contextTokenListMap } = useTokenListViewContext();
  const [globalTokenListMap] = useTokenListMapAtom();
  const [aggregateTokensMap] = useFlattenAggregateTokensMapAtom();
  const tokenListMap = contextTokenListMap ?? globalTokenListMap;
  const token = tokenListMap[$key] ?? aggregateTokensMap[$key];

  return (
    <Currency
      formatter="price"
      sourceCurrency={token?.currency}
      {...(rest as React.ComponentProps<typeof Currency>)}
    >
      {token?.price ?? 0}
    </Currency>
  );
}

export default memo(TokenPriceView);
