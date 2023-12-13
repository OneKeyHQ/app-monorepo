import { Icon, ListItem } from '@onekeyhq/components';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { TokenBalanceView } from './TokenBalanceView';
import { TokenPriceView } from './TokenPriceView';
import { TokenValueView } from './TokenValueView';

type IProps = {
  token: IAccountToken;
  onPress?: (token: IAccountToken) => void;
};

function TokenListItem(props: IProps) {
  const { token, onPress } = props;
  return (
    <ListItem
      key={token.name}
      title={token.name}
      avatarProps={{
        src: token.logoURI,
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
      outlineStyle="none"
      borderRadius="$0"
      paddingVertical="$4"
      margin="0"
    >
      <TokenPriceView $key={token.$key ?? ''} align="left" flex={1} />
      <TokenBalanceView
        $key={token.$key ?? ''}
        symbol={token.symbol}
        align="left"
        flex={1}
      />
      <TokenValueView $key={token.$key ?? ''} align="right" flex={1} />
    </ListItem>
  );
}

export { TokenListItem };
