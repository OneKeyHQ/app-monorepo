// import type { ITourStep } from '@onekeyhq/components';
import {
  Button,
  SizableText,
  // Spotlight,
  // TourBox,
  // TourStep,
  // TourTrigger,
  YStack,
} from '@onekeyhq/components';

import { Layout } from './utils/Layout';

// mock page
function Page() {
  return <YStack gap="$4" />;
}

const SliderGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Default',
        element: <Page />,
      },
    ]}
  />
);

export default SliderGallery;
