/* eslint-disable import/first */
/* eslint-disable import/order */
// const {
//   markJsBundleLoadedTime,
// } = require('@onekeyhq/shared/src/modules3rdParty/metrics');

// markJsBundleLoadedTime();

import { registerRootComponent } from 'expo';
import { useEffect, useState } from 'react';

// import App from './App';
import { Text, View } from 'react-native';

const {
  polyfillGlobal,
} = require('react-native/Libraries/Utilities/PolyfillFunctions');
const Promise = require('promise/setimmediate/es6-extensions');

require('promise/setimmediate/done');
require('promise/setimmediate/finally');

const tracking = require('promise/setimmediate/rejection-tracking');

const defaultHandler = (id, error) => {
  error = error === undefined ? {} : error;
  let message;
  let stack;

  const stringValue = Object.prototype.toString.call(error);
  if (stringValue === '[object Error]') {
    message = Error.prototype.toString.call(error);
    stack = error.stack;
  } else {
    try {
      message = require('pretty-format')(error);
    } catch {
      message = typeof error === 'string' ? error : JSON.stringify(error);
    }
  }

  const warning =
    `Possible Unhandled Promise Rejection (id: ${id}):\n` +
    `${message}\n${stack == null ? '' : stack}`;
  console.warn(warning);
};

let handler = __DEV__ ? defaultHandler : undefined;

export const getUnhandledPromiseRejectionTracker = () => handler;

export const setUnhandledPromiseRejectionTracker = (tracker) => {
  handler = tracker;

  polyfillGlobal('Promise', () => {
    tracking.enable({
      allRejections: true,
      onUnhandled: tracker,
    });

    return Promise;
  });
};

const prevTracker = getUnhandledPromiseRejectionTracker();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately

const App = () => {
  const [text, setText] = useState('');
  useEffect(() => {
    setUnhandledPromiseRejectionTracker((id, error) => {
      console.warn('Unhandled promise rejection!', id, error, Date.now());

      if (prevTracker !== undefined) {
        prevTracker(id, error);
      }
      setText(
        `${error.toString()} ${Date.now()} --- ${
          Date.now() - Number(error.toString())
        }`,
      );
    });
  }, []);
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: 'red',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        onPress={() => {
          new Promise((resolve, reject) => {
            reject(Date.now());
          });
        }}
      >
        hello {text}
      </Text>
    </View>
  );
};
registerRootComponent(App);
