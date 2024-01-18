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
    imgUrl: '',
    title: 'title2',
    onPress: () => console.log('clicked 1'),
  },
  {
    imgUrl: '',
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
