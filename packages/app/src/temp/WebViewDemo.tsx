import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Box, Button, Center, WebView } from '@onekeyhq/components';
import { Provider } from '@onekeyhq/kit';

export default function WebViewDemo(): JSX.Element {
  const [text, setText] = useState('Hello World');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const navigation = useNavigation();

  return (
    <Provider language="en">
      <Box flex={1} safeArea>
        <Center>
          <Button
            onPress={() => {
              console.log('hello world');
              setText(Date.now().toString());
              // navigation.goBack();
              // @ts-ignore
              navigation.navigate('BleDeviceDemo', {});
            }}
          >
            Primary
          </Button>
          <Box>Hello world</Box>
          <Box>{text}</Box>
        </Center>
        <WebView flex={1} source={{ uri: 'https://www.bing.com' }} />
      </Box>
    </Provider>
  );
}
