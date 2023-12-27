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

  const content = useMemo(
    () => (
      <SizableText
        color={
          new BigNumber(token.price24h).isPositive()
            ? '$textSuccess'
            : '$textCritical'
        }
        {...rest}
      >
        {new BigNumber(token.price24h).toFixed(2)}%
      </SizableText>
    ),
    [rest, token.price24h],
  );
  return content;
}

export { TokenPriceChangeView };
