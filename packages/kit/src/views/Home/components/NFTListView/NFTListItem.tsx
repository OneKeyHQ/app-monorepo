import { useState } from 'react';

import BigNumber from 'bignumber.js';

import type { IStackProps } from '@onekeyhq/components';
import { Icon, Image, SizableText, Stack, Video } from '@onekeyhq/components';
import { SHOW_NFT_AMOUNT_MAX } from '@onekeyhq/shared/src/consts/walletConsts';
import { ENFTType, type IAccountNFT } from '@onekeyhq/shared/types/nft';

type IProps = {
  nft: IAccountNFT;
  onPress?: (token: IAccountNFT) => void;
  flexBasis: IStackProps['flexBasis'];
};

function NFTListItem(props: IProps) {
  const { nft, onPress, flexBasis } = props;
  const [isVideo, setIsVideo] = useState<boolean>(!!nft.metadata?.image);

  return (
    <Stack
      key={nft.itemId}
      group="nftItem"
      flexBasis={flexBasis}
      focusable
      focusStyle={{
        outlineColor: '$focusRing',
        outlineWidth: 2,
        outlineStyle: 'solid',
        outlineOffset: -2,
      }}
      py="$2.5"
      px="$5"
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
          <Image w="100%" h="100%" borderRadius="$2.5">
            {isVideo ? (
              <Video
                source={{ uri: nft.metadata?.image }}
                onError={() => setIsVideo(false)}
                style={{
                  width: '100%',
                  height: '100%',
                  position: 'absolute',
                  zIndex: 1,
                }}
                autoPlay={false}
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
        <SizableText size="$bodyLgMedium" numberOfLines={1}>
          {nft.metadata?.name ?? '-'}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
          {nft.collectionName}
        </SizableText>
      </Stack>
    </Stack>
  );
}

export { NFTListItem };
