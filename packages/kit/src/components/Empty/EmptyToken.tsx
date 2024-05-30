import type { IImageProps } from '@onekeyhq/components';
import { Image, SizableText, Stack, XStack } from '@onekeyhq/components';

type IProps = {
  isBuyTokenSupported?: boolean;
  onBuy?: () => void;
  onReceive?: () => void;
};

function EmptyTokenItem({
  image,
  content,
  onPress,
}: {
  image: IImageProps['source'];
  content: string;
  tableLayout?: boolean;
  onPress?: () => void;
}) {
  return (
    <Stack flexBasis="50%" maxWidth="$64" p="$2.5" onPress={onPress}>
      <Stack pb="100%">
        <Stack position="absolute" left={0} top={0} right={0} bottom={0}>
          <Image w="100%" h="100%" source={image} borderRadius="$3" />
          <SizableText
            size="$headingMd"
            color="$blackA12"
            position="absolute"
            left="$5"
            top="$4"
            right="$5"
          >
            {content}
          </SizableText>
        </Stack>
      </Stack>
    </Stack>
  );
}

function EmptyToken(props: IProps) {
  const { onBuy, onReceive, isBuyTokenSupported } = props;
  return (
    <Stack py="$2">
      <SizableText size="$bodyLg" color="$textSubdued" px="$5">
        You have no tokens yet.
      </SizableText>

      <XStack mt="$2.5" px="$2.5">
        {isBuyTokenSupported ? (
          <EmptyTokenItem
            image={require('@onekeyhq/kit/assets/buy_assets.png')}
            content="Buy with trusted providers"
            onPress={onBuy}
          />
        ) : null}

        <EmptyTokenItem
          image={require('@onekeyhq/kit/assets/receive_assets.png')}
          content="Receive Tokens or NFTs"
          onPress={onReceive}
        />
      </XStack>
    </Stack>
  );
  // TODO: App review mode
}

export { EmptyToken };
