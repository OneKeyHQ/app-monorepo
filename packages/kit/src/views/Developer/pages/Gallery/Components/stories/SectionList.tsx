import { useRef } from 'react';

import type { ISectionListRef } from '@onekeyhq/components';
import {
  Button,
  Divider,
  Icon,
  ListItem,
  SectionList,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';

import { NFTDATA, TOKENDATA } from './ListItem';
import { Layout } from './utils/Layout';

const sectionListData = [
  {
    title: 'Main dishes',
    data: ['Pizza', 'Burger', 'Risotto'],
  },
  {
    title: 'Sides',
    data: ['French Fries', 'Onion Rings', 'Fried Shrimps'],
  },
  {
    title: 'Drinks',
    data: ['Water', 'Coke', 'Beer'],
  },
  {
    title: 'Desserts',
    data: ['Cheese Cake', 'Ice Cream'],
  },
];

const stickySectionListData = [
  { title: 'NFT', data: NFTDATA },
  {
    title:
      'TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN',
    data: TOKENDATA,
  },
  { title: 'NFT', data: NFTDATA },
  { title: 'TOKEN', data: TOKENDATA },
];

const SectionListDemo = () => {
  const ref = useRef<ISectionListRef<any>>(null);
  return (
    <SectionList
      h="$60"
      bg="$bg"
      ListHeaderComponentStyle={{
        w: '100%',
        bg: 'blue',
      }}
      ListFooterComponentStyle={{
        h: '$10',
        w: '100%',
        bg: 'red',
      }}
      ref={ref}
      sections={sectionListData}
      renderSectionHeader={({ section: { title } }) => (
        <Stack bg="$bg">
          <SizableText size="$headingXs">{title}</SizableText>
        </Stack>
      )}
      ListHeaderComponent={XStack}
      ListFooterComponent={XStack}
      estimatedItemSize="$10"
      SectionSeparatorComponent={null}
      renderItem={({ item }) => (
        <XStack bg="$borderLight">
          <SizableText>{item}</SizableText>
          <Divider />
          <XStack space="$8">
            <Button
              onPress={() => {
                const sectionList = ref?.current;
                sectionList?.scrollToLocation?.({
                  sectionIndex: 1,
                  itemIndex: 0,
                  animated: true,
                });
              }}
            >
              Scroll to `SIDES` section
            </Button>
          </XStack>
        </XStack>
      )}
    />
  );
};

const StickySectionListDemo = () => {
  const ref = useRef<ISectionListRef<any>>(null);
  return (
    <SectionList
      ref={ref}
      h={500}
      sections={stickySectionListData}
      renderSectionHeader={({ section: { title }, index }) => (
        <SectionList.SectionHeader title={title}>
          {index !== 0 ? null : (
            <SizableText numberOfLines={1}>
              {title} (custom the children of section header)
            </SizableText>
          )}
        </SectionList.SectionHeader>
      )}
      estimatedItemSize="$10"
      stickySectionHeadersEnabled
      renderItem={({
        item,
      }: {
        item: {
          title: string;
          subtitle: string;
          src: string;
          networkSrc?: string;
          amount?: string;
          value?: string;
        };
      }) => (
        <ListItem
          key={item.title}
          title={item.title}
          subtitle={item.subtitle}
          subtitleProps={{
            numberOfLines: 1,
          }}
          avatarProps={{
            src: item.src,
            fallbackProps: {
              bg: '$bgStrong',
              justifyContent: 'center',
              alignItems: 'center',
              children: <Icon name="ImageMountainSolid" />,
            },
            cornerImageProps: item.networkSrc
              ? { src: item.networkSrc }
              : undefined,
          }}
          onPress={() => {
            console.log('clicked');
          }}
        >
          <ListItem.Text
            align="right"
            primary={item.amount}
            secondary={item.value}
          />
        </ListItem>
      )}
    />
  );
};

const SectionListGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Styled and cleared the SectionSeparatorComponent SectionList',
        element: <SectionListDemo />,
      },
      {
        title: 'Sticky SectionHeader SectionList',
        element: <StickySectionListDemo />,
      },
    ]}
  />
);

export default SectionListGallery;
