import { useMemo } from 'react';

import { ListItem } from '@onekeyhq/components';

import { useTokenListMapAtom } from '../../../../states/jotai/contexts/token-list';

type IProps = {
  $key: string;
  symbol: string;
} & React.ComponentProps<typeof ListItem.Text>;

function TokenBalanceView(props: IProps) {
  const { $key, symbol, ...rest } = props;
  const [tokenListMap] = useTokenListMapAtom();
  const token = tokenListMap[$key];

  const content = useMemo(
    () => (
      <ListItem.Text primary={`${token.balanceParsed} ${symbol}`} {...rest} />
    ),
    [rest, symbol, token.balanceParsed],
  );
  return content;
}

export { TokenBalanceView };
