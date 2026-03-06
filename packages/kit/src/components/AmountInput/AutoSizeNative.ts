import type {
  AutoSizeInputView,
} from '@onekeyfe/react-native-auto-size-input';

export const AutoSizeInput: typeof AutoSizeInputView = (() => {
  return null;
}) as unknown as typeof AutoSizeInputView;

export const wrapNitroCallback = <T>(
  callback: T,
): T extends (...args: any[]) => any ? { f: T } : T => {
  return callback as unknown as T extends (...args: any[]) => any
    ? { f: T }
    : T;
};

export type IAutoSizeInputRef = {
  focus?: () => void;
};
