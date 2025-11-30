import {
  addSpanningListener,
  getHingeBounds,
  getWindowRects,
  isDualScreenDevice,
  isSpanning,
  removeAllSpanningListeners,
} from './DualScreenInfo';

// Default export
const DualScreenInfo = {
  isDualScreenDevice,
  isSpanning,
  getWindowRects,
  getHingeBounds,
  addSpanningListener,
  removeAllSpanningListeners,
};

export default DualScreenInfo;

export { useDualScreenInfo } from './useDualScreenInfo';
export type { IDualScreenInfoRect, ISpanningEvent } from './DualScreenInfo';
export type { IUseDualScreenInfoResult } from './useDualScreenInfo';
