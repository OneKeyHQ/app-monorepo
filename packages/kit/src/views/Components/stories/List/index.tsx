/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import React, { ComponentProps } from 'react';

import { ListRenderItemInfo } from 'react-native';

import {
  Badge,
  Box,
  HStack,
  Icon,
  IconButton,
  Image,
  Pressable,
  ScrollView,
  Switch,
  Text,
  VStack,
} from '@onekeyhq/components';

import { FlatList, ListItem, SectionList } from './ListView';
import Footer from './ListView/Footer';
import SectionHeader from './ListView/SectionHeader';

const TokenListData = [
  {
    id: 'bd7acbea-c1b1-46c2-aed5-3ad53abb28ba',
    type: 'text',
    label: 'Label',
    description: 'Description...',
    src: 'https://onekey-asset.com/assets/btc/btc.png',
  },
  {
    id: '3ac68afc-c605-48d3-a4f8-fbd91aa97f63',
    type: 'text',
    label: 'Label',
    description: 'Description...',
    src: 'https://onekey-asset.com/assets/eth/eth.png',
  },
  {
    id: '58694a0f-3da1-471f-bd96-145571e29d72',
    type: 'text',
    label: 'Label',
    description: 'Description...',
    src: 'https://onekey-asset.com/assets/bsc/bsc.png',
  },
];

const SettingListData = [
  {
    header: {
      title: 'group 1',
      // actions: [{ label: 'Action', onPress: () => console.log('clicked') }],
    },
    footer:
      'Lorem Ipsum is simply dummy text of the printing and typesetting industry.',
    index: 0,
    data: [
      {
        iconName: 'ColorSwatchOutline',
        label: 'Item 1',
        rightContent: <Icon name="ChevronRightSolid" size={20} />,
      },
      {
        iconName: 'CreditCardOutline',
        label: 'Item 2',
        rightContent: <Icon name="ChevronRightSolid" size={20} />,
      },
      {
        iconName: 'CubeTransparentOutline',
        label: 'Item 3',
        rightContent: <Icon name="ChevronRightSolid" size={20} />,
      },
    ],
  },
  {
    header: {
      title: 'group 2',
      // actions: [{ label: 'Action', onPress: () => console.log('clicked') }],
    },
    index: 1,
    data: [
      {
        iconName: 'ColorSwatchOutline',
        label: 'Item 1',
        // rightContent: <Switch />,
        rightContent: <Icon name="ChevronRightSolid" size={20} />,
      },
      {
        iconName: 'CreditCardOutline',
        label: 'Item 2',
        // rightContent: <Switch />,
        rightContent: <Icon name="ChevronRightSolid" size={20} />,
      },
      {
        iconName: 'CubeTransparentOutline',
        label: 'Item 3',
        // rightContent: <Switch />,
        rightContent: <Icon name="ChevronRightSolid" size={20} />,
      },
    ],
  },
];

const MarketData = [
  {
    order: 1,
    src: 'https://onekey-asset.com/assets/btc/btc.png',
    tokenShortName: 'BTC',
    tokenName: 'Bitcoin',
    price: '$20000.00',
    priceChange: '+0.79%',
    volume: '$55,943,992,470',
    marketCap: '$358,570,171,104',
  },
  {
    order: 1,
    src: 'https://onekey-asset.com/assets/eth/eth.png',
    tokenShortName: 'BTC',
    tokenName: 'Bitcoin',
    price: '$20000.00',
    priceChange: '+0.79%',
    volume: '$55,943,992,470',
    marketCap: '$358,570,171,104',
  },
  {
    order: 1,
    src: 'https://onekey-asset.com/assets/bsc/bsc.png',
    tokenShortName: 'BTC',
    tokenName: 'Bitcoin',
    price: '$20000.00',
    priceChange: '+0.79%',
    volume: '$55,943,992,470',
    marketCap: '$358,570,171,104',
  },
];

