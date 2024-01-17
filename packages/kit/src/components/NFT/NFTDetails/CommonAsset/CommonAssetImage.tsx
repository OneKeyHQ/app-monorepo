import { Image, SizableText, Stack } from '@onekeyhq/components';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

type IProps = {
  nft: IAccountNFT;
};

function CommonAssetImage(props: IProps) {
  const { nft } = props;
  return (
    <>
      <Image
        width="100%"
        height="100%"
        source={{
          uri: nft.metadata.image,
        }}
        style={{
          borderRadius: 12,
        }}
      />
      <SizableText
        size="$bodyLgMedium"
        position="absolute"
        right="$0"
        bottom="$0"
        px="$2"
        bg="$bgInverse"
        color="$textInverse"
        borderRadius="$3"
        borderWidth={2}
        borderColor="$bgApp"
      >
        {`x${nft.amount}`}
      </SizableText>
    </>
  );
}

export { CommonAssetImage };
