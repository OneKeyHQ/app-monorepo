import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { ListItem } from '@onekeyhq/components';

import { useTokenListMapAtom } from '../../states/jotai/contexts/token-list';

type IProps = {
  $key: string;
} & React.ComponentProps<typeof ListItem.Text>;

function TokenValueView(props: IProps) {
  const { $key, ...rest } = props;
  const [tokenListMap] = useTokenListMapAtom();

  const token = tokenListMap[$key];

  const content = useMemo(
    () => (
      <ListItem.Text
        primary={new BigNumber(token.fiatValue).toFixed(2)}
        {...rest}
      />
    ),
    [rest, token.fiatValue],
  );
  return content;
}

export { TokenValueView };
