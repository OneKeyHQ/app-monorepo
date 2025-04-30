import { useState } from 'react';

import {
  Button,
  SizableText,
  Stack,
  Trigger,
  XStack,
} from '@onekeyhq/components';

import { Layout } from './utils/Layout';

// Basic usage demo
const BasicDemo = () => {
  const [counter, setCounter] = useState(0);

  return (
    <Stack gap="$4">
      <SizableText>Counter: {counter}</SizableText>
      <Trigger onPress={() => setCounter(counter + 1)}>
        <Button>Click to Increment</Button>
      </Trigger>
    </Stack>
  );
};

// Disabled demo
const DisabledDemo = () => {
  const [counter, setCounter] = useState(0);

  return (
    <Stack gap="$4">
      <SizableText>Counter: {counter}</SizableText>
      <Trigger disabled onPress={() => setCounter(counter + 1)}>
        <Button>Disabled Trigger (Won't Work)</Button>
      </Trigger>
    </Stack>
  );
};

// Multiple triggers demo
const MultipleTriggersDemo = () => {
  const [message, setMessage] = useState('Click a button');

  return (
    <Stack gap="$4">
      <SizableText>{message}</SizableText>
      <XStack gap="$2">
        <Trigger onPress={() => setMessage('You clicked button 1')}>
          <Button>Button 1</Button>
        </Trigger>
        <Trigger onPress={() => setMessage('You clicked button 2')}>
          <Button variant="destructive">Button 2</Button>
        </Trigger>
        <Trigger onPress={() => setMessage('You clicked button 3')}>
          <Button variant="tertiary">Button 3</Button>
        </Trigger>
      </XStack>
    </Stack>
  );
};

// Event composition demo
const ComposedEventsDemo = () => {
  const [buttonMessage, setButtonMessage] = useState('Button not clicked');
  const [triggerMessage, setTriggerMessage] = useState('Trigger not activated');

  return (
    <Stack gap="$4">
      <SizableText>Button: {buttonMessage}</SizableText>
      <SizableText>Trigger: {triggerMessage}</SizableText>
      <Trigger onPress={() => setTriggerMessage('Trigger was activated')}>
        <Button onPress={() => setButtonMessage('Button was clicked')}>
          Click me (both events will fire)
        </Button>
      </Trigger>
    </Stack>
  );
};

const TriggerGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="Trigger"
    description="Trigger is a component that allows you to trigger events when a button is pressed."
    elements={[
      {
        title: 'Basic Usage',
        element: <BasicDemo />,
      },
      {
        title: 'Disabled',
        element: <DisabledDemo />,
      },
      {
        title: 'Multiple Triggers',
        element: <MultipleTriggersDemo />,
      },
      {
        title: 'Composed Events',
        element: <ComposedEventsDemo />,
      },
    ]}
  />
);

export default TriggerGallery;
