import { Shortcut, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const ShortcutGallery = () => (
  <Layout
    description="..."
    suggestions={[]}
    boundaryConditions={[]}
    elements={[
      {
        title: 'State',
        element: (
          <YStack space="$4">
            <Shortcut>
              <Shortcut.Key>⌘</Shortcut.Key>
              <Shortcut.Key>t</Shortcut.Key>
            </Shortcut>
          </YStack>
        ),
      },
    ]}
  />
);

export default ShortcutGallery;
