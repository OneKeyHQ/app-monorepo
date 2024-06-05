import { useState } from 'react';

import * as bip39 from 'bip39';

import { TextArea, Toast, XStack, YStack } from '@onekeyhq/components';
import { DotMap } from '@onekeyhq/kit/src/components/DotMap';

import { Layout } from './utils/Layout';

const DotMapInputDemo = () => {
  const [mnemonic, setMnemonic] = useState('');
  return (
    <YStack>
      <TextArea
        mb="$8"
        value={mnemonic}
        onChangeText={(text) => {
          const isValid = bip39.validateMnemonic(text);
          if (isValid) {
            setMnemonic(text);
          } else {
            Toast.error({ title: 'invalid mnemonic' });
          }
        }}
      />
      <XStack>{mnemonic ? <DotMap mnemonic={mnemonic} /> : null}</XStack>
    </YStack>
  );
};

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
      {
        title: 'Input Mnemonic',
        element: (
          <YStack space="$8">
            <DotMapInputDemo />
          </YStack>
        ),
      },
    ]}
  />
);

export default DotMapGallery;
