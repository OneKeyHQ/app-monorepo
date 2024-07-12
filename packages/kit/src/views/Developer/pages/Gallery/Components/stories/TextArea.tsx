import { Stack, TextArea } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
            <TextArea placeholder="Placeholder" numberOfLines={10} />
            <TextArea value="Read Only" editable={false} />
            <TextArea value="Disabled" disabled />
            <TextArea
              multiline
              value="text"
              numberOfLines={14}
              editable={false}
              disabled
            />
            <TextArea error />
          </Stack>
        ),
      },
    ]}
  />
);

export default TextAreaGallery;
