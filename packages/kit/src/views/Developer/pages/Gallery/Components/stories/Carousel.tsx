import { StyleSheet } from 'react-native';

import {
  Button,
  Carousel,
  Image,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { Layout } from './utils/Layout';

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
const CarouselGallery = () => (
  <Layout
    componentName="Carousel"
    filePath={__CURRENT_FILE_PATH__}
    elements={[
      {
        title: 'Variants',
        element: (
          <Carousel
            data={data}
            autoPlayInterval={3800}
            containerStyle={{
              height: 96,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: '$borderSubdued',
              borderRadius: '$4',
              overflow: 'hidden',
            }}
            renderItem={({ item }: { item: (typeof data)[number] }) => {
              switch (item.type) {
                case 'onekey-pro':
                  return (
                    <XStack
                      bg="$bgApp"
                      px="$4"
                      flex={1}
                      jc="space-between"
                      ai="center"
                    >
                      <XStack gap="$5" ai="center">
                        <Image
                          size="$16"
                          resizeMode="cover"
                          source={require('@onekeyhq/kit/assets/sidebar-banner.png')}
                        />
                        <YStack gap="$0.5">
                          <SizableText
                            size="$bodyLgMedium"
                            $md={{ maxWidth: 0, width: 0 }}
                          >
                            OneKey Pro
                          </SizableText>
                          <SizableText
                            size="$bodyMd"
                            color="$textSubdued"
                            maxWidth="$40"
                            $md={{ maxWidth: 0, width: 0 }}
                            numberOfLines={2}
                            flexShrink={1}
                          >
                            Secure your crypto with the most powerful hardware
                            wallet
                          </SizableText>
                        </YStack>
                      </XStack>
                      <XStack gap="$5">
                        <Button variant="tertiary">Dismiss</Button>
                        <Button variant="primary">Check it out</Button>
                      </XStack>
                    </XStack>
                  );
                default:
                  return (
                    <YStack flex={1}>
                      <Image
                        w="100%"
                        h="100%"
                        resizeMode="cover"
                        source={{ uri: item.url }}
                      />
                    </YStack>
                  );
              }
            }}
          />
        ),
      },
    ]}
  />
);

export default CarouselGallery;
