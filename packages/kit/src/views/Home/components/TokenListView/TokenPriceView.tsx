import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { ListItem } from '@onekeyhq/components';

import { useTokenListMapAtom } from '../../../../states/jotai/contexts/token-list';

type IProps = {
  $key: string;
} & React.ComponentProps<typeof ListItem.Text>;

function TokenPriceView(props: IProps) {
  const { $key, ...rest } = props;
  const [tokenListMap] = useTokenListMapAtom();
  const token = tokenListMap[$key];

  const content = useMemo(
    () => (
      <ListItem.Text
        align="right"
        primary={new BigNumber(token.price).toFixed(2)}
        secondary={`${new BigNumber(token.price24h).toFixed(2)}%`}
        secondaryTextProps={{
          tone: new BigNumber(token.price24h).isPositive()
            ? 'success'
            : 'critical',
        }}
        {...rest}
      />
    ),
    [rest, token.price, token.price24h],
  );
  return content;
}

export { TokenPriceView };
