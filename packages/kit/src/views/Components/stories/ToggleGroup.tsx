import { Icon, Stack, ToggleGroup } from '@onekeyhq/components';

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
            <ToggleGroup type="single">
              <ToggleGroup.Item value="4">
                <ToggleGroup.Icon name="AlignLeftOutline" />
              </ToggleGroup.Item>
              <ToggleGroup.Item value="5">
                <ToggleGroup.Icon name="AlignmentCenterOutline" />
              </ToggleGroup.Item>
              <ToggleGroup.Item value="6">
                <ToggleGroup.Icon name="AlignRightOutline" />
              </ToggleGroup.Item>
            </ToggleGroup>
          </Stack>
        ),
      },
    ]}
  />
);

export default ToggleGroupGallery;
