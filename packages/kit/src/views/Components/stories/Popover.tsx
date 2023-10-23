import { useState } from 'react';

import { Button, Popover, Stack, Text } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const PopoverGallery = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Layout
      description=".."
      suggestions={['...']}
      boundaryConditions={['...']}
      elements={[
        {
          title: 'Default',
          element: (
            <Popover
              title="Popover Demo"
              open={isOpen}
              onOpenChange={setIsOpen}
              renderTrigger={
                <Button onPress={() => setIsOpen(true)}>Open</Button>
              }
              renderContent={
                <Stack space="$4" p="$5">
                  <Text>
                    Non exercitation ea laborum cupidatat sunt amet aute
                    exercitation occaecat minim incididunt non est est
                    voluptate.
                  </Text>
                  <Button variant="primary" onPress={() => setIsOpen(false)}>
                    Button
                  </Button>
                </Stack>
              }
            />
          ),
        },
      ]}
    />
  );
};

export default PopoverGallery;
