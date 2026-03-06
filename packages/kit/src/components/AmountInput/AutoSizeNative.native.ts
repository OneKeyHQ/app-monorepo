import type {
  AutoSizeInputMethods,
  AutoSizeInputProps,
} from '@onekeyfe/react-native-auto-size-input';
import {
  type HybridView,
  callback as nitroCallback,
} from 'react-native-nitro-modules';
import {
  AutoSizeInputView
} from '@onekeyfe/react-native-auto-size-input';

export const AutoSizeInput = AutoSizeInputView;

export const wrapNitroCallback = nitroCallback;

export type IAutoSizeInputRef = HybridView<
  AutoSizeInputProps,
  AutoSizeInputMethods
>;
