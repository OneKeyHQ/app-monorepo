import { IconButton, Stack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const IconButtonGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Varaints',
        element: (
          <Stack flexDirection="row" space="$4" alignItems="center">
            <IconButton icon="PlaceholderOutline" />
            <IconButton variant="primary" icon="PlaceholderOutline" />
            <IconButton variant="destructive" icon="PlaceholderOutline" />
            <IconButton variant="tertiary" icon="PlaceholderOutline" />
          </Stack>
        ),
      },
      {
        title: 'Sizes',
        element: (
          <Stack flexDirection="row" space="$4" alignItems="center">
            <IconButton icon="PlaceholderOutline" />
            <IconButton size="small" icon="PlaceholderOutline" />
            <IconButton size="large" icon="PlaceholderOutline" />
          </Stack>
        ),
      },
      {
        title: 'Disabled',
        element: (
          <Stack flexDirection="row" space="$4">
            <IconButton disabled icon="PlaceholderOutline" />
            <IconButton disabled variant="primary" icon="PlaceholderOutline" />
            <IconButton
              disabled
              variant="destructive"
              icon="PlaceholderOutline"
            />
            <IconButton disabled variant="tertiary" icon="PlaceholderOutline" />
          </Stack>
        ),
      },
      {
        title: 'Loading',
        element: (
          <Stack flexDirection="row" space="$4">
            <IconButton loading icon="PlaceholderOutline" />
            <IconButton loading variant="primary" icon="PlaceholderOutline" />
            <IconButton
              loading
              variant="destructive"
              icon="PlaceholderOutline"
            />
            <IconButton loading variant="tertiary" icon="PlaceholderOutline" />
          </Stack>
        ),
      },
      {
        title: 'Tooltip title',
        element: (
          <Stack flexDirection="row" space="$4" alignItems="center">
            <IconButton
              icon="PlaceholderOutline"
              title="Qui nulla occaecat anim"
            />
            <IconButton
              variant="tertiary"
              icon="PlaceholderOutline"
              title="Qui nulla occaecat anim&nbsp;Qui nulla occaecat anim&nbsp;Qui nulla occaecat anim&nbsp;Qui nulla occaecat anim&nbsp;"
            />
          </Stack>
        ),
      },
    ]}
  />
);

export default IconButtonGallery;
