import { Shortcut, YStack } from '@onekeyhq/components';
import { shortcutsKeys } from '@onekeyhq/shared/src/shortcuts/shortcutsKeys.enum';

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
              <Shortcut.Key>{shortcutsKeys.CmdOrCtrl}</Shortcut.Key>
              <Shortcut.Key>t</Shortcut.Key>
            </Shortcut>
          </YStack>
        ),
      },
    ]}
  />
);

export default ShortcutGallery;
