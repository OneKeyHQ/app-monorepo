import { memo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { NumberSizeableText } from '@onekeyhq/components';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';

import {
  useAggregateTokensMapAtom,
  useTokenListMapAtom,
} from '../../states/jotai/contexts/tokenList';

type IProps = {
  $key: string;
} & ISizableTextProps;

function TokenPriceChangeView(props: IProps) {
  const { $key, ...rest } = props;
  const [tokenListMap] = useTokenListMapAtom();
  const [aggregateTokensMap] = useAggregateTokensMapAtom();
  const token = tokenListMap[$key] ?? aggregateTokensMap[$key];
  const priceChange = token?.price24h ?? 0;

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
