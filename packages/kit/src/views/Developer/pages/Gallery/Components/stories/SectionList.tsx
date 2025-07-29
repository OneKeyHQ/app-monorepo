import { useCallback, useRef, useState } from 'react';

import type { ISectionListRef } from '@onekeyhq/components';
import {
  Button,
  Divider,
  Icon,
  SectionList,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

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
  { title: 'NFT', data: NFTDATA },
  {
    title:
      'TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN',
    data: TOKENDATA,
  },
  { title: 'NFT', data: NFTDATA },
  { title: 'TOKEN', data: TOKENDATA },
  { title: 'NFT', data: NFTDATA },
  {
    title:
      'TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN',
    data: TOKENDATA,
  },
  { title: 'NFT', data: NFTDATA },
  { title: 'TOKEN', data: TOKENDATA },
  { title: 'NFT', data: NFTDATA },
  {
    title:
      'TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN',
    data: TOKENDATA,
  },
  { title: 'NFT', data: NFTDATA },
  { title: 'TOKEN', data: TOKENDATA },
  { title: 'NFT', data: NFTDATA },
  {
    title:
      'TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN TOKEN',
    data: TOKENDATA,
  },
  { title: 'NFT', data: NFTDATA },
  { title: 'TOKEN', data: TOKENDATA },
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
          <XStack gap="$8">
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
      initialScrollIndex={40}
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

const OnEndReachedSectionListDemo = () => {
  const [sections, setSections] = useState([
    {
      title: 'Section 1',
      data: Array.from({ length: 10 }, (_, i) => `Item ${i + 1}`),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [loadCount, setLoadCount] = useState(1);

  const handleEndReached = useCallback(async () => {
    if (loading) return;

    setLoading(true);
    console.log('onEndReached triggered');

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const newSectionIndex = loadCount + 1;
    const newSection = {
      title: `Section ${newSectionIndex}`,
      data: Array.from({ length: 10 }, (_, i) => `Item ${i + 1}`),
    };

    setSections((prev) => [...prev, newSection]);
    setLoadCount(newSectionIndex);
    setLoading(false);
  }, [loading, loadCount]);

  return (
    <SectionList
      h={400}
      sections={sections}
      renderSectionHeader={({ section: { title } }) => (
        <Stack bg="$bgSubtle" p="$2">
          <SizableText size="$headingXs" color="$textSubdued">
            {title}
          </SizableText>
        </Stack>
      )}
      renderItem={({ item }) => (
        <Stack
          p="$3"
          borderBottomWidth="$px"
          borderBottomColor="$borderSubdued"
        >
          <SizableText>{item}</SizableText>
        </Stack>
      )}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        loading ? (
          <Stack p="$4" alignItems="center">
            <SizableText color="$textSubdued">Loading more...</SizableText>
          </Stack>
        ) : null
      }
      estimatedItemSize="$10"
    />
  );
};

const SectionListGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="SectionList"
    elements={[
      {
        title: 'Styled and cleared the SectionSeparatorComponent SectionList',
        element: <SectionListDemo />,
      },
      {
        title: 'Sticky SectionHeader SectionList',
        element: <StickySectionListDemo />,
      },
      {
        title: 'SectionList with onEndReached Example',
        element: <OnEndReachedSectionListDemo />,
      },
    ]}
  />
);

export default SectionListGallery;
