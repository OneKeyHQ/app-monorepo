import { useCallback, useEffect, useMemo, useState } from 'react';

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

enum EMediaState {
  Image = 'image',
  Video = 'video',
  Unsupported = 'unsupported',
}

function CommonAssetImage(props: IProps) {
  const { nft } = props;
  const [mediaState, setMediaState] = useState<EMediaState>(EMediaState.Image);

  // Reset mediaState when nft changes (e.g. FlatList cell recycling)
  useEffect(() => {
    setMediaState(EMediaState.Image);
  }, [nft.metadata?.image]);

  const handleImageError = useCallback(() => {
    setMediaState(EMediaState.Video);
  }, []);

  const handleVideoError = useCallback(() => {
    setMediaState(EMediaState.Unsupported);
  }, []);

  const isUnSupportedImageInNative = useMemo(
    () =>
      platformEnv.isNative &&
      !!unSupportedImage.find((i) => nft.metadata?.image?.includes(i)),
    [nft.metadata?.image],
  );
  if (isUnSupportedImageInNative) {
    return <UnSupportedImageContainer src={nft.metadata?.image} />;
  }

  const renderMedia = () => {
    switch (mediaState) {
      case EMediaState.Image:
        return (
          <Stack width="100%" height="100%">
            <Image
              src={nft.metadata?.image}
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
      case EMediaState.Video:
        return (
          <Video
            source={{ uri: nft.metadata?.image }}
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
      case EMediaState.Unsupported:
        return <UnSupportedImageContainer src={nft.metadata?.image} />;
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
