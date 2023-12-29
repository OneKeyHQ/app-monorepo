import { useCallback } from 'react';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  ActionList,
  Button,
  DescriptionList,
  Divider,
  Heading,
  Image,
  Page,
  SizableText,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';

const attributes = [
  {
    traitType: 'Background',
    value: 'Grey blue',
  },
  {
    traitType: 'Body',
    value: 'Puppets',
  },
  {
    traitType: 'Clothes',
    value: 'Caveman vest',
  },
  {
    traitType: 'Eyes',
    value: 'Black',
  },
  {
    traitType: 'Mouth',
    value: 'Golden tooth',
  },
  {
    traitType: 'Head',
    value: 'Dark purple dreadlocks',
  },
  {
    traitType: 'Accessories',
    value: 'Rotten apple',
  },
];

const details: {
  label: string;
  value: string;
  onPress?: () => void;
  iconAfter?: IKeyOfIcons;
}[] = [
  {
    label: 'Collection',
    value: 'X Rabbits Club',
  },
  {
    label: 'Chain',
    value: 'Ethereum',
  },
  {
    label: 'Token ID',
    value: '101525',
  },
  {
    label: 'Token Standard',
    value: 'ERC-721',
  },
  {
    label: 'Contrast Address',
    value: '0x534d...ee04',
    onPress: () =>
      Toast.success({
        title: 'Copied',
      }),
    iconAfter: 'Copy1Outline',
  },
  {
    label: 'Last Updated',
    value: 'Apr 09 2022',
    onPress: () => console.log('external link'),
    iconAfter: 'OpenOutline',
  },
];

export function NFTDetails() {
  const device = 'Touch';

  const headerRight = useCallback(
    () => (
      <ActionList
        title="Actions"
        renderTrigger={
          <HeaderIconButton title="Actions" icon="DotHorOutline" />
        }
        items={[{ label: `Collect to ${device}`, icon: 'InboxOutline' }]}
      />
    ),
    [],
  );

  return (
    <Page scrollEnabled>
      <Page.Header title="X Rabbit #3720" headerRight={headerRight} />
      <Page.Body>
        <Stack
          $gtMd={{
            flexDirection: 'row',
          }}
          pb="$5"
        >
          <Stack
            px="$5"
            pb="$5"
            $gtMd={{
              flexBasis: '33.3333%',
            }}
          >
            <Stack pb="100%">
              <Stack position="absolute" left={0} top={0} bottom={0} right={0}>
                <Image
                  width="100%"
                  height="100%"
                  source={{
                    uri: 'https://xrc-frontend-gyd8dlc0g-xrc.vercel.app/v3_cover.png',
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
                  x2
                </SizableText>
              </Stack>
            </Stack>
            <Button icon="ArrowTopOutline" mt="$5">
              Send
            </Button>
          </Stack>
          <Stack
            px="$5"
            $gtMd={{
              flexBasis: '66.6666%',
            }}
            space="$5"
          >
            {/* Details */}
            <DescriptionList>
              {details.map(({ label, value, onPress, iconAfter }) => (
                <DescriptionList.Item key={label}>
                  <DescriptionList.Item.Key size="$bodyMd" color="$textSubdued">
                    {label}
                  </DescriptionList.Item.Key>
                  <DescriptionList.Item.Value
                    onPress={onPress}
                    iconAfter={iconAfter}
                  >
                    {value}
                  </DescriptionList.Item.Value>
                </DescriptionList.Item>
              ))}
            </DescriptionList>
            {/* Attributes */}
            <Divider />
            <Stack>
              <Heading size="$headingSm">Attributes</Heading>
              <XStack m="$-1" pt="$2.5" flexWrap="wrap">
                {attributes.map(({ traitType, value }) => (
                  <Stack
                    key={traitType}
                    py="$2"
                    px="$3.5"
                    m="$1"
                    bg="$bgStrong"
                    borderRadius="$2"
                    style={{
                      borderCurve: 'continuous',
                    }}
                  >
                    <SizableText size="$bodyMd" color="$textSubdued">
                      {traitType}
                    </SizableText>
                    <SizableText size="$bodyMdMedium">{value}</SizableText>
                  </Stack>
                ))}
              </XStack>
            </Stack>
          </Stack>
        </Stack>
      </Page.Body>
    </Page>
  );
}
