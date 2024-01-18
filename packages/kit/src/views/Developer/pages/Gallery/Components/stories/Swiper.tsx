/* eslint-disable react/no-unstable-nested-components */
import { Image, SizableText, Swiper, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const bannerData = [
  {
    imgUrl:
      'https://asset.onekey-asset.com/portal/803ff853ecdd7808b35fdf6f837ae1af514aad56/static/shop-hero-animation-poster-8e1206b59d2201dfaa8cd72a8134179f.jpg',
    title: 'title1',
    onPress: () => console.log('clicked 0'),
  },
  {
    imgUrl:
      'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=2148&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3',
    title: 'title2',
    onPress: () => console.log('clicked 1'),
  },
  {
    imgUrl:
      'https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    title: 'title3',
    onPress: () => console.log('clicked 2'),
  },
];

const SliderGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Default',
        element: () => (
          <Swiper
            autoplay
            style={{ width: 300 }}
            autoplayDelay={2}
            autoplayLoop
            index={1}
            data={bannerData}
            renderItem={({ item }) => (
              <YStack
                onPress={item.onPress}
                alignItems="center"
                flex={1}
                width={300}
              >
                <Image size="$20" src={item.imgUrl} />
                <SizableText>{item.title}</SizableText>
              </YStack>
            )}
          />
        ),
      },
    ]}
  />
);

export default SliderGallery;
