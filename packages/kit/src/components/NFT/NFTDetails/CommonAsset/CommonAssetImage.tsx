import { useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import { Icon, Image, SizableText, Stack, Video } from '@onekeyhq/components';
import { SHOW_NFT_AMOUNT_MAX } from '@onekeyhq/shared/src/consts/walletConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ENFTType, type IAccountNFT } from '@onekeyhq/shared/types/nft';

import { UnSupportedImageContainer } from './UnSupportedImageContainer';

type IProps = {
  nft: IAccountNFT;
};

const unSupportedImage = ['data:image/svg+xml;'];

function CommonAssetImage(props: IProps) {
  const { nft } = props;
  const [isVideo, setIsVideo] = useState<boolean>(true);

  const isUnSupportedImageInNative = useMemo(
    () =>
      platformEnv.isNative &&
      !!unSupportedImage.find((i) => nft.metadata?.image.includes(i)),
    [nft.metadata?.image],
  );
  if (isUnSupportedImageInNative) {
    return <UnSupportedImageContainer src={nft.metadata?.image} />;
  }

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
            x
            {new BigNumber(nft.amount).gt(SHOW_NFT_AMOUNT_MAX)
              ? `${SHOW_NFT_AMOUNT_MAX}+`
              : nft.amount}
          </SizableText>
        </Stack>
      ) : null}
    </>
  );
}

export { CommonAssetImage };
