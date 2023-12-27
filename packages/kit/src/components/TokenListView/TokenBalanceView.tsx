import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import type { ISizableTextProps } from '@onekeyhq/components';
import { SizableText } from '@onekeyhq/components';

import { useTokenListMapAtom } from '../../states/jotai/contexts/token-list';

type IProps = {
  $key: string;
} & ISizableTextProps;

function TokenBalanceView(props: IProps) {
  const { $key, ...rest } = props;
  const [tokenListMap] = useTokenListMapAtom();
  const token = tokenListMap[$key || ''];

  const content = useMemo(
    () => (
      <SizableText {...rest}>
        {new BigNumber(token.balanceParsed).toFixed(2)}
      </SizableText>
    ),
    [rest, token],
  );
  return content;
}

export { TokenBalanceView };
