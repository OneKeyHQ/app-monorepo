import type { IUseDualScreenInfoResult } from './type';

const DEFAULT_RESULT: IUseDualScreenInfoResult = {
  isDualScreenDevice: false,
  isSpanning: false,
  windowRects: [],
  hingeBounds: null,
  isLoading: false,
  refresh: async () => {},
};

export const useDualScreenInfo = () => DEFAULT_RESULT;
