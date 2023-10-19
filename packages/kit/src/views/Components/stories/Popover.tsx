import { Button, Popover, Stack, Text } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const PopoverGallery = () => (
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
            renderTrigger={<Button>Open</Button>}
            renderContent={
              <Stack space="$4" p="$5">
                <Text>
                  Non exercitation ea laborum cupidatat sunt amet aute
                  exercitation occaecat minim incididunt non est est voluptate.
                </Text>
                <Popover.Close>
                  <Button variant="primary">Button</Button>
                </Popover.Close>
              </Stack>
            }
          />
        ),
      },
    ]}
  />
);

export default PopoverGallery;
