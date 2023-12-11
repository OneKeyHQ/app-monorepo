import BigNumber from 'bignumber.js';

import { Icon, ListItem } from '@onekeyhq/components';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

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
      subtitle={`${token.balance ?? 0} ${token.symbol}`}
      subtitleProps={{
        numberOfLines: 1,
      }}
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
      <ListItem.Text
        align="right"
        primary={token.fiatValue}
        secondary={token.price24h}
        secondaryTextProps={{
          tone: new BigNumber(token.price24h).isPositive()
            ? 'success'
            : 'critical',
        }}
      />
    </ListItem>
  );
}

export { TokenListItem };
