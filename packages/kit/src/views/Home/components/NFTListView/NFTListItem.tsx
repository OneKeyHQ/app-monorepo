import { memo } from 'react';

import BigNumber from 'bignumber.js';

import type { IStackProps } from '@onekeyhq/components';
import {
  Icon,
  Image,
  SizableText,
  Stack,
  Video,
  XStack,
} from '@onekeyhq/components';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { useNFTMediaFallback } from '@onekeyhq/kit/src/components/NFT/hooks/useNFTMediaFallback';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { SHOW_NFT_AMOUNT_MAX } from '@onekeyhq/shared/src/consts/walletConsts';
import { ENFTType, type IAccountNFT } from '@onekeyhq/shared/types/nft';

type IProps = {
  nft: IAccountNFT;
  onPress?: (token: IAccountNFT) => void;
  flexBasis: IStackProps['flexBasis'];
  isAllNetworks?: boolean;
};

function BasicNFTListItem(props: IProps) {
  const { nft, onPress, isAllNetworks } = props;
  const image = nft.metadata?.image;
  const { kind: mediaKind, onError: handleMediaError } =
    useNFTMediaFallback(image);
  const { network } = useAccountData({ networkId: nft.networkId });

  const mediaFallback = (
    <Image.Fallback
      w="100%"
      h="100%"
      borderRadius="$2.5"
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
      // The card's onPress owns taps: keep the native player out of touch
      // targeting (Android drops presses that resolve to media3's non-React
      // view ids).
      <Stack bg="$bgApp" w="100%" h="100%" pointerEvents="none">
        <Video
          onError={handleMediaError}
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            zIndex: 1,
          }}
          autoPlay={false}
          muted
          source={{ uri: image }}
        />
      </Stack>
    );
  } else if (mediaKind === 'image' && image) {
    mediaContent = (
      <Stack bg="$bgApp" w="100%" h="100%">
        <Image
          w="100%"
          h="100%"
          borderRadius="$2.5"
          resizeWidth={160}
          source={{ uri: image }}
          onError={handleMediaError}
          fallback={mediaFallback}
        />
      </Stack>
    );
  }

  return (
    <Stack
      key={nft.itemId}
      group="nftItem"
      flex={1}
      focusable
      focusVisibleStyle={{
        outlineColor: '$focusRing',
        outlineWidth: 2,
        outlineStyle: 'solid',
        outlineOffset: -2,
      }}
      p="$2.5"
      borderRadius="$4"
      onPress={() => {
        onPress?.(nft);
      }}
      userSelect="none"
    >
      <Stack
        pb="100%"
        $group-nftItem-hover={{
          opacity: 0.8,
        }}
      >
        <Stack position="absolute" left={0} top={0} right={0} bottom={0}>
          {mediaContent}
          {nft.collectionType === ENFTType.ERC1155 &&
          new BigNumber(nft.amount ?? 1).gt(1) ? (
            <Stack
              borderRadius="$2.5"
              position="absolute"
              right="$0"
              bottom="$0"
              px="$2"
              bg="$bgInverse"
              borderWidth={2}
              borderColor="$bgApp"
            >
              <SizableText size="$bodyMdMedium" color="$textInverse">
                x
                {new BigNumber(nft.amount).gt(SHOW_NFT_AMOUNT_MAX)
                  ? `${SHOW_NFT_AMOUNT_MAX}+`
                  : nft.amount}
              </SizableText>
            </Stack>
          ) : null}
        </Stack>
      </Stack>
      <Stack mt="$2">
        <XStack alignItems="center" justifyContent="space-between">
          <SizableText
            size="$bodySm"
            color="$textSubdued"
            minWidth={0}
            flex={1}
            numberOfLines={1}
            pr="$2"
          >
            {nft.collectionName || '-'}
          </SizableText>
          {isAllNetworks ? (
            <NetworkAvatar networkId={network?.id} size="$3.5" />
          ) : null}
        </XStack>
        <SizableText size="$bodyLgMedium" numberOfLines={1}>
          {nft.metadata?.name || '-'}
        </SizableText>
      </Stack>
    </Stack>
  );
}

export const NFTListItem = memo(BasicNFTListItem);
