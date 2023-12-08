import type { ITourStep } from '@onekeyhq/components';
import {
  Button,
  SpotlightTour,
  Stack,
  Text,
  TourStep,
  YStack,
  flip,
  offset,
  shift,
  useSpotlightTour,
} from '@onekeyhq/components';

import { Layout } from './utils/Layout';

// mock page
function Page() {
  const { start } = useSpotlightTour();
  return (
    <YStack>
      <Button onPress={start}>Start</Button>
      <TourStep index={0}>
        <YStack>
          <Text>Introduction</Text>
          <Text>
            This is an example using the spotlight-tour library. Press the Start
            button to see it in action.
          </Text>
        </YStack>
      </TourStep>
      <TourStep index={1}>
        <YStack>
          <Text>Documentation</Text>
          <Text>Please, read the documentation before installing.</Text>
        </YStack>
      </TourStep>
    </YStack>
  );
}

const steps: ITourStep[] = [
  {
    // This configurations will apply just for this step
    floatingProps: {
      middleware: [offset(0), shift(), flip()],
      placement: 'bottom',
    },
    render: ({ next }) => (
      <Stack>
        <Text>This is the first step of tour!</Text>
        <Button onPress={next}>Next</Button>
      </Stack>
    ),
  },
  {
    // before: () => DataService.fetchData().then(setData),
    render: () => {
      // You can also use the hook inside the step component, but not recommended.
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { previous, stop } = useSpotlightTour();
      return (
        <YStack>
          <Text>This is the first step of tour!</Text>
          <Button onPress={previous}>Previous</Button>
          <Button onPress={stop}>Stop</Button>
        </YStack>
      );
    },
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
