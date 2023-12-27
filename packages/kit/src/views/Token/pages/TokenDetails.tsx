import {
  Heading,
  Image,
  Page,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';

const headerTitle = () => (
  <XStack alignItems="center">
    <Image
      width="$6"
      height="$6"
      source={{
        uri: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
      }}
    />
    <Heading pl="$2" size="$headingLg">
      ETH
    </Heading>
  </XStack>
);

export function TokenDetails() {
  return (
    <Page>
      <Page.Header headerTitle={headerTitle} />
      <Page.Body px="$5">
        <SizableText>Balance</SizableText>
        <Stack
          $gtMd={{
            flexDirection: 'row',
            alignItems: 'baseline',
            space: '$2',
          }}
        >
          <Heading size="$heading5xl">2.35</Heading>
          <SizableText color="$textSubdued" size="$bodyLgMedium">
            $3,836.97
          </SizableText>
        </Stack>
      </Page.Body>
    </Page>
  );
}
