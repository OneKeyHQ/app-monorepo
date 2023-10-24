import { Stack, ToggleGroup } from '@onekeyhq/components';

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
          <Stack space="$4">
            <ToggleGroup type="single">
              <ToggleGroup.Item value="1">
                <ToggleGroup.Text>Item</ToggleGroup.Text>
              </ToggleGroup.Item>
              <ToggleGroup.Item value="2">
                <ToggleGroup.Text>Item</ToggleGroup.Text>
              </ToggleGroup.Item>
              <ToggleGroup.Item value="3">
                <ToggleGroup.Text>Item</ToggleGroup.Text>
              </ToggleGroup.Item>
            </ToggleGroup>
          </Stack>
        ),
      },
    ]}
  />
);

export default ToggleGroupGallery;
