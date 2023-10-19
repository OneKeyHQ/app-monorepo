import { ToggleGroup } from 'tamagui';

import { Stack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const ToggleGroupGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Default',
        element: (
          <Stack space="$2">
            <ToggleGroup type="single">
              <ToggleGroup.Item value="1">Item</ToggleGroup.Item>
              <ToggleGroup.Item value="2">Item</ToggleGroup.Item>
              <ToggleGroup.Item value="3">Item</ToggleGroup.Item>
            </ToggleGroup>
          </Stack>
        ),
      },
    ]}
  />
);

export default ToggleGroupGallery;
