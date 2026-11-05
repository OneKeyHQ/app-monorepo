import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Icon, Image, SizableText, Stack, Video } from '@onekeyhq/components';
import { useNFTMediaFallback } from '@onekeyhq/kit/src/components/NFT/hooks/useNFTMediaFallback';
import { SHOW_NFT_AMOUNT_MAX } from '@onekeyhq/shared/src/consts/walletConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { ENFTType, type IAccountNFT } from '@onekeyhq/shared/types/nft';

type IProps = {
  nft: IAccountNFT;
};

function CommonAssetImage(props: IProps) {
  const { nft } = props;
  const image = nft.metadata?.image;
  const imageSource = useMemo(() => {
    if (
      !platformEnv.isNativeAndroid ||
      !image ||
      !/^data:image\/svg\+xml[;,]/i.test(image)
    ) {
      return image;
    }
    const comma = image.indexOf(',');
    if (comma < 0 || comma > 256) return undefined;
    if (/;base64$/i.test(image.slice(0, comma))) return image;

    // Android's data URI loader requires base64; keep the original URI for media fallback identity.
    const maxBytes = 8 * 1024 * 1024;
    if (image.length - comma - 1 > maxBytes * 3) return undefined;
    try {
      // A data URI is not form data: literal '+' must remain unchanged.
      const svg = decodeURIComponent(image.slice(comma + 1));
      if (svg.length > maxBytes || /[\uD800-\uDFFF]/u.test(svg))
        return undefined;
      const bytes = bufferUtils.utf8ToBytes(svg);
      if (bytes.length > maxBytes) return undefined;
      return `data:image/svg+xml;base64,${bufferUtils.bytesToBase64(bytes)}`;
    } catch {
      return undefined;
    }
  }, [image]);
  const { kind: mediaKind, onError: handleMediaError } =
    useNFTMediaFallback(image);

  const mediaFallback = (
    <Image.Fallback
      w="100%"
      h="100%"
      bg="$bgStrong"
      justifyContent="center"
      alignItems="center"
    >
      <Icon name="ImageSquareWavesOutline" color="$iconDisabled" />
    </Image.Fallback>
  );

  let mediaContent = mediaFallback;
  if (mediaKind === 'video' && image) {
    mediaContent = (
      <Video
        source={{ uri: image }}
        controls
        onError={handleMediaError}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          zIndex: 1,
        }}
      />
    );
  } else if (mediaKind === 'image' && imageSource) {
    mediaContent = (
      <Stack width="100%" height="100%">
        <Image
          src={imageSource}
          w="100%"
          h="100%"
          resizeWidth={480}
          onError={handleMediaError}
          fallback={mediaFallback}
        />
      </Stack>
    );
  }

  return (
    <>
      <Stack width="100%" height="100%" borderRadius={12}>
        {mediaContent}
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
