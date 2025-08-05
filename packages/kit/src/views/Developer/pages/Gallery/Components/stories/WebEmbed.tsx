import { useEffect, useState } from 'react';

import { useDebouncedCallback } from 'use-debounce';

import {
  Button,
  Input,
  SizableText,
  Stack,
  Switch,
  YStack,
} from '@onekeyhq/components';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import webembedApiProxy from '@onekeyhq/kit-bg/src/webembeds/instance/webembedApiProxy';
import webEmbedConfig from '@onekeyhq/shared/src/storage/webEmbedConfig';

import { Layout } from './utils/Layout';

export function WebEmbedDevConfig() {
  const [url0, setUrl] = useState('');
  const [debug0, setDebug] = useState(false);

  const updateConfig = useDebouncedCallback(
    async ({ url, debug }: { url: string; debug: boolean }) => {
      webEmbedConfig.setWebEmbedConfig({
        url,
        debug,
      });
    },
    600,
    {
      leading: false,
      trailing: true,
    },
  );

  useEffect(() => {
    if (debug0) {
      void updateConfig({ url: url0, debug: debug0 });
    } else {
      void updateConfig({ url: '', debug: debug0 });
    }
  }, [url0, debug0, updateConfig]);

  useEffect(() => {
    const config = webEmbedConfig.getWebEmbedConfig();
    setUrl(config?.url ?? '');
    setDebug(config?.debug ?? false);
  }, []);

  return (
    <YStack gap="$4">
      <Stack flexDirection="row" alignItems="center" gap="$2">
        <Switch value={debug0} onChange={setDebug} />
        <SizableText>Debug mode (show webview floating panel)</SizableText>
      </Stack>
      <YStack>
        <SizableText
          onPress={() => {
            // check WEB_EMBED_API_WHITE_LIST_ORIGIN for $private white list origin
            setUrl('http://localhost:3008');
          }}
        >
          Webview Url ( Real device, please use local LAN network ip address,
          and update WEB_EMBED_API_WHITE_LIST_ORIGIN )
        </SizableText>
        <Input
          value={url0}
          onChangeText={setUrl}
          placeholder="http://192.168.31.111:3008"
        />
        <SizableText>http:// or https:// prefix required</SizableText>
      </YStack>

      {/* <WebViewWebEmbed src="http://localhost:3008/" /> */}
      <Button
        onPress={async () => {
          const result = await webembedApiProxy.test.test1('a', 'b', 'c', 'd');
          alert(JSON.stringify(result));
        }}
      >
        Test1
      </Button>
      <Button
        onPress={async () => {
          const result = await webembedApiProxy.test.test2();
          alert(JSON.stringify(result));
          console.log(result);
          console.log(JSON.stringify(result));
        }}
      >
        Test2
      </Button>

      <Button
        onPress={() => {
          void webembedApiProxy.test.trackEvent();
        }}
      >
        Test Tracking Event
      </Button>
      <Button
        onPress={() => {
          void webembedApiProxy.test.captureException();
        }}
      >
        Test Capture Exception
      </Button>
    </YStack>
  );
}

function WebEmbedGallery() {
  return (
    <Layout
      filePath={__CURRENT_FILE_PATH__}
      componentName="WebEmbed"
      elements={[
        {
          title: 'WebEmbedDevConfig',
          element: <WebEmbedDevConfig />,
        },
      ]}
    />
  );
}

export default WebEmbedGallery;
