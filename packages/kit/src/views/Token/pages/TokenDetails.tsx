import { useCallback } from 'react';

import {
  Button,
  Divider,
  Heading,
  Icon,
  Image,
  ListItem,
  Page,
  SizableText,
  Stack,
  Toast,
  XGroup,
  XStack,
} from '@onekeyhq/components';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';
import { TxHistoryListView } from '../../Home/components/TxHistoryListView';
import { ETokenPages } from '../router/type';

import type { IHistoryListItemProps } from '../../Home/components/TxHistoryListView/HistoryListItem';

const headerTitle = () => (
  <XStack alignItems="center">
    <Image
      width="$6"
      height="$6"
      source={{
        uri: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/usdc.png',
      }}
    />
    <Heading pl="$2" size="$headingLg">
      USDC
    </Heading>
  </XStack>
);

const data: { title: string; data: IHistoryListItemProps[] }[] = [
  {
    title: 'DEC 20, 2023',
    data: [
      {
        title: 'Send',
        description: {
          prefix: 'To',
          children: 'addr1q...ckw2',
        },
        change: '-1000 USDC',
        avatar: {
          circular: true,
          fallbackIcon: 'ArrowTopSolid',
        },
      },
    ],
  },
  {
    title: 'DEC 19, 2023',
    data: [
      {
        title: 'Receive',
        description: {
          prefix: 'To',
          children: 'addr1q...ckw2',
        },
        change: '+1000 USDC',
        avatar: {
          circular: true,
          fallbackIcon: 'ArrowBottomSolid',
        },
      },
    ],
  },
];

export function TokenDetails() {
  const navigation = useAppNavigation();

  const handleReceivePress = useCallback(() => {
    navigation.push(ETokenPages.Receive);
  }, [navigation]);

  const handleHistoryItemPress = useCallback(() => {
    navigation.push(ETokenPages.History);
  }, [navigation]);

  return (
    <Page scrollEnabled>
      <Page.Header headerTitle={headerTitle} />
      <Page.Body>
        {/* <Alert title="" /> */}
        <Stack px="$5" pb="$5">
          <XStack alignItems="center">
            <SizableText flex={1} color="$textSubdued">
              Balance
            </SizableText>
            <XGroup
              bg="$bgStrong"
              borderRadius="$2"
              separator={<Divider vertical borderColor="$bgApp" />}
            >
              <XStack
                alignItems="center"
                py="$0.5"
                px="$1.5"
                userSelect="none"
                style={{
                  borderCurve: 'continuous',
                }}
              >
                <Image
                  width="$4"
                  height="$4"
                  source={{
                    uri: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
                  }}
                />
                <SizableText pl="$2" size="$bodyMd" color="$textSubdued">
                  0x02b8...eb48
                </SizableText>
              </XStack>
              <Stack
                alignItems="center"
                justifyContent="center"
                py="$0.5"
                px="$1.5"
                hoverStyle={{
                  bg: '$bgHover',
                }}
                pressStyle={{
                  bg: '$bgActive',
                }}
                style={{
                  borderCurve: 'continuous',
                }}
                $platform-native={{
                  hitSlop: {
                    top: 8,
                    bottom: 8,
                  },
                }}
                onPress={() =>
                  Toast.success({
                    title: 'Copied',
                  })
                }
              >
                <Icon size="$4" name="Copy1Outline" color="$iconSubdued" />
              </Stack>
              <Stack
                alignItems="center"
                justifyContent="center"
                py="$0.5"
                px="$1.5"
                hoverStyle={{
                  bg: '$bgHover',
                }}
                pressStyle={{
                  bg: '$bgActive',
                }}
                style={{
                  borderCurve: 'continuous',
                }}
                $platform-native={{
                  hitSlop: {
                    top: 8,
                    bottom: 8,
                    right: 8,
                  },
                }}
              >
                <Icon size="$4" name="ShareOutline" color="$iconSubdued" />
              </Stack>
            </XGroup>
          </XStack>
          <Stack
            $gtMd={{
              flexDirection: 'row',
              alignItems: 'baseline',
              space: '$2',
            }}
          >
            <Heading size="$heading5xl">4000</Heading>
            <SizableText size="$bodyLgMedium">$4,000.00</SizableText>
          </Stack>
          <XStack pt="$5" space="$2.5">
            <Button>Send</Button>
            <Button onPress={handleReceivePress}>Receive</Button>
            <Button>Swap</Button>
            <Button icon="DotHorOutline" pl="$2.5" pr="$0.5" />
          </XStack>
        </Stack>
        <Divider />
        <ListItem
          py="$3.5"
          avatarProps={{
            src: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/usdc.png',
          }}
          title="USDC"
          titleProps={{
            size: '$bodyMdMedium',
          }}
          subtitle="3.77% APR"
          subtitleProps={{
            size: '$bodyLgMedium',
            color: '$textSuccess',
          }}
        >
          <Button variant="primary">Stake</Button>
        </ListItem>
        <Divider mb="$2.5" />
        <TxHistoryListView data={data} onItemPress={handleHistoryItemPress} />
      </Page.Body>
    </Page>
  );
}
