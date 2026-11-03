import type {
  UseThemeResult,
  VariableVal,
} from '@onekeyhq/components/src/shared/tamagui';
import {
  getTokens as coreGetTokens,
  useMedia as useTamaguiMedia,
} from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export {
  getTokens,
  getTokenValue,
  useTheme,
  useThemeName,
  useStyle,
  usePropsAndStyle,
} from '@onekeyhq/components/src/shared/tamagui';

export const useMedia = useTamaguiMedia;

export type IThemeColorKeys = keyof UseThemeResult;
const _getValue = (
  theme: UseThemeResult,
  key: IThemeColorKeys,
  fallback?: VariableVal,
  isRawValue?: boolean,
): VariableVal => {
  // avoid re-renders
  // https://tamagui.dev/docs/core/use-theme
  const value =
    platformEnv.isNative || isRawValue
      ? theme?.[key]?.val
      : (theme?.[key]?.get() as VariableVal);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return value || fallback || key;
};

export const getThemeTokens = coreGetTokens;
