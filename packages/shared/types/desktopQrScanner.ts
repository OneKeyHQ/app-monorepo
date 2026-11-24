export const desktopQrScannerChannel = {
  listCameras: 'qr-scanner/list-cameras',
  start: 'qr-scanner/start',
  stop: 'qr-scanner/stop',
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

export type IDesktopQrEvent = { sessionId: string } & (
  | { type: 'ready'; cameraId?: string }
  | { type: 'text'; text: string }
  | { type: 'error'; code: IDesktopQrError }
);

export type IDesktopQrScanner = {
  listCameras(): Promise<IDesktopQrCamera[] | null>;
  start(sessionId: string, cameraId?: string): Promise<boolean>;
  stop(sessionId: string): Promise<void>;
  onEvent(callback: (event: IDesktopQrEvent) => void): () => void;
};
