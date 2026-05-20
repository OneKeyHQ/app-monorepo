import { memo } from 'react';

import BigNumber from 'bignumber.js';

import { type ISizableTextProps, SizableText } from '@onekeyhq/components';

import {
  useFlattenAggregateTokensMapAtom,
  useTokenListMapAtom,
} from '../../states/jotai/contexts/tokenList';
import { Currency } from '../Currency';

import { useTokenListViewContext } from './TokenListViewContext';

type IProps = {
  $key: string;
  hideValue?: boolean;
} & ISizableTextProps;

function TokenValueView(props: IProps) {
  const { $key, ...rest } = props;
  const { tokenListMap: contextTokenListMap } = useTokenListViewContext();
  const [globalTokenListMap] = useTokenListMapAtom();
  const [aggregateTokensMap] = useFlattenAggregateTokensMapAtom();
  const tokenListMap = contextTokenListMap ?? globalTokenListMap;
  const token = tokenListMap[$key] ?? aggregateTokensMap[$key];

  const fiatValue = new BigNumber(token?.fiatValue || 0);

  if (!token) {
    return <SizableText {...rest}>-</SizableText>;
  }

  return (
    <Currency
      formatter="value"
      sourceCurrency={token.currency}
      {...(rest as React.ComponentProps<typeof Currency>)}
    >
      {fiatValue.isNaN() ? 0 : fiatValue.toFixed()}
    </Currency>
  );
}

export default memo(TokenValueView);
