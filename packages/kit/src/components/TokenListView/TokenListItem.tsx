import { Icon, ListItem } from '@onekeyhq/components';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { TokenBalanceView } from './TokenBalanceView';
// import { TokenPriceView } from './TokenPriceView';
// import { TokenValueView } from './TokenValueView';

type IProps = {
  token: IAccountToken;
  onPress?: (token: IAccountToken) => void;
};

function TokenListItem(props: IProps) {
  const { token, onPress } = props;
  const tokenInfo = token.info;
  return (
    <ListItem
      key={tokenInfo.name}
      title={tokenInfo.name}
      subtitle="Amount symbol"
      avatarProps={{
        src: tokenInfo.logoURI,
        fallbackProps: {
          bg: '$bgStrong',
          justifyContent: 'center',
          alignItems: 'center',
          children: <Icon name="ImageMountainSolid" />,
        },
      }}
      onPress={() => {
        onPress?.(token);
      }}
    >
      <TokenBalanceView
        $key={token.$key ?? ''}
        symbol={tokenInfo.symbol}
        align="right"
        flex={1}
      />
    </ListItem>
  );
}

export { TokenListItem };
