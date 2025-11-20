import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export const { target: swapProJumpTokenAtom, use: useSwapProJumpTokenAtom } =
  globalAtom<{ token: ISwapToken | undefined }>({
    name: EAtomNames.swapProJumpTokenAtom,
    initialValue: {
      token: undefined,
    },
  });
