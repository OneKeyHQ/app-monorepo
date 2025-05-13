import { useState } from 'react';

import { Button, SizableText, Stack, Trigger } from '@onekeyhq/components';

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
        title: 'Composed Events',
        element: <ComposedEventsDemo />,
      },
    ]}
  />
);

export default TriggerGallery;
