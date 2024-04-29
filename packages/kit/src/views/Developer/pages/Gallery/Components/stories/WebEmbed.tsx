import { Button, YStack } from '@onekeyhq/components';
import { WebViewWebEmbed } from '@onekeyhq/kit/src/views/Discovery/components/WebView/WebViewWebEmbed';
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
            <WebViewWebEmbed src="http://localhost:3008/" />
            <Button
              onPress={async () => {
                const result = await webembedApiProxy.callRemoteApi({
                  module: 'test' as any,
                  method: 'test1',
                  params: ['a', 'b', 'c'],
                });
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
