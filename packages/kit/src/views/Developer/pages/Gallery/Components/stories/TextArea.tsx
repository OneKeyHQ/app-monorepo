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
            <TextArea value="Read Only" editable={false} />
            <TextArea value="Disabled" disabled />
            <TextArea
              multiline
              value="text"
              numberOfLines={14}
              editable={false}
              disabled
              minHeight={platformEnv.isNativeIOS ? '$20' : undefined}
            />
            <TextArea error />
          </Stack>
        ),
      },
    ]}
  />
);

export default TextAreaGallery;
