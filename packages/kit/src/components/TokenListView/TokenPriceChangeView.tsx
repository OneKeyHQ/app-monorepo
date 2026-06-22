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

import { useTokenListViewContext } from './TokenListViewContext';

type IProps = {
  $key: string;
} & ISizableTextProps;

function TokenPriceChangeView(props: IProps) {
  const { $key, ...rest } = props;
  const { tokenListMap: contextTokenListMap } = useTokenListViewContext();
  const [globalTokenListMap] = useTokenListMapAtom();
  const [aggregateTokensMap] = useFlattenAggregateTokensMapAtom();
  const tokenListMap = contextTokenListMap ?? globalTokenListMap;
  const token = tokenListMap[$key] ?? aggregateTokensMap[$key];

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
