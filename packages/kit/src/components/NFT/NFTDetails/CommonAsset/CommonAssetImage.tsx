import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Icon, Image, SizableText, Stack, Video } from '@onekeyhq/components';
import { SHOW_NFT_AMOUNT_MAX } from '@onekeyhq/shared/src/consts/walletConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ENFTType, type IAccountNFT } from '@onekeyhq/shared/types/nft';

import { ENFTMediaState, useNFTMediaState } from '../../useNFTMediaState';

import { UnSupportedImageContainer } from './UnSupportedImageContainer';

type IProps = {
  nft: IAccountNFT;
};

const unSupportedImage = ['data:image/svg+xml;'];

function CommonAssetImage(props: IProps) {
  const { nft } = props;
  const imageUri = nft.metadata?.image;
  const { mediaState, handleImageError, handleVideoError } =
    useNFTMediaState(imageUri);

  const isUnSupportedImageInNative = useMemo(
    () =>
      platformEnv.isNative &&
      !!unSupportedImage.find((i) => imageUri?.includes(i)),
    [imageUri],
  );
  if (isUnSupportedImageInNative) {
    return <UnSupportedImageContainer src={imageUri} />;
  }

  const renderMedia = () => {
    switch (mediaState) {
      case ENFTMediaState.Image:
        return (
          <Stack width="100%" height="100%">
            <Image
              src={imageUri}
              w="100%"
              h="100%"
              onError={handleImageError}
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
        );
      case ENFTMediaState.Video:
        return (
          <Video
            source={{ uri: imageUri }}
            controls
            onError={handleVideoError}
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              zIndex: 1,
            }}
          />
        );
      case ENFTMediaState.Fallback:
        return <UnSupportedImageContainer src={imageUri} />;
      default:
        return null;
    }
  };

  return (
    <>
      <Stack width="100%" height="100%" borderRadius={12}>
        {renderMedia()}
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
