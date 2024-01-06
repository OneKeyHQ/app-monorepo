import { useMemo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { SizableText } from '@onekeyhq/components';

type IProps = {
  symbol: string;
} & ISizableTextProps;

function TokenSymbolView(props: IProps) {
  const { symbol, ...rest } = props;

  const content = useMemo(
    () => <SizableText {...rest}>{symbol}</SizableText>,
    [rest, symbol],
  );
  return content;
}

export { TokenSymbolView };
