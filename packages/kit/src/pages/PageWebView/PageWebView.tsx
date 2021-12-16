import React, { useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/native';

import { Box, Button, Center, WebView } from '@onekeyhq/components';

export default function PageWebView(): JSX.Element {
  const [text, setText] = useState('Hello World in kit 10');
  const webviewRef = useRef<WebView | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const navigation = useNavigation();

  return (
    <Box flex={1} safeArea>
      <Center>
        <Button
          onPress={() => {
            console.log('hello world');
            setText(Date.now().toString());
            navigation.goBack();
            // @ts-ignore
            // navigation.navigate('BleDeviceDemo', {});
          }}
        >
          Primary
        </Button>
        <Button
          onPress={() => {
            webviewRef.current?.injectJavaScript(`
              (function(){
                  var payload = JSON.stringify({ hello: 1, world:"2", ts: Date.now() })
                  window.ReactNativeWebView.postMessage(payload);
                  alert('kit alert');
              })();
              `);
          }}
        >
          call web method
        </Button>
        <Box>Hello world</Box>
        <Box>{text}</Box>
      </Center>
      <Box flex={1} testID="webview-container">
        <WebView
          ref={(ref) => (webviewRef.current = ref)}
          source={{ uri: 'https://www.bing.com' }}
          onMessage={(event) => {
            const { data } = event.nativeEvent;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const payload: {
              ts: number;
            } = JSON.parse(data);
            console.log(`receive data from web0:`, data);
            console.log(`receive payload from web2:`, payload.ts);
          }}
        />
      </Box>
    </Box>
  );
}
