import { useEffect, useMemo, useRef } from 'react';

import { getTokens as coreGetTokens, useTheme } from '@tamagui/core';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { SHEET_AND_DIALOG_Z_INDEX } from '@onekeyhq/shared/src/utils/overlayUtils';

import type { VariableVal } from '@tamagui/core';
import type { UseThemeResult } from '@tamagui/web';

export {
  getTokens,
  getTokenValue,
  useTheme,
  useMedia,
  useThemeName,
  useStyle,
  usePropsAndStyle,
} from 'tamagui';

export type IThemeColorKeys = keyof UseThemeResult;
const getValue = (
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

export function useThemeValue<T extends IThemeColorKeys[] | IThemeColorKeys>(
  colorSymbol: T,
  fallback?: VariableVal,
  isRawValue?: boolean,
): T extends IThemeColorKeys ? string : string[];

export function useThemeValue(
  colorSymbol: IThemeColorKeys | IThemeColorKeys[],
  fallback?: VariableVal,
  isRawValue?: boolean,
): VariableVal | VariableVal[] {
  const theme = useTheme();
  return useMemo(() => {
    if (Array.isArray(colorSymbol)) {
      return colorSymbol.map((c) =>
        getValue(theme, c, fallback, isRawValue),
      ) as string[];
    }
    return getValue(theme, colorSymbol, fallback, isRawValue) as string;
  }, [colorSymbol, fallback, isRawValue, theme]);
}

const zIndexStack: { id: number; zIndex: number }[] = [];
let prevOverlayId = 0;

const createNewZIndex = (id: number) => {
  const index = zIndexStack.findIndex((i) => i.id === id);
  if (index === -1) {
    zIndexStack.push({
      id,
      zIndex:
        zIndexStack.length === 0
          ? SHEET_AND_DIALOG_Z_INDEX
          : zIndexStack[zIndexStack.length - 1].zIndex + 1,
    });
  }
};
const removeZIndexFromStack = (id: number) => {
  const index = zIndexStack.findIndex((i) => i.id === id);
  if (index === -1) {
    return;
  }
  if (index === zIndexStack.length - 1) {
    zIndexStack.pop();
    return;
  }
  const item = zIndexStack[index];
  zIndexStack[index].zIndex = item.zIndex + zIndexStack[index].zIndex;
  zIndexStack.splice(index, 1);
};

const getZIndex = (id: number) => {
  if (!id) {
    return SHEET_AND_DIALOG_Z_INDEX;
  }
  const index = zIndexStack.findIndex((i) => i.id === id);
  if (index === -1) {
    return SHEET_AND_DIALOG_Z_INDEX;
  }
  return zIndexStack[index].zIndex;
};

export const useOverlayZIndex = (open = false, debugName?: string): number => {
  const overlayIdRef = useRef(0);
  const prevOpenRef = useRef<boolean | undefined>(undefined);
  useMemo(() => {
    prevOverlayId += 1;
    overlayIdRef.current = prevOverlayId;
    createNewZIndex(overlayIdRef.current);
  }, []);

  const zIndex = useMemo(() => {
    if (prevOpenRef.current !== open) {
      prevOpenRef.current = open;
      if (open) {
        createNewZIndex(overlayIdRef.current);
        return getZIndex(overlayIdRef.current);
      }
      removeZIndexFromStack(overlayIdRef.current);
      return SHEET_AND_DIALOG_Z_INDEX;
    }
    return SHEET_AND_DIALOG_Z_INDEX;
  }, [open]);

  useEffect(
    () => () => {
      removeZIndexFromStack(overlayIdRef.current);
    },
    [open],
  );

  if (platformEnv.isDev && debugName) {
    console.log(
      `debugName: ${debugName}, id: ${
        overlayIdRef.current
      }, zIndex: ${zIndex}, open: ${String(
        open,
      )}, zIndexStack: ${JSON.stringify(zIndexStack)}`,
    );
  }
  return zIndex;
};
