import { NewIconButton, Stack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const NewIconButtonGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Varaints',
        element: (
          <Stack flexDirection="row" space="$4" alignItems="center">
            <NewIconButton icon="PlaceholderOutline" />
            <NewIconButton variant="primary" icon="PlaceholderOutline" />
            <NewIconButton variant="destructive" icon="PlaceholderOutline" />
            <NewIconButton variant="tertiary" icon="PlaceholderOutline" />
          </Stack>
        ),
      },
      {
        title: 'Sizes',
        element: (
          <Stack flexDirection="row" space="$4" alignItems="center">
            <NewIconButton icon="PlaceholderOutline" />
            <NewIconButton size="small" icon="PlaceholderOutline" />
            <NewIconButton size="large" icon="PlaceholderOutline" />
          </Stack>
        ),
      },
      {
        title: 'Disabled',
        element: (
          <Stack flexDirection="row" space="$4">
            <NewIconButton disabled icon="PlaceholderOutline" />
            <NewIconButton
              disabled
              variant="primary"
              icon="PlaceholderOutline"
            />
            <NewIconButton
              disabled
              variant="destructive"
              icon="PlaceholderOutline"
            />
            <NewIconButton
              disabled
              variant="tertiary"
              icon="PlaceholderOutline"
            />
          </Stack>
        ),
      },
      {
        title: 'Loading',
        element: (
          <Stack flexDirection="row" space="$4">
            <NewIconButton loading icon="PlaceholderOutline" />
            <NewIconButton
              loading
              variant="primary"
              icon="PlaceholderOutline"
            />
            <NewIconButton
              loading
              variant="destructive"
              icon="PlaceholderOutline"
            />
            <NewIconButton
              loading
              variant="tertiary"
              icon="PlaceholderOutline"
            />
          </Stack>
        ),
      },
    ]}
  />
);

export default NewIconButtonGallery;
