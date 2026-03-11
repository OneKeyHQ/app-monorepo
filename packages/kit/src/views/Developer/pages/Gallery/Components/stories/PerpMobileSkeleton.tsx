import { YStack } from '@onekeyhq/components';

import { PerpMobileLayoutSkeleton } from '../../../../../Perp/layouts/PerpMobileLayoutSkeleton';

import { Layout } from './utils/Layout';

const PerpMobileSkeletonGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="PerpMobileSkeleton"
    elements={[
      {
        title: 'Perp Mobile Full-Page Skeleton',
        element: (
          <YStack h={700} w="100%" bg="$bgApp" borderWidth="$px" borderColor="$borderSubdued" borderRadius="$4" overflow="hidden">
            <PerpMobileLayoutSkeleton />
          </YStack>
        ),
      },
    ]}
  />
);

export default PerpMobileSkeletonGallery;
