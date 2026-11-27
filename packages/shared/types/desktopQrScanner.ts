export const desktopQrScannerChannel = {
  listCameras: 'qr-scanner/list-cameras',
  start: 'qr-scanner/start',
  stop: 'qr-scanner/stop',
  focus: 'qr-scanner/focus',
  setMultiSymbol: 'qr-scanner/set-multi-symbol',
  setPaused: 'qr-scanner/set-paused',
  event: 'qr-scanner/event',
} as const;

export const desktopQrPreviewPrefix = 'desktop-qr-preview-';

export type IDesktopQrCamera = {
  id: string;
  label: string;
  position: 'front' | 'back' | 'external';
};

export type IDesktopQrError =
  | 'permission-denied'
  | 'no-camera'
  | 'camera-busy'
  | 'decoder-unavailable'
  | 'preview-unavailable';

export type IDesktopQrSymbolBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type IDesktopQrDetectedSymbol = {
  text: string;
  centerX: number;
  centerY: number;
  bounds?: IDesktopQrSymbolBounds;
};

export type IDesktopQrEvent = {
  sessionId: string;
  analysisRevision?: number;
} & (
  | { type: 'ready'; cameraId?: string }
  | { type: 'text'; text: string }
  | {
      type: 'symbols';
      symbols: IDesktopQrDetectedSymbol[];
      frameWidth: number;
      frameHeight: number;
    }
  | { type: 'error'; code: IDesktopQrError }
);

export type IDesktopQrStartOptions = {
  multiSymbol?: boolean;
};

export type IDesktopQrScanner = {
  listCameras(): Promise<IDesktopQrCamera[] | null>;
  start(
    sessionId: string,
    cameraId?: string,
    options?: IDesktopQrStartOptions,
  ): Promise<boolean>;
  stop(sessionId: string): Promise<void>;
  focus?(sessionId: string, x: number, y: number): Promise<boolean>;
  setMultiSymbol?(sessionId: string, enabled: boolean): Promise<void>;
  setPaused?(
    sessionId: string,
    paused: boolean,
    analysisRevision?: number,
  ): Promise<void>;
  setPreviewFrozen?(
    sessionId: string,
    frozen: boolean,
    analysisRevision?: number,
  ): void;
  hasFreshPreview?(sessionId: string, analysisRevision: number): boolean;
  onEvent(callback: (event: IDesktopQrEvent) => void): () => void;
};
