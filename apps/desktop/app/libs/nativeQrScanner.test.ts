import { EventEmitter } from 'node:events';

import { desktopQrScannerChannel as channel } from '@onekeyhq/shared/types/desktopQrScanner';

import { installNativeQrScanner } from './nativeQrScanner';

import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';

type IHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;
const mockHandlers = new Map<string, IHandler>();
const mockCapture = { start: jest.fn(), dispose: jest.fn() };
const mockCreateCapture = jest.fn(
  (_callbacks: ICaptureCallbacks) => mockCapture,
);
const mockListCameras = jest.fn(() => [{ id: 'camera-1', name: 'Camera' }]);
const mockSendTexture = jest.fn(async () => {});

jest.mock('electron', () => ({
  ipcMain: {
    removeHandler: (key: string) => mockHandlers.delete(key),
    handle: (key: string, handler: IHandler) => mockHandlers.set(key, handler),
  },
  sharedTexture: {
    importSharedTexture: ({
      allReferencesReleased,
    }: {
      allReferencesReleased: () => void;
    }) => ({
      release: allReferencesReleased,
    }),
    sendSharedTexture: () => mockSendTexture(),
  },
}));

jest.mock(
  '@onekeyfe/electron-qr-scanner',
  () => ({
    createCapture: mockCreateCapture,
    listCameras: mockListCameras,
  }),
  { virtual: true },
);

const sessionId = 'a0000000-0000-4000-8000-000000000001';
const otherSessionId = 'a0000000-0000-4000-8000-000000000002';

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;

function setup() {
  const mainFrame = { send: jest.fn(), url: 'file:///index.html' };
  const webContents = Object.assign(new EventEmitter(), { id: 1, mainFrame });
  const window = Object.assign(new EventEmitter(), {
    webContents,
    isDestroyed: () => false,
    isVisible: () => true,
    isMinimized: () => false,
  });
  installNativeQrScanner(
    window as unknown as BrowserWindow,
    (id, senderFrame, currentFrame) => id === 1 && senderFrame === currentFrame,
  );
  const invoke = (key: string, args: unknown[], senderFrame = mainFrame) =>
    mockHandlers.get(key)!(
      { sender: webContents, senderFrame } as unknown as IpcMainInvokeEvent,
      ...args,
    );
  return { invoke, mainFrame, webContents, window };
}

beforeEach(() => {
  Object.defineProperty(process, 'platform', {
    ...originalPlatform,
    value: 'darwin',
  });
  jest.clearAllMocks();
});

afterEach(() => {
  Object.defineProperty(process, 'platform', originalPlatform);
});

it('rejects camera requests from a subframe', async () => {
  const { invoke, mainFrame } = setup();
  expect(await invoke(channel.start, [sessionId], { ...mainFrame })).toBe(
    false,
  );
  expect(await invoke(channel.listCameras, [], { ...mainFrame })).toBeNull();
  expect(mockListCameras).not.toHaveBeenCalled();
});

type ICaptureCallbacks = {
  onReady(generation: number, info: object, cameraId: string): void;
  onText(text: string, generation: number): void;
  onFrame(frame: { generation: number; release: () => void }): void;
};

it('retires old capture sessions and releases their frames without delivering scan results', async () => {
  const { invoke, mainFrame, webContents } = setup();
  expect(await invoke(channel.start, [sessionId, 'camera-1'])).toBe(true);
  const first = mockCreateCapture.mock.lastCall![0];

  expect(await invoke(channel.start, [otherSessionId])).toBe(true);
  expect(mockCapture.dispose).toHaveBeenCalledTimes(1);
  const current = mockCreateCapture.mock.lastCall![0];
  first.onReady(1, {}, 'camera-1');
  first.onText('retired', 1);
  const release = jest.fn();
  first.onFrame({ release, generation: 1 });
  expect(release).toHaveBeenCalledTimes(1);
  expect(mockSendTexture).not.toHaveBeenCalled();
  expect(mainFrame.send).not.toHaveBeenCalled();

  current.onReady(2, {}, 'camera-1');
  current.onText('active', 2);
  expect(mainFrame.send).toHaveBeenCalledWith(channel.event, {
    type: 'ready',
    sessionId: otherSessionId,
    cameraId: 'camera-1',
  });
  expect(mainFrame.send).toHaveBeenCalledWith(channel.event, {
    type: 'text',
    sessionId: otherSessionId,
    text: 'active',
  });

  invoke(channel.stop, [sessionId]);
  expect(mockCapture.dispose).toHaveBeenCalledTimes(1);
  webContents.emit('did-start-navigation', {
    isMainFrame: true,
    isSameDocument: false,
  });
  expect(mockCapture.dispose).toHaveBeenCalledTimes(2);
});
