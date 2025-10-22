import { useState } from 'react';

import { SizableText, YStack } from '@onekeyhq/components';

import { Layout } from '../utils/Layout';

import {
  AddExitingWallet,
  AnotherExample,
  CheckAndUpdate,
  ConnectDevice,
  CreateOrImportWallet,
  CreatingWallet,
  ExampleComponent,
  ImportPhraseOrPrivateKey,
} from './components/ExampleComponent';

function DebugComponent({ children }: { children: React.ReactNode }) {
  const [key, setKey] = useState(0);
  return (
    <YStack key={key}>
      {children}
      <SizableText
        position="absolute"
        right={56}
        bottom={44}
        size="$bodySm"
        onPress={() => setKey((prev) => prev + 1)}
        cursor="pointer"
        userSelect="none"
        color="$textDisabled"
      >
        Rerender
      </SizableText>
    </YStack>
  );
}

const PlaygroundGallery = () => (
  <Layout
    componentName="Playground"
    getFilePath={() => __CURRENT_FILE_PATH__}
    elements={[
      {
        element: (
          <DebugComponent>
            <ExampleComponent />
          </DebugComponent>
        ),
      },
      {
        element: (
          <DebugComponent>
            <AnotherExample />
          </DebugComponent>
        ),
      },
      {
        element: (
          <DebugComponent>
            <CreateOrImportWallet />
          </DebugComponent>
        ),
      },
      {
        element: (
          <DebugComponent>
            <AddExitingWallet />
          </DebugComponent>
        ),
      },
      {
        element: (
          <DebugComponent>
            <ConnectDevice />
          </DebugComponent>
        ),
      },
      {
        element: (
          <DebugComponent>
            <CheckAndUpdate />
          </DebugComponent>
        ),
      },
      {
        element: (
          <DebugComponent>
            <CreatingWallet />
          </DebugComponent>
        ),
      },
      {
        element: (
          <DebugComponent>
            <ImportPhraseOrPrivateKey />
          </DebugComponent>
        ),
      },
    ]}
  />
);

export default PlaygroundGallery;
