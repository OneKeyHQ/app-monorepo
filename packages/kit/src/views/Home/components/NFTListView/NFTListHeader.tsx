import { SearchBar, XStack } from '@onekeyhq/components';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

type IProps = {
  nfts: IAccountNFT[];
};

function NFTListHeader(props: IProps) {
  const { nfts } = props;
  return (
    <XStack px="$5" pb="$3">
      {nfts.length > 0 && (
        <SearchBar
          placeholder="Search..."
          containerProps={{
            flex: 1,
            mr: '$2.5',
            mt: '$5',
            maxWidth: '$80',
          }}
        />
      )}
    </XStack>
  );
}

export { NFTListHeader };
