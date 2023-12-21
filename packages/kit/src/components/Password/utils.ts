import type { ComponentProps } from 'react';

import type { Input } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const PasswordRegex = /[^\x20-\x7E]/gm;

export const getPasswordKeyboardType = (visible?: boolean) => {
  let keyboardType: ComponentProps<typeof Input>['keyboardType'] = 'default';
  if (platformEnv.isNativeIOS) {
    keyboardType = 'ascii-capable';
  } else if (platformEnv.isNativeAndroid) {
    keyboardType = visible ? 'visible-password' : 'default';
  }
  return keyboardType;
};
