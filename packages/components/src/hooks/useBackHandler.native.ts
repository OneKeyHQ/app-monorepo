import { useEffect } from 'react';

import { BackHandler } from 'react-native';

const stopDefaultBackHandler = () => true;

/**
 * Registers a hardware back press listener and invokes the provided callback
 * function when the back button is pressed on Android devices.
 *
 * @param callback - A function to be called when the hardware back button is
 * pressed. The function should return a boolean value to indicate whether the
 * default back press behavior should be stopped or not. If the function
 * returns true, the default behavior will be stopped; if it returns false,
 * the default behavior will be executed. Defaults to always returning true.
 * @param enable - Whether the back press listener should be enabled or not.
 * @returns void
 */
export const useBackHandler = (
  callback: () => boolean = stopDefaultBackHandler,
  enable: boolean | undefined = true,
) => {
  useEffect(() => {
    if (!enable) return;
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      callback,
    );
    return () => backHandler.remove();
  }, [callback, enable]);
};
