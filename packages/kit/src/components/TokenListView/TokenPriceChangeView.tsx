import { memo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { NumberSizeableText } from '@onekeyhq/components';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  UNAVAILABLE_DISPLAY,
  isValidNumberValue,
} from '@onekeyhq/shared/src/utils/tokenValueUtils';

import { useTokenFiat } from '../../states/jotai/contexts/tokenList/slc';

import { useTokenListViewContext } from './TokenListViewContext';

type IProps = {
  $key: string;
} & ISizableTextProps;

function TokenPriceChangeView(props: IProps) {
  const { $key, ...rest } = props;
  const {
    tokenListMap: contextTokenListMap,
    aggregateTokenFiatMap: contextAggregateTokenFiatMap,
    useCellSeam,
  } = useTokenListViewContext();
  // Home path (spec §5): per-key cell subscription; non-cell paths resolve from
  // the context map + context aggregate fiat (PR-6). price24h must survive (spec
  // §3.1) — sumAggregateEntry preserves it on the cell path; the context
  // aggregate fiat carries it on the non-cell path.
  const cellToken = useTokenFiat($key);
  const mapToken =
    contextTokenListMap?.[$key] ?? contextAggregateTokenFiatMap?.[$key];
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
