import { Button, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { WebViewWebEmbed } from '@onekeyhq/kit/src/views/Discovery/components/WebView/WebViewWebEmbed';

import { Layout } from './utils/Layout';

const WebEmbedGallery = () => (
  <Layout
    description="..."
    suggestions={[]}
    boundaryConditions={[]}
    elements={[
      {
        title: 'Not Found',
        element: (
          <YStack space="$4">
            <WebViewWebEmbed src="/" onContentLoaded={() => {}} />
            <Button
              onPress={async () => {
                // const result =
                //   await backgroundApiProxy.serviceDapp.sendWebEmbedMessage({
                // method: ProvideMethod,
                // event: MoneroEvent.seedAndkeysFromMnemonic,
                // params,
                // });
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
