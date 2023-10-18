import { NewButton, Stack, XStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const NewButtonGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Variants',
        element: (
          <XStack space="$2" alignItems="center">
            <NewButton icon="PlaceholderOutline">Secondary</NewButton>
            <NewButton icon="PlaceholderOutline" variant="primary">
              Primary
            </NewButton>
            <NewButton icon="PlaceholderOutline" variant="destructive">
              Destructive
            </NewButton>
            <NewButton icon="PlaceholderOutline" variant="tertiary">
              Tertiary
            </NewButton>
          </XStack>
        ),
      },
      {
        title: 'Sizes',
        element: (
          <Stack space="$4">
            <XStack space="$4" alignItems="flex-end">
              <NewButton size="small">Small</NewButton>
              <NewButton>Medium</NewButton>
              <NewButton size="large">Large</NewButton>
            </XStack>
            <XStack space="$4" alignItems="flex-end">
              <NewButton size="small" icon="PlaceholderOutline">
                Small
              </NewButton>
              <NewButton icon="PlaceholderOutline">Medium</NewButton>
              <NewButton size="large" icon="PlaceholderOutline">
                Large
              </NewButton>
            </XStack>
          </Stack>
        ),
      },
      {
        title: 'Disabled',
        element: (
          <Stack space="$4">
            <NewButton disabled>Secondary</NewButton>
            <NewButton disabled variant="primary">
              Primary
            </NewButton>
            <NewButton disabled variant="destructive">
              Destructive
            </NewButton>
            <NewButton disabled variant="tertiary">
              Tertiary
            </NewButton>
          </Stack>
        ),
      },
      {
        title: 'Loading',
        element: (
          <Stack space="$4">
            <NewButton loading>Secondary</NewButton>
            <NewButton loading variant="primary">
              Primary
            </NewButton>
            <NewButton loading variant="destructive">
              Destructive
            </NewButton>
            <NewButton loading variant="tertiary">
              Tertiary
            </NewButton>
          </Stack>
        ),
      },
    ]}
  />
);

export default NewButtonGallery;
