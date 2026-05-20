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

  // token.price is now USD-normalized for new data (currency='usd'); legacy
  // hydrate is tagged with the user's then-active display currency.
  // <Currency> converts the source tag to settings.currencyInfo.id at render.
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
