import { useMemo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { SizableText } from '@onekeyhq/components';

import { useTokenListMapAtom } from '../../states/jotai/contexts/token-list';
import { getFormattedNumber } from '../../utils/format';

type IProps = {
  $key: string;
} & ISizableTextProps;

function TokenBalanceView(props: IProps) {
  const { $key, ...rest } = props;
  const [tokenListMap] = useTokenListMapAtom();
  const token = tokenListMap[$key || ''];

  const balance = getFormattedNumber(token?.balanceParsed);

  const content = useMemo(
    () => <SizableText {...rest}>{balance}</SizableText>,
    [balance, rest],
  );
  return content;
}

export { TokenBalanceView };
