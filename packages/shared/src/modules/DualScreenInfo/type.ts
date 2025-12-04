export interface IDualScreenInfoRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ISpanningEvent {
  isSpanning: boolean;
}

export type ISpanningEventListener = (event: ISpanningEvent) => void;

export const CacheResult = {
  isDualScreenDevice: false,
  isSpanning: false,
};

export interface IUseDualScreenInfoResult {
  isDualScreenDevice: boolean;
  isSpanning: boolean;
  windowRects: IDualScreenInfoRect[];
  hingeBounds: IDualScreenInfoRect | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}
