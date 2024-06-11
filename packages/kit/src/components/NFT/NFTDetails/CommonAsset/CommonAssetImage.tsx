import BigNumber from 'bignumber.js';

import { Image, SizableText, Stack } from '@onekeyhq/components';
import { ENFTType, type IAccountNFT } from '@onekeyhq/shared/types/nft';

type IProps = {
  nft: IAccountNFT;
};

function CommonAssetImage(props: IProps) {
  const { nft } = props;
  return (
    <>
      <Image
        width="100%"
        height="100%"
        source={{
          uri: nft.metadata?.image,
        }}
        style={{
          borderRadius: 12,
        }}
      />

      {nft.collectionType === ENFTType.ERC1155 &&
      new BigNumber(nft.amount ?? 1).gt(1) ? (
        <Stack
          position="absolute"
          right="$0"
          bottom="$0"
          px="$2"
          bg="$bgInverse"
          borderRadius="$3"
          borderWidth={2}
          borderColor="$bgApp"
        >
          <SizableText color="$textInverse" size="$bodyLgMedium">
            {`x${nft.amount}`}
          </SizableText>
        </Stack>
      ) : null}
    </>
  );
}

export { CommonAssetImage };
