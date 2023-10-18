import { NewButton, Popover, Stack, Text } from '@onekeyhq/components';

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
            renderTrigger={<NewButton>Open</NewButton>}
            renderContent={
              <Stack space="$4" p="$5">
                <Text>
                  Non exercitation ea laborum cupidatat sunt amet aute
                  exercitation occaecat minim incididunt non est est voluptate.
                </Text>
                <Popover.Close>
                  <NewButton variant="primary">Button</NewButton>
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
