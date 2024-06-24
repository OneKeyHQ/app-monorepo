import { useState } from 'react';

import BigNumber from 'bignumber.js';

import { Icon, Image, SizableText, Stack, Video } from '@onekeyhq/components';
import { ENFTType, type IAccountNFT } from '@onekeyhq/shared/types/nft';

type IProps = {
  nft: IAccountNFT;
};

function CommonAssetImage(props: IProps) {
  const { nft } = props;
  const [isVideo, setIsVideo] = useState<boolean>(true);
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
      >
        {isVideo ? (
          <Video
            source={{ uri: nft.metadata?.image }}
            controls
            onError={() => setIsVideo(false)}
            style={{
              width: '100%',
              height: '100%',
            }}
          />
        ) : (
          <Image.Source src={nft.metadata?.image} />
        )}
        <Image.Fallback
          bg="$bgStrong"
          justifyContent="center"
          alignItems="center"
        >
          <Icon name="ImageSquareWavesOutline" color="$iconDisabled" />
        </Image.Fallback>
      </Image>

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
