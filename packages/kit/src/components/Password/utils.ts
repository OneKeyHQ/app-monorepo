import type { ComponentProps } from 'react';

import type { Input } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { PASSCODE_REGEX } from '@onekeyhq/shared/types/password';

export const PasswordRegex = /[^\x20-\x7E]/gm;

// Re-export for backward compatibility
export const PassCodeRegex = PASSCODE_REGEX;

export const getPasswordKeyboardType = (visible?: boolean) => {
  let keyboardType: ComponentProps<typeof Input>['keyboardType'] = 'default';
  if (platformEnv.isNativeIOS) {
    keyboardType = 'ascii-capable';
  } else if (platformEnv.isNativeAndroid) {
    keyboardType = visible ? 'visible-password' : 'default';
  }
  return keyboardType;
};
