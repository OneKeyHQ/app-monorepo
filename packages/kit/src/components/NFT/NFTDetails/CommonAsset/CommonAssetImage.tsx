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
  const image = nft.metadata?.image;
  const [isVideo, setIsVideo] = useState<boolean>(!!image);

  const isUnSupportedImageInNative = useMemo(
    () =>
      platformEnv.isNative &&
      !!unSupportedImage.find((i) => image?.includes(i)),
    [image],
  );
  if (isUnSupportedImageInNative) {
    return <UnSupportedImageContainer src={nft.metadata?.image} />;
  }

  return (
    <>
      <Stack width="100%" height="100%" borderRadius={12}>
        {isVideo && image ? (
          <Video
            source={{ uri: image }}
            controls
            onError={() => setIsVideo(false)}
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              zIndex: 1,
            }}
          />
        ) : (
          <Stack width="100%" height="100%">
            <Image
              src={nft.metadata?.image}
              w="100%"
              h="100%"
              resizeWidth={480}
              fallback={
                <Image.Fallback
                  w="100%"
                  h="100%"
                  bg="$bgStrong"
                  justifyContent="center"
                  alignItems="center"
                >
                  <Icon name="ImageSquareWavesOutline" color="$iconDisabled" />
                </Image.Fallback>
              }
            />
          </Stack>
        )}
      </Stack>

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
