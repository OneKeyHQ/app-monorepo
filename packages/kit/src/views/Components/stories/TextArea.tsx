import { Stack, TextArea } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const TextAreaGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'States',
        element: (
          <Stack space="$4">
            <TextArea placeholder="Placeholder" />
            <TextArea value="Read Only" editable={false} />
            <TextArea value="Disabled" disabled />
            <TextArea error />
          </Stack>
        ),
      },
    ]}
  />
);

export default TextAreaGallery;