const ListGallery = () => (
  <ScrollView bgColor="background-default">
    <VStack space={8} w="960" maxW="100%" mx="auto">
      <Box p={4} bgColor="background-default">
        <FlatList
          header={{
            title: 'Header',
            actions: [
              { label: 'Refresh', onPress: () => console.log('clicked') },
            ],
          }}
          data={TokenListData}
          renderItem={({ item }: ListRenderItemInfo<any>) => (
            <ListItem onPress={() => console.log('clicked')} flex={1}>
              <ListItem.Column image={{ src: item.src }} />
              <ListItem.Column
                text={{
                  label: item.label,
                  description: item.description,
                }}
                flex={1}
              />
              <ListItem.Column
                text={{
                  label: item.label,
                  labelProps: { textAlign: 'right' },
                  description: (
                    <Badge size="sm" type="success" title={item.description} />
                  ),
                }}
                alignItems="flex-end"
              />
            </ListItem>
          )}
          footer="Lorem Ipsum is simply dummy text of the printing and typesetting industry."
          keyExtractor={(item: any) => item.id}
        />
      </Box>

      <Box p={4} bgColor="background-default">
        <SectionList
          header={{
            title: 'Header',
          }}
          sections={SettingListData}
          renderSectionHeader={({ section, section: { header } }) => (
            <>
              <SectionHeader
                title={header.title}
                actions={header.actions}
                mt={section.index !== 0 ? '16px' : 0}
              />
            </>
          )}
          renderSectionFooter={({ section: { footer } }) => (
            <>{footer ? <Footer footer={footer} /> : null}</>
          )}
          renderItem={({ item }) => (
            <ListItem onPress={() => console.log('clicked')} flex={1}>
              <ListItem.Column icon={{ name: item.iconName }} />
              <ListItem.Column text={{ label: item.label }} flex={1} />
              <ListItem.Column>{item.rightContent}</ListItem.Column>
            </ListItem>
          )}
          keyExtractor={(item, index) => item + index}
        />
      </Box>

      <Box p={4} bgColor="background-default">
        <FlatList
          data={MarketData}
          showDivider
          customHeader={
            <>
              <ListItem>
                <ListItem.Column
                  text={{
                    label: '#',
                    labelProps: {
                      typography: 'Subheading',
                      color: 'text-subdued',
                      textAlign: 'center',
                    },
                  }}
                  w="64px"
                />
                <ListItem.Column
                  text={{
                    label: 'NAME',
                    labelProps: {
                      typography: 'Subheading',
                      color: 'text-subdued',
                    },
                  }}
                  w="124px"
                />
                <ListItem.Column
                  text={{
                    label: 'PRICE',
                    labelProps: {
                      typography: 'Subheading',
                      color: 'text-subdued',
                      textAlign: 'right',
                    },
                  }}
                  w="96px"
                />
                <ListItem.Column
                  text={{
                    label: '24H%',
                    labelProps: {
                      typography: 'Subheading',
                      color: 'text-subdued',
                      textAlign: 'right',
                    },
                  }}
                  w="80px"
                />
                <ListItem.Column
                  text={{
                    label: '24H VOLUME%',
                    labelProps: {
                      typography: 'Subheading',
                      color: 'text-subdued',
                      textAlign: 'right',
                    },
                  }}
                  flex={1}
                  minW="120px"
                />
                <ListItem.Column
                  text={{
                    label: 'MARKET CAP',
                    labelProps: {
                      typography: 'Subheading',
                      color: 'text-subdued',
                      textAlign: 'right',
                    },
                  }}
                  flex={1}
                  minW="120px"
                />
                <ListItem.Column
                  text={{
                    label: '7 DAYS',
                    labelProps: {
                      typography: 'Subheading',
                      color: 'text-subdued',
                      textAlign: 'right',
                    },
                  }}
                  minW="80px"
                />
                <ListItem.Column>
                  <Box w="28px" />
                </ListItem.Column>
              </ListItem>
            </>
          }
          renderItem={({ item }: ListRenderItemInfo<any>) => (
            <ListItem onPress={() => console.log('clicked')} flex={1}>
              <ListItem.Column>
                <HStack alignItems="center" w="64px" justifyContent="center">
                  <Pressable
                    p={1}
                    rounded="full"
                    _hover={{ bgColor: 'surface-hovered' }}
                    _pressed={{ bgColor: 'surface-pressed' }}
                  >
                    <Icon name="StarSolid" size={20} />
                  </Pressable>
                  <Text typography="Body2Strong" color="text-subdued" ml={1}>
                    {item.order}
                  </Text>
                </HStack>
              </ListItem.Column>
              <ListItem.Column>
                <HStack w="124px" alignItems="center" space={3}>
                  <Image src={item.src} size={8} />
                  <Box>
                    <Text typography="Body2Strong">{item.tokenShortName}</Text>
                    <Text typography="Body2" color="text-subdued">
                      {item.tokenName}
                    </Text>
                  </Box>
                </HStack>
              </ListItem.Column>
              <ListItem.Column
                text={{
                  label: item.price,
                  labelProps: { textAlign: 'right' },
                  size: 'sm',
                }}
                w="96px"
              />
              <ListItem.Column
                text={{
                  label: item.priceChange,
                  labelProps: { color: 'text-success', textAlign: 'right' },
                  size: 'sm',
                }}
                w="80px"
              />
              <ListItem.Column
                text={{
                  label: item.volume,
                  labelProps: { textAlign: 'right' },
                  size: 'sm',
                }}
                flex={1}
                minW="120px"
              />
              <ListItem.Column
                text={{
                  label: item.marketCap,
                  labelProps: { textAlign: 'right' },
                  size: 'sm',
                }}
                flex={1}
                minW="120px"
              />
              <ListItem.Column>
                <Box
                  w="80px"
                  h="40px"
                  rounded="xl"
                  bgColor="surface-neutral-default"
                />
              </ListItem.Column>
              <ListItem.Column>
                <IconButton
                  size="xs"
                  name="DotsVerticalSolid"
                  type="plain"
                  circle
                />
              </ListItem.Column>
            </ListItem>
          )}
          keyExtractor={(item: any) => item.id}
        />
      </Box>
    </VStack>
  </ScrollView>
);

export default ListGallery;
