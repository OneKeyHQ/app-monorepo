import { memo, useCallback, useState } from 'react';

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
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { SHOW_NFT_AMOUNT_MAX } from '@onekeyhq/shared/src/consts/walletConsts';
import { ENFTType, type IAccountNFT } from '@onekeyhq/shared/types/nft';

enum EMediaState {
  Image = 'image',
  Video = 'video',
  Fallback = 'fallback',
}

type IProps = {
  nft: IAccountNFT;
  onPress?: (token: IAccountNFT) => void;
  flexBasis: IStackProps['flexBasis'];
  isAllNetworks?: boolean;
};

function BasicNFTListItem(props: IProps) {
  const { nft, onPress, isAllNetworks } = props;
  const { network } = useAccountData({ networkId: nft.networkId });
  const [mediaState, setMediaState] = useState<EMediaState>(EMediaState.Image);

  const handleImageError = useCallback(() => {
    setMediaState(EMediaState.Video);
  }, []);

  const handleVideoError = useCallback(() => {
    setMediaState(EMediaState.Fallback);
  }, []);

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
          <Stack bg="$bgApp" w="100%" h="100%">
            {mediaState === EMediaState.Image ? (
              <Image
                w="100%"
                h="100%"
                borderRadius="$2.5"
                source={{ uri: nft.metadata?.image }}
                onError={handleImageError}
                fallback={
                  <Image.Fallback
                    w="100%"
                    h="100%"
                    borderRadius="$2.5"
                    bg="$bgStrong"
                    justifyContent="center"
                    alignItems="center"
                  >
                    <Icon
                      name="ImageSquareWavesOutline"
                      color="$iconDisabled"
                    />
                  </Image.Fallback>
                }
              />
            ) : null}
            {mediaState === EMediaState.Video ? (
              <Video
                onError={handleVideoError}
                style={{
                  width: '100%',
                  height: '100%',
                }}
                autoPlay={false}
                source={{ uri: nft.metadata?.image }}
              />
            ) : null}
            {mediaState === EMediaState.Fallback ? (
              <Stack
                w="100%"
                h="100%"
                borderRadius="$2.5"
                bg="$bgStrong"
                justifyContent="center"
                alignItems="center"
              >
                <Icon name="ImageSquareWavesOutline" color="$iconDisabled" />
              </Stack>
            ) : null}
          </Stack>
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
