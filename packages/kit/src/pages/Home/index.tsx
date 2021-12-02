import React, { useState } from 'react';
import {
  Box,
  Button,
  Center,
  Text,
  Address,
  Jazzicon,
  Icon,
  Token,
} from '@onekeyhq/components';
import { FormattedMessage } from '@onekeyhq/kit';
import { useNavigation } from '@react-navigation/native';

function AppRouterLinks() {
  const navigation = useNavigation();
  return (
    <>
      <Button
        onPress={() => {
          // @ts-ignore
          navigation.navigate('WebViewDemo');
        }}
      >
        PageWebView (AppOnly)
      </Button>
      <Button
        onPress={() => {
          // @ts-ignore
          navigation.navigate('LiteDemo');
        }}
      >
        LiteDemo (AppOnly)
      </Button>
      <Button
        onPress={() => {
          // @ts-ignore
          navigation.navigate('BleDeviceDemo');
        }}
      >
        BLEDemo (AppOnly)
      </Button>
      <Button
        onPress={() => {
          // @ts-ignore
          navigation.navigate('AlertPage');
        }}
      >
        AlertPage
      </Button>
      <Box height={44} />
    </>
  );
}

export default function App() {
  const [text, setText] = useState('Hello World');
  return (
    <Center flex={1} px="3">
      <AppRouterLinks />
      <Button
        onPress={() => {
          console.log('hello world');
          setText(Date.now().toString());
        }}
      >
        Primary
      </Button>
      <Button
        onPress={() => {
          window.open(window.location.href);
        }}
      >
        Expand View
      </Button>
      <Address text="0x4330B96Cde5bf063F21978870fF193Ae8cae4c48" short />
      <Jazzicon
        address="0x4330B96Cde5bf063F21978870fF193Ae8cae4c48"
        size={40}
      />
      <Icon size={30} name="CakeSolid" color="blue" />
      <Token />
      <Token chain="bsc" />
      <Token chain="bsc" name="BSC" />
      <Token chain="bsc" name="BSC" description="bsc native token" />
      <Token
        chain="bsc"
        name="DOGE"
        address="0xba2ae424d960c26247dd6c32edc70b295c744c43"
        description="DOGE Token"
      />
      <Box>{text}</Box>
      <Text>
        <FormattedMessage id="simple" />
      </Text>
      <Button
        onPress={() => {
          throw new Error('Sentry Frontend Test Error');
        }}
      >
        Throw error
      </Button>
    </Center>
  );
}
