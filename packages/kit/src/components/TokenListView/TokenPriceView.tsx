import { memo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { displayOrUnavailable } from '@onekeyhq/shared/src/utils/tokenValueUtils';

import {
  useFlattenAggregateTokensMapAtom,
  useTokenListMapAtom,
} from '../../states/jotai/contexts/tokenList';
import { useTokenFiat } from '../../states/jotai/contexts/tokenList/slc';
import { Currency } from '../Currency';

import { useTokenListViewContext } from './TokenListViewContext';

type IProps = {
  $key: string;
} & ISizableTextProps;

function TokenPriceView(props: IProps) {
  const { $key, ...rest } = props;
  const { tokenListMap: contextTokenListMap, useCellSeam } =
    useTokenListViewContext();
  const [globalTokenListMap] = useTokenListMapAtom();
  const [aggregateTokensMap] = useFlattenAggregateTokensMapAtom();
  // Home path (spec §5): per-key cell subscription; other paths keep the
  // `contextTokenListMap ?? globalMap` fallback.
  const cellToken = useTokenFiat($key);
  const mapToken =
    (contextTokenListMap ?? globalTokenListMap)[$key] ??
    aggregateTokensMap[$key];
  const token = useCellSeam ? cellToken : mapToken;

  return (
    <Currency
      formatter="price"
      sourceCurrency={token?.currency}
      {...(rest as React.ComponentProps<typeof Currency>)}
    >
      {displayOrUnavailable(token?.price)}
    </Currency>
  );
}

export default memo(TokenPriceView);
