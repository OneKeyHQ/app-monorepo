import { useEffect } from 'react';

import { BackHandler } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

type Callback = () => boolean;

const useBackHandler = (callback: Callback) => {
  useEffect(() => {
    const onBackPress = () => callback();

    if (!platformEnv.isNativeAndroid) return;

    BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => {
      BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    };
  }, [callback]);
};

export default useBackHandler;
