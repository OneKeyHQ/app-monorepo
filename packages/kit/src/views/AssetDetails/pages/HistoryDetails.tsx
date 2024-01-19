import { useCallback } from 'react';

import { StyleSheet } from 'react-native';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Button,
  DescriptionList,
  Divider,
  Heading,
  Icon,
  Image,
  ListItem,
  Page,
  SizableText,
  Toast,
  XStack,
} from '@onekeyhq/components';

const histories: {
  key: string;
  value: string;
  iconAfter?: IKeyOfIcons;
  onPress?: () => void;
  imgUrl?: string;
}[][] = [
  [
    {
      key: 'From',
      value: '0x123456...34567890',
      iconAfter: 'Copy1Outline',
      onPress: () => Toast.success({ title: 'Copied' }),
    },
    {
      key: 'To',
      value: '0x123456...34567890',
      iconAfter: 'Copy1Outline',
      onPress: () => Toast.success({ title: 'Copied' }),
    },
  ],
  [
    {
      key: 'Token',
      value: '1000 USDC',
      imgUrl:
        'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/usdc.png',
    },
    {
      key: 'Token Contrast',
      value: '0xa0b8...eb48',
      iconAfter: 'Copy1Outline',
      onPress: () => Toast.success({ title: 'Copied' }),
    },
  ],
  [
    {
      key: 'Hash',
      value: '0xd878...144f',
      iconAfter: 'Copy1Outline',
      onPress: () => Toast.success({ title: 'Copied' }),
    },
    {
      key: 'Time',
      value: 'Dec 04 2023, 21:33',
    },
  ],
  [
    {
      key: 'Chain',
      value: 'Ethereum',
      imgUrl:
        'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
    },
    {
      key: 'Fee',
      value: '0.00487789 ETH',
    },
    {
      key: 'Nonce',
      value: '138',
    },
  ],
];

function HistoryDetails() {
  const status = 'pending';

  const headerTitle = useCallback(
    () => (
      <XStack alignItems="center">
        <Image
          width="$6"
          height="$6"
          source={{
            uri: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/usdc.png',
          }}
        />
        <Heading pl="$2" size="$headingLg">
          Send
        </Heading>
      </XStack>
    ),
    [],
  );

  return (
    <Page>
      <Page.Header headerTitle={headerTitle} />
      <Page.Body>
        {status === 'pending' && (
          <>
            <ListItem icon="ClockTimeHistoryOutline" title="Pending">
              <Button size="small" variant="tertiary">
                Cancel
              </Button>
              <Button size="small" variant="primary" ml="$1">
                Speed Up
              </Button>
            </ListItem>
            <Divider mb="$5" pt="$3" />
          </>
        )}
        {histories.map((section, index) => (
          <DescriptionList
            mx="$5"
            // space="$0"
            key={index}
            {...(index !== 0 && {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderColor: '$borderSubdued',
              mt: '$4',
              pt: '$4',
            })}
          >
            {section.map((item, itemIndex = index) => (
              <DescriptionList.Item
                key={item.key}
                {...(itemIndex !== 0 &&
                  {
                    // mt: '$2',
                    // pt: '$2',
                    // borderTopWidth: StyleSheet.hairlineWidth,
                    // borderTopColor: '$borderSubdued',
                  })}
                // $gtMd={{
                //   justifyContent: 'flex-start',
                // }}
              >
                <DescriptionList.Item.Key
                // $gtMd={{
                //   flexBasis: '20%',
                // }}
                >
                  {item.key}
                </DescriptionList.Item.Key>
                <XStack alignItems="center">
                  {item.imgUrl && (
                    <Image
                      width="$5"
                      height="$5"
                      source={{
                        uri: item.imgUrl,
                      }}
                      mr="$1.5"
                    />
                  )}
                  <DescriptionList.Item.Value
                    iconAfter={item.iconAfter}
                    onPress={item.onPress}
                  >
                    {item.value}
                  </DescriptionList.Item.Value>
                </XStack>
              </DescriptionList.Item>
            ))}
          </DescriptionList>
        ))}
      </Page.Body>
    </Page>
  );
}

export { HistoryDetails };
