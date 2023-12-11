import { Button, Stack, XStack, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const ButtonGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Variants',
        element: (
          <YStack space="$2" alignItems="center">
            <Button icon="PlaceholderOutline">Secondary</Button>
            <Button icon="PlaceholderOutline" variant="primary">
              Primary
            </Button>
            <Button icon="PlaceholderOutline" variant="destructive">
              Destructive
            </Button>
            <Button icon="PlaceholderOutline" variant="tertiary">
              Tertiary
            </Button>
          </YStack>
        ),
      },
      {
        title: 'Sizes',
        element: (
          <Stack space="$4">
            <XStack space="$4" alignItems="flex-end">
              <Button size="small">Small</Button>
              <Button>Medium</Button>
              <Button size="large">Large</Button>
            </XStack>
            <XStack space="$4" alignItems="flex-end">
              <Button size="small" icon="PlaceholderOutline">
                Small
              </Button>
              <Button icon="PlaceholderOutline">Medium</Button>
              <Button size="large" icon="PlaceholderOutline">
                Large
              </Button>
            </XStack>
          </Stack>
        ),
      },
      {
        title: 'Disabled',
        element: (
          <Stack space="$4">
            <Button disabled>Secondary</Button>
            <Button disabled variant="primary">
              Primary
            </Button>
            <Button disabled variant="destructive">
              Destructive
            </Button>
            <Button disabled variant="tertiary">
              Tertiary
            </Button>
          </Stack>
        ),
      },
      {
        title: 'Loading',
        element: (
          <Stack space="$4">
            <Button loading>Secondary</Button>
            <Button loading variant="primary">
              Primary
            </Button>
            <Button loading variant="destructive">
              Destructive
            </Button>
            <Button loading variant="tertiary">
              Tertiary
            </Button>
          </Stack>
        ),
      },
      {
        title: 'iconAfter',
        element: (
          <Stack space="$4">
            <Button iconAfter="PlaceholderOutline" color="$red1">
              IconAfter
            </Button>
          </Stack>
        ),
      },
    ]}
  />
);

export default ButtonGallery;
