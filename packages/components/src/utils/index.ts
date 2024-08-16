import { getConfig } from '@tamagui/core';
import { getFontSizeToken } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { FontSizeTokens, FontTokens } from '@tamagui/core';
import type { Variable } from '@tamagui/web/types/createVariable';

type IGetFontSizeOpts = {
  relativeSize?: number;
  font?: FontTokens;
};

export const getFontToken = (
  inSize: FontSizeTokens | null | undefined,
  opts?: IGetFontSizeOpts,
) => {
  const token = getFontSizeToken(inSize, opts);
  if (!token) {
    return inSize;
  }
  const conf = getConfig();
  const font = conf.fontsParsed[opts?.font || '$body'];
  return {
    fontSize: (font.size[token] as Variable)?.val as number,
    lineHeight: (font?.lineHeight?.[token] as Variable)?.val as number,
    letterSpacing: (font?.letterSpacing?.[token] as Variable)?.val as number,
    fontWeight: (font?.weight?.[token] as Variable)?.val as number,
  };
};

export { getFontSize } from 'tamagui';

export const NATIVE_HIT_SLOP = platformEnv.isNative
  ? { top: 8, left: 8, right: 8, bottom: 8 }
  : undefined;
