import { useMemo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { SizableText } from '@onekeyhq/components';

import { useTokenListMapAtom } from '../../states/jotai/contexts/token-list';
import { getFormattedNumber } from '../../utils/format';

type IProps = {
  $key: string;
} & ISizableTextProps;

function TokenValueView(props: IProps) {
  const { $key, ...rest } = props;
  const [tokenListMap] = useTokenListMapAtom();

  const token = tokenListMap[$key];
  const value = getFormattedNumber(token?.fiatValue, { decimal: 2 });

  const content = useMemo(
    () => <SizableText {...rest}>${value}</SizableText>,
    [rest, value],
  );
  return content;
}

export { TokenValueView };
