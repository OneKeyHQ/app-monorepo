import { XStack, YStack } from '@onekeyhq/components';
import { DotMap } from '@onekeyhq/kit/src/components/DotMap';

import { Layout } from './utils/Layout';

const DotMapGallery = () => (
  <Layout
    description=""
    suggestions={[]}
    boundaryConditions={[]}
    elements={[
      {
        title: '12 words',
        element: (
          <YStack space="$8">
            <XStack>
              <DotMap mnemonic="envelope same ranch valve knee day lock pink old world minor pill" />
            </XStack>
          </YStack>
        ),
      },
      {
        title: '18 words',
        element: (
          <YStack space="$8">
            <XStack>
              <DotMap mnemonic="until announce path lock crime wish oblige trick face bright digital into chat vehicle episode club verb tank" />
            </XStack>
          </YStack>
        ),
      },
      {
        title: '24 words',
        element: (
          <YStack space="$8">
            <XStack>
              <DotMap mnemonic="typical record cupboard grid all shield border weapon crisp wolf find enact people search skate enough judge response royal wish enroll salad bomb cruel" />
            </XStack>
          </YStack>
        ),
      },
    ]}
  />
);

export default DotMapGallery;
