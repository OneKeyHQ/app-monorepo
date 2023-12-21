import type { ITourStep } from '@onekeyhq/components';
import {
  Button,
  SpotlightTour,
  Text,
  TourBox,
  TourStep,
  TourTrigger,
  YStack,
} from '@onekeyhq/components';

import { Layout } from './utils/Layout';

// mock page
function Page() {
  return (
    <YStack space="$4">
      <TourTrigger>
        <Button>Start</Button>
      </TourTrigger>
      <YStack>
        {/** Followed by assign width and height  */}
        <TourStep index={0} width={110} height={40}>
          <Text variant="$headingXl">Introduction</Text>
        </TourStep>
        <Text>
          This is an example using the spotlight-tour library. Press the Start
          button to see it in action.
        </Text>
      </YStack>
      <YStack>
        {/** Followed by this text's width and height  */}
        <TourStep index={1}>
          <Text width="30%" variant="$headingXl">
            Documentation
          </Text>
        </TourStep>
        <Text>Please, read the documentation before installing.</Text>
      </YStack>
    </YStack>
  );
}

const steps: ITourStep[] = [
  {
    render: (props) => (
      <TourBox
        title="Tour: Customization"
        backText="Previous"
        nextText="Next"
        {...props}
      />
    ),
  },
  {
    render: (props) => (
      <TourBox
        title="Tour: Customization"
        backText="Next"
        nextText="End"
        {...props}
      />
    ),
  },
];

function SpotlightTourDemo() {
  return (
    <SpotlightTour steps={steps}>
      <Page />
    </SpotlightTour>
  );
}

const SliderGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Default',
        element: <SpotlightTourDemo />,
      },
    ]}
  />
);

export default SliderGallery;
