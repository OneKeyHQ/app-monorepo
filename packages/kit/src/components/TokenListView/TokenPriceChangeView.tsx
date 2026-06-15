import { memo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { NumberSizeableText } from '@onekeyhq/components';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  UNAVAILABLE_DISPLAY,
  isValidNumberValue,
} from '@onekeyhq/shared/src/utils/tokenValueUtils';

import {
  useFlattenAggregateTokensMapAtom,
  useTokenListMapAtom,
} from '../../states/jotai/contexts/tokenList';
import { useTokenFiat } from '../../states/jotai/contexts/tokenList/slc';

import { useTokenListViewContext } from './TokenListViewContext';

type IProps = {
  $key: string;
} & ISizableTextProps;

function TokenPriceChangeView(props: IProps) {
  const { $key, ...rest } = props;
  const { tokenListMap: contextTokenListMap, useCellSeam } =
    useTokenListViewContext();
  const [globalTokenListMap] = useTokenListMapAtom();
  const [aggregateTokensMap] = useFlattenAggregateTokensMapAtom();
  // Home path (spec §5): per-key cell subscription; other paths keep the
  // `contextTokenListMap ?? globalMap` fallback. price24h must survive (spec
  // §3.1) — sumAggregateEntry preserves it on the cell path.
  const cellToken = useTokenFiat($key);
  const mapToken =
    (contextTokenListMap ?? globalTokenListMap)[$key] ??
    aggregateTokensMap[$key];
  const token = useCellSeam ? cellToken : mapToken;

  if (!isValidNumberValue(token?.price24h)) {
    return (
      <NumberSizeableText
        formatter="priceChange"
        color="$textSubdued"
        {...rest}
      >
        {UNAVAILABLE_DISPLAY}
      </NumberSizeableText>
    );
  }

  const priceChange = token.price24h;
  const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
    priceChange,
  });

  return (
    <NumberSizeableText
      formatter="priceChange"
      formatterOptions={{ showPlusMinusSigns }}
      color={changeColor}
      {...rest}
    >
      {priceChange}
    </NumberSizeableText>
  );
}

export default memo(TokenPriceChangeView);
