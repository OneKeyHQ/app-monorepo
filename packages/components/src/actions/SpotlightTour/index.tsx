import { Button, Text, View } from 'react-native';
import {
  AttachStep,
  SpotlightTourProvider,
  flip,
  offset,
  shift,
  useSpotlightTour,
} from 'react-native-spotlight-tour';

import type { TourStep } from 'react-native-spotlight-tour';

const mySteps: TourStep[] = [
  {
    // This configurations will apply just for this step
    floatingProps: {
      middleware: [offset(0), shift(), flip()],
      placement: 'right',
    },
    render: ({ next }) => (
      <View>
        <Text>This is the first step of tour!</Text>
        <Button title="Next" onPress={next} />
      </View>
    ),
  },
  {
    // before: () => DataService.fetchData().then(setData),
    render: () => {
      // You can also use the hook inside the step component!
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { previous, stop } = useSpotlightTour();

      return (
        <View>
          <Text>This is the first step of tour!</Text>
          <Button title="Previous" onPress={previous} />
          <Button title="Stop" onPress={stop} />
        </View>
      );
    },
  },
];
export function SpotlightTour() {
  return (
    <SpotlightTourProvider
      steps={mySteps}
      overlayColor="gray"
      overlayOpacity={0.36}
      // This configurations will apply to all steps
      floatingProps={{
        middleware: [offset(5), shift(), flip()],
        placement: 'bottom',
      }}
    >
      {({ start }) => (
        <>
          <Button title="Start" onPress={start} />

          <View>
            <AttachStep index={0}>
              <Text>Introduction</Text>
            </AttachStep>

            <Text>
              This is an example using the spotlight-tour library. Press the
              Start button to see it in action.
            </Text>
          </View>

          <View>
            <AttachStep index={1}>
              <Text>Documentation</Text>
            </AttachStep>
            <Text>Please, read the documentation before installing.</Text>
          </View>
        </>
      )}
    </SpotlightTourProvider>
  );
}
