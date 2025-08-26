import { useRef, useState } from 'react';

import { useAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { StyleSheet } from 'react-native';

import {
  Button,
  Carousel,
  Checkbox,
  Select,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ICarouselInstance } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

// Persistent atom for storing default index value
const defaultIndexAtom = atomWithStorage('carousel-gallery-default-index', 0);

const data = [
  {
    type: 'onekey-pro',
  },
  {
    type: 'image',
    url: 'https://images.unsplash.com/photo-1492724441997-5dc865305da7',
  },
  {
    type: 'image',
    url: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0',
  },
  {
    type: 'image',
    url: 'https://images.unsplash.com/photo-1524253482453-3fed8d2fe12b',
  },
];
// Common render item function to avoid code duplication
const renderCarouselItem = ({
  item,
  index,
  subtitle = 'Demo Page',
}: {
  item: (typeof data)[number];
  index: number;
  subtitle?: string;
}) => {
  return (
    <YStack
      flex={1}
      jc="center"
      ai="center"
      bg={item.type === 'onekey-pro' ? '$bgApp' : '$bg'}
    >
      <SizableText size="$headingXl" color="$text">
        Page {index + 1}
      </SizableText>
      <SizableText size="$bodyMd" color="$textSubdued">
        {subtitle}
      </SizableText>
    </YStack>
  );
};

const CarouselGallery = () => {
  const [disableAnimation, setDisableAnimation] = useState(false);
  const carouselRef = useRef<ICarouselInstance | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [defaultIndex, setDefaultIndex] = useAtom(defaultIndexAtom);

  return (
    <Layout
      componentName="Carousel"
      filePath={__CURRENT_FILE_PATH__}
      elements={[
        {
          title: 'Interactive Carousel',
          element: (
            <YStack gap="$4">
              <Checkbox
                label="Disable Animation"
                value={disableAnimation}
                onChange={(value) => setDisableAnimation(value === true)}
              />
              <Carousel
                data={data}
                autoPlayInterval={3800}
                disableAnimation={disableAnimation}
                containerStyle={{
                  height: 96,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: '$borderSubdued',
                  borderRadius: '$4',
                  overflow: 'hidden',
                }}
                renderItem={({ item, index }) =>
                  renderCarouselItem({
                    item,
                    index,
                    subtitle: disableAnimation
                      ? 'No Animation'
                      : 'With Animation',
                  })
                }
              />
            </YStack>
          ),
        },
        {
          title: 'API Controlled Carousel',
          element: (
            <YStack gap="$4">
              <XStack gap="$2" ai="center" flexWrap="wrap">
                <SizableText size="$bodyMd">
                  Current Page: {currentIndex + 1}
                </SizableText>
                <Button
                  size="small"
                  variant="tertiary"
                  onPress={() => {
                    const index = carouselRef.current?.getCurrentIndex() ?? 0;
                    setCurrentIndex(index);
                  }}
                >
                  Get Current Index
                </Button>
              </XStack>
              <XStack gap="$2" ai="center" flexWrap="wrap">
                <Button
                  size="small"
                  variant="secondary"
                  onPress={() => {
                    carouselRef.current?.prev();
                    setTimeout(() => {
                      const index = carouselRef.current?.getCurrentIndex() ?? 0;
                      setCurrentIndex(index);
                    }, 100);
                  }}
                >
                  Previous
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  onPress={() => {
                    carouselRef.current?.next();
                    setTimeout(() => {
                      const index = carouselRef.current?.getCurrentIndex() ?? 0;
                      setCurrentIndex(index);
                    }, 100);
                  }}
                >
                  Next
                </Button>
                {data.map((_, index) => (
                  <Button
                    key={index}
                    size="small"
                    variant={currentIndex === index ? 'primary' : 'tertiary'}
                    onPress={() => {
                      carouselRef.current?.scrollTo({ index });
                      setCurrentIndex(index);
                    }}
                  >
                    Page {index + 1}
                  </Button>
                ))}
              </XStack>
              <Carousel
                disableAnimation={disableAnimation}
                ref={carouselRef}
                data={data}
                autoPlayInterval={0}
                loop={false}
                containerStyle={{
                  height: 96,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: '$borderSubdued',
                  borderRadius: '$4',
                  overflow: 'hidden',
                }}
                onPageChanged={(index) => {
                  setCurrentIndex(index);
                }}
                renderItem={({ item, index }) =>
                  renderCarouselItem({
                    item,
                    index,
                    subtitle: 'API Controlled',
                  })
                }
              />
            </YStack>
          ),
        },
        {
          title: 'Default Index Carousel',
          element: (
            <YStack gap="$4">
              <XStack gap="$4" ai="center" flexWrap="wrap">
                <SizableText size="$bodyMd">Default Index:</SizableText>
                <Select
                  items={[
                    { label: 'Page 1 (Index 0)', value: 0 },
                    { label: 'Page 2 (Index 1)', value: 1 },
                    { label: 'Page 3 (Index 2)', value: 2 },
                    { label: 'Page 4 (Index 3)', value: 3 },
                  ]}
                  value={defaultIndex}
                  onChange={(value) => setDefaultIndex(value)}
                  title="Select Default Index"
                />
                <SizableText size="$bodyMd" color="$textSubdued">
                  Current: {defaultIndex}
                </SizableText>
              </XStack>
              <SizableText size="$bodyMd" color="$textSubdued">
                This carousel starts from the selected index
              </SizableText>
              <Carousel
                data={data}
                defaultIndex={defaultIndex}
                disableAnimation={disableAnimation}
                autoPlayInterval={9_999_999_999}
                containerStyle={{
                  height: 96,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: '$borderSubdued',
                  borderRadius: '$4',
                  overflow: 'hidden',
                }}
                renderItem={({ item, index }) =>
                  renderCarouselItem({
                    item,
                    index,
                    subtitle:
                      item.type === 'onekey-pro' ? 'OneKey Pro' : 'Image Page',
                  })
                }
              />
            </YStack>
          ),
        },
      ]}
    />
  );
};

export default CarouselGallery;
