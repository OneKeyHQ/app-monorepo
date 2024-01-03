import { useMemo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { SizableText } from '@onekeyhq/components';

import { useTokenListMapAtom } from '../../states/jotai/contexts/token-list';
import { getFormattedNumber } from '../../utils/format';

type IProps = {
  $key: string;
} & ISizableTextProps;

function TokenPriceView(props: IProps) {
  const { $key, ...rest } = props;
  const [tokenListMap] = useTokenListMapAtom();
  const token = tokenListMap[$key];

  const price = getFormattedNumber(token?.price, { decimal: 4 });

  const content = useMemo(
    () => <SizableText {...rest}>${price}</SizableText>,
    [price, rest],
  );
  return content;
}

export { TokenPriceView };
