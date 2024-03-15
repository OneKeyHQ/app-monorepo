import { Icon, Image, SizableText, Stack } from '@onekeyhq/components';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

type IProps = {
  nft: IAccountNFT;
  onPress?: (token: IAccountNFT) => void;
};

function NFTListItem(props: IProps) {
  const { nft, onPress } = props;

  return (
    <Stack
      key={nft.itemId}
      group="nftItem"
      flexBasis="50%"
      $gtSm={{
        flexBasis: '33.333333%',
      }}
      $gtLg={{
        flexBasis: '25%',
      }}
      $gtXl={{
        flexBasis: '16.666666%',
      }}
      $gt2xl={{
        flexBasis: '14.2857142857%',
      }}
      focusable
      focusStyle={{
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
          <Image w="100%" h="100%" borderRadius="$2.5">
            <Image.Source src={nft.metadata?.image} />
            <Image.Fallback
              bg="$bgStrong"
              justifyContent="center"
              alignItems="center"
            >
              <Icon name="ImageSquareWavesOutline" />
            </Image.Fallback>
          </Image>
          {Number.parseInt(nft.amount, 10) > 1 && (
            <SizableText
              position="absolute"
              right="$0"
              bottom="$0"
              size="$bodyMdMedium"
              px="$2"
              bg="$bgInverse"
              color="$textInverse"
              borderRadius="$2.5"
              borderWidth={2}
              borderColor="$bgApp"
            >
              x{nft.amount}
            </SizableText>
          )}
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
