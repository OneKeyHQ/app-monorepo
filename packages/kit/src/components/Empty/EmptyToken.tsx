import {
  Image,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';

function EmptyTokenItem({
  image,
  content,
  tableLayout,
}: {
  image: string;
  content: string;
  tableLayout?: boolean;
}) {
  return (
    <Stack
      flexBasis="50%"
      borderRadius="$4"
      overflow="hidden"
      {...(tableLayout && {
        position: 'unset',
        flexBasis: 'unset',
        width: '$64',
        height: '$64',
      })}
    >
      <Stack pb="100%">
        <Stack position="absolute" left={0} top={0} right={0} bottom={0}>
          <Image w="100%" h="100%" source={{ uri: image }} />
          <SizableText size="$headingMd" position="absolute" left={20} top={16}>
            {content}
          </SizableText>
        </Stack>
      </Stack>
    </Stack>
  );
}

function EmptyToken() {
  const tableLayout = useMedia().gtLg;

  return (
    <Stack padding="$5">
      <SizableText size="$bodyLg" color="$textSubdued">
        You have no tokens yet.
      </SizableText>

      <XStack space={10} mt="$5">
        <EmptyTokenItem
          tableLayout={tableLayout}
          image={require('@onekeyhq/kit/assets/buy_assets.png')}
          content="Buy with trusted providers"
        />
        <EmptyTokenItem
          tableLayout={tableLayout}
          image={require('@onekeyhq/kit/assets/receive_assets.png')}
          content="Receive Tokens or NFTs"
        />
      </XStack>
    </Stack>
  );
  // TODO: App review mode
}

export { EmptyToken };
