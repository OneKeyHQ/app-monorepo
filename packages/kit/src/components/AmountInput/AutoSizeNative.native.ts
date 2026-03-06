import type { ComponentType } from 'react';

import type {
  AutoSizeInputMethods,
  AutoSizeInputProps,
} from '@onekeyfe/react-native-auto-size-input';
import {
  type HybridView,
  callback as nitroCallback,
} from 'react-native-nitro-modules';

const { AutoSizeInputView } =
  require('@onekeyfe/react-native-auto-size-input') as {
    AutoSizeInputView: ComponentType<any>;
  };

export const AutoSizeInputNativeView = AutoSizeInputView;

export const wrapNitroCallback = nitroCallback;

export type IAutoSizeInputRef = HybridView<
  AutoSizeInputProps,
  AutoSizeInputMethods
>;
