import { Image, SizableText, Stack, XStack } from '@onekeyhq/components';

function EmptyToken() {
  return (
    <Stack>
      <SizableText size="$bodyLg" color="$textSubdued">
        You have no tokens yet.
      </SizableText>

      <XStack space={10}>
        <Stack>
          <Image
            w="100%"
            h="100%"
            source={require('@onekeyhq/kit/assets/buy_assets.png')}
            style={{
              borderRadius: 12,
            }}
          />
        </Stack>
        <Stack>
          <Image
            w="100%"
            h="100%"
            source={require('@onekeyhq/kit/assets/receive_assets.png')}
            style={{
              borderRadius: 12,
            }}
          />
        </Stack>
      </XStack>
    </Stack>
  );
  // TODO: App review mode
}

export { EmptyToken };
