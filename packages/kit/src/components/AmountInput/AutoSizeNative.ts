import type {
  AutoSizeInputView,
} from '@onekeyfe/react-native-auto-size-input';

export const AutoSizeInput: typeof AutoSizeInputView = (() => {
  return null;
}) as unknown as typeof AutoSizeInputView;

export const wrapNitroCallback = <T extends (...args: any[]) => any>(
  callback: T,
): T => callback;

export type IAutoSizeInputRef = {
  focus?: () => void;
};
