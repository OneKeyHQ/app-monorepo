import { Button, YStack } from '@onekeyhq/components';
import webembedApiProxy from '@onekeyhq/kit-bg/src/webembeds/instance/webembedApiProxy';

import { Layout } from './utils/Layout';

const WebEmbedGallery = () => (
  <Layout
    description="..."
    suggestions={[]}
    boundaryConditions={[]}
    elements={[
      {
        title: 'RPC Call',
        element: (
          <YStack space="$4">
            {/* <WebViewWebEmbed src="http://localhost:3008/" /> */}
            <Button
              onPress={async () => {
                const result = await webembedApiProxy.test.test1(
                  'a',
                  'b',
                  'c',
                  'd',
                );
                alert(JSON.stringify(result));
              }}
            >
              Test RPC
            </Button>
          </YStack>
        ),
      },
    ]}
  />
);

export default WebEmbedGallery;
