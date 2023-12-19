import { Icon, ListItem } from '@onekeyhq/components';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

type IProps = {
  nft: IAccountNFT;
  onPress?: (token: IAccountNFT) => void;
};

function NFTListItem(props: IProps) {
  const { nft, onPress } = props;

  return (
    <ListItem
      key={nft.itemId}
      title={nft.metadata.name}
      subtitle={nft.collectionName}
      subtitleProps={{
        numberOfLines: 1,
      }}
      avatarProps={{
        src: nft.metadata.image,
        fallbackProps: {
          bg: '$bgStrong',
          justifyContent: 'center',
          alignItems: 'center',
          children: <Icon name="ImageMountainSolid" />,
        },
      }}
      onPress={() => {
        onPress?.(nft);
      }}
      outlineStyle="none"
      borderRadius="$0"
      paddingVertical="$4"
      margin="0"
    >
      <ListItem.Text align="right" primary={nft.amount} />
    </ListItem>
  );
}

export { NFTListItem };
