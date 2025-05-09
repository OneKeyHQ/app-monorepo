import { Banner, Skeleton, Stack } from '@onekeyhq/components';

import { Layout } from '../utils/Layout';

import { bannerTestData } from './bannerTestData';

const EmptyComponent = () => (
  <Stack p="$5">
    <Skeleton
      h={188}
      w="100%"
      $gtMd={{
        height: 268,
      }}
      $gtLg={{
        height: 364,
      }}
    />
  </Stack>
);

const BannerGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="Banner"
    elements={[
      {
        title: 'Basic Banner',
        element: (
          <Banner
            isLoading={false}
            data={bannerTestData}
            height={188}
            $gtMd={{
              height: 308,
            }}
            $gtLg={{
              height: 404,
            }}
            onItemPress={(item) => {
              console.log('Banner clicked:', item.bannerId);
            }}
            emptyComponent={<EmptyComponent />}
          />
        ),
      },
    ]}
  />
);

export default BannerGallery;
