import type { ITourStep } from '@onekeyhq/components';
import {
  Button,
  SizableText,
  SpotlightTour,
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
          <SizableText size="$headingXl">Introduction</SizableText>
        </TourStep>
        <SizableText>
          This is an example using the spotlight-tour library. Press the Start
          button to see it in action.
        </SizableText>
      </YStack>
      <YStack>
        {/** Followed by this text's width and height  */}
        <TourStep index={1}>
          <SizableText width="30%" size="$headingXl">
            Documentation
          </SizableText>
        </TourStep>
        <SizableText>
          Please, read the documentation before installing.
        </SizableText>
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
