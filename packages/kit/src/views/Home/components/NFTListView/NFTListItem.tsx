import { useMemo } from 'react';

import { Icon, ListItem } from '@onekeyhq/components';
import type { IAccountNFT } from '@onekeyhq/shared/types/NFT';

type IProps = {
  NFT: IAccountNFT;
  onPress?: (token: IAccountNFT) => void;
};

const MOCK_NETWORK_SYMBOL = 'ETH';

function NFTListItem(props: IProps) {
  const { NFT, onPress } = props;

  const primaryText = useMemo(() => {
    if (NFT.latestTradePrice && NFT.latestTradeSymbol) {
      return `${NFT.latestTradePrice} ${NFT.latestTradeSymbol}`;
    }

    return `0 ${MOCK_NETWORK_SYMBOL}`;
  }, [NFT.latestTradePrice, NFT.latestTradeSymbol]);

  return (
    <ListItem
      key={NFT.tokenId}
      title={NFT.name}
      subtitle={`X ${NFT.amount ?? 0}`}
      subtitleProps={{
        numberOfLines: 1,
      }}
      avatarProps={{
        src: NFT.imageUri,
        fallbackProps: {
          bg: '$bgStrong',
          justifyContent: 'center',
          alignItems: 'center',
          children: <Icon name="ImageMountainSolid" />,
        },
      }}
      onPress={() => {
        onPress?.(NFT);
      }}
      outlineStyle="none"
      borderRadius="$0"
      paddingVertical="$4"
      margin="0"
    >
      <ListItem.Text
        align="right"
        primary={primaryText}
        secondary={NFT.value ?? '$0'}
        secondaryTextProps={{
          tone: 'subdued',
        }}
      />
    </ListItem>
  );
}

export { NFTListItem };
