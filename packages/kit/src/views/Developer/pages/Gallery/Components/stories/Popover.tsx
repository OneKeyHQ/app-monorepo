/* eslint-disable react/no-unstable-nested-components */
import { useState } from 'react';

import {
  Button,
  Popover,
  SizableText,
  Stack,
  usePopoverContext,
} from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const PopoverDemo = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Popover
      trackID="popover-demo"
      title="Popover Demo"
      open={isOpen}
      onOpenChange={setIsOpen}
      renderTrigger={<Button onPress={() => setIsOpen(true)}>Open</Button>}
      renderContent={
        <Stack gap="$4" p="$5">
          <SizableText>
            Non exercitation ea laborum cupidatat sunt amet aute exercitation
            occaecat minim incididunt non est est voluptate.
          </SizableText>
          <Button variant="primary" onPress={() => setIsOpen(false)}>
            Button
          </Button>
        </Stack>
      }
    />
  );
};

const Content = () => {
  const { closePopover } = usePopoverContext();
  return (
    <Stack gap="$4" p="$5">
      <SizableText>
        Non exercitation ea laborum cupidatat sunt amet aute exercitation
        occaecat minim incididunt non est est voluptate.
      </SizableText>
      <Button variant="primary" onPress={closePopover}>
        Button
      </Button>
    </Stack>
  );
};

// Stable test content component (defined outside to avoid re-creation)
const StableTestContent = () => {
  const [mountTime] = useState(() => {
    const time = new Date().toLocaleTimeString();
    console.log(`🔄 StableTestContent mounted at ${time}`);
    return time;
  });

  const [renderCount, setRenderCount] = useState(1);

  return (
    <Stack gap="$4" p="$5">
      <SizableText color="$textCritical" size="$headingMd">
        Keep Children Mounted Test
      </SizableText>
      <SizableText>📊 Mount Time: {mountTime}</SizableText>
      <SizableText>🔄 Render Count: {renderCount}</SizableText>
      <SizableText size="$bodyMd" color="$textSubdued">
        If keepChildrenMounted works: mount time stays same, only render count
        increases
      </SizableText>
      <Button
        variant="primary"
        onPress={() => setRenderCount((prev) => prev + 1)}
      >
        Force Re-render
      </Button>
    </Stack>
  );
};

// Test component to verify keepChildrenMounted functionality
const KeepChildrenMountedDemo = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Stack gap="$4">
      <SizableText size="$bodyMd" color="$textSubdued">
        Test keepChildrenMounted: If working, mount time should never change.
        Check console for mount logs.
      </SizableText>
      <Popover
        trackID="popover-keep-children-mounted-demo"
        title="Keep Children Mounted Test"
        open={isOpen}
        onOpenChange={setIsOpen}
        keepChildrenMounted
        renderTrigger={
          <Button onPress={() => setIsOpen(true)}>
            Test keepChildrenMounted
          </Button>
        }
        renderContent={<StableTestContent />}
      />
    </Stack>
  );
};

const PopoverGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="Popover"
    elements={[
      {
        title: 'Controlled',
        element: <PopoverDemo />,
      },
      {
        title: 'keepChildrenMounted Test',
        element: <KeepChildrenMountedDemo />,
      },
      {
        title: 'Uncontrolled',
        element: () => (
          <Popover
            trackID="popover-demo-uncontrolled"
            title="Popover Demo"
            renderTrigger={<Button>Uncontrolled Open</Button>}
            renderContent={({ closePopover }) => (
              <Stack gap="$4" p="$5">
                <SizableText>
                  Non exercitation ea laborum cupidatat sunt amet aute
                  exercitation occaecat minim incididunt non est est voluptate.
                </SizableText>
                <Button variant="primary" onPress={closePopover}>
                  Button
                </Button>
              </Stack>
            )}
          />
        ),
      },
      {
        title: 'usePopoverContext',
        element: () => (
          <Popover
            trackID="popover-demo-usePopoverContext"
            title="Popover Demo"
            renderTrigger={<Button>Uncontrolled Open</Button>}
            renderContent={<Content />}
          />
        ),
      },
    ]}
  />
);

export default PopoverGallery;
