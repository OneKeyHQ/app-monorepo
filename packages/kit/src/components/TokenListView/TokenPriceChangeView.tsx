import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import type { ISizableTextProps } from '@onekeyhq/components';
import { SizableText } from '@onekeyhq/components';

import { useTokenListMapAtom } from '../../states/jotai/contexts/token-list';

type IProps = {
  $key: string;
} & ISizableTextProps;

function TokenPriceChangeView(props: IProps) {
  const { $key, ...rest } = props;
  const [tokenListMap] = useTokenListMapAtom();
  const token = tokenListMap[$key];
  const priceChange = token.price24h ?? 0;
  const isPositive = new BigNumber(priceChange).isPositive();

  const content = useMemo(
    () => (
      <SizableText
        color={isPositive ? '$textSuccess' : '$textCritical'}
        {...rest}
      >
        {isPositive && '+'}
        {new BigNumber(priceChange).toFixed(2)}%
      </SizableText>
    ),
    [isPositive, priceChange, rest],
  );
  return content;
}

export { TokenPriceChangeView };
