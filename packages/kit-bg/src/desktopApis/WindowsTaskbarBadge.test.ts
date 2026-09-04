import { EventEmitter } from 'events';

import { systemPreferences } from 'electron';

import WindowsTaskbarBadge from './WindowsTaskbarBadge';

import type { BrowserWindow } from 'electron';

jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('electron', () => {
  const { EventEmitter: MockEventEmitter } =
    jest.requireActual<typeof import('events')>('events');
  return {
    nativeImage: {
      createFromDataURL: jest.fn(() => ({
        isEmpty: jest.fn(() => false),
      })),
    },
    systemPreferences: Object.assign(new MockEventEmitter(), {
      getAccentColor: jest.fn(() => '4cc2ffff'),
    }),
  };
});

const electronMock = jest.requireMock('electron') as {
  nativeImage: {
    createFromDataURL: jest.Mock;
  };
};

class FakeWindow extends EventEmitter {
  destroyed = false;

  setOverlayIcon = jest.fn();

  webContents = {
    executeJavaScript: jest.fn<Promise<string>, [string]>(),
  };

  isDestroyed = () => this.destroyed;
}

function createBadge(window: FakeWindow): WindowsTaskbarBadge {
  return new WindowsTaskbarBadge(window as unknown as BrowserWindow);
}

async function flushPromises(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

describe('WindowsTaskbarBadge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    systemPreferences.removeAllListeners();
  });

  test('keeps the badge cleared across window show and accent changes', async () => {
    const window = new FakeWindow();
    window.webContents.executeJavaScript.mockResolvedValue(
      'data:image/png;base64,badge',
    );
    const badge = createBadge(window);

    await badge.update(7);
    await badge.update(0);
    window.emit('show');
    systemPreferences.emit('accent-color-changed', 'ffffffff');
    await flushPromises();

    expect(window.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
    expect(window.setOverlayIcon).toHaveBeenLastCalledWith(null, '');
  });

  test('ignores a stale render that finishes after the badge is cleared', async () => {
    let resolveRender: ((dataUrl: string) => void) | undefined;
    const window = new FakeWindow();
    window.webContents.executeJavaScript.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveRender = resolve;
        }),
    );
    const badge = createBadge(window);

    const pendingRender = badge.update(7);
    await badge.update(0);
    resolveRender?.('data:image/png;base64,badge');
    await pendingRender;

    expect(electronMock.nativeImage.createFromDataURL.mock.calls).toHaveLength(
      0,
    );
    expect(window.setOverlayIcon).toHaveBeenLastCalledWith(null, '');
  });

  test.each([
    'executeJavaScript rejection',
    'invalid data URL',
    'empty native image',
  ] as const)('clears the previous badge after %s', async (failureStage) => {
    const window = new FakeWindow();
    window.webContents.executeJavaScript.mockResolvedValue(
      'data:image/png;base64,badge',
    );
    const badge = createBadge(window);

    await badge.update(7);

    if (failureStage === 'executeJavaScript rejection') {
      window.webContents.executeJavaScript.mockRejectedValueOnce(
        new Error('render failed'),
      );
    } else if (failureStage === 'invalid data URL') {
      window.webContents.executeJavaScript.mockResolvedValueOnce('invalid');
    } else {
      electronMock.nativeImage.createFromDataURL.mockReturnValueOnce({
        isEmpty: jest.fn(() => true),
      });
    }

    await badge.update(8);
    window.emit('show');

    expect(window.webContents.executeJavaScript).toHaveBeenCalledTimes(2);
    expect(window.setOverlayIcon).toHaveBeenLastCalledWith(null, '');

    systemPreferences.emit('accent-color-changed', 'ffffffff');
    await flushPromises();

    expect(window.webContents.executeJavaScript).toHaveBeenCalledTimes(3);
    expect(window.setOverlayIcon).toHaveBeenLastCalledWith(
      expect.anything(),
      'Unread notifications: 8',
    );
  });

  test('keeps a newer badge when a stale render fails', async () => {
    let rejectRender: ((error: Error) => void) | undefined;
    const window = new FakeWindow();
    window.webContents.executeJavaScript
      .mockImplementationOnce(
        () =>
          new Promise<string>((_resolve, reject) => {
            rejectRender = reject;
          }),
      )
      .mockResolvedValueOnce('data:image/png;base64,badge');
    const badge = createBadge(window);

    const staleRender = badge.update(7);
    await badge.update(8);
    rejectRender?.(new Error('stale render failed'));
    await staleRender;

    expect(window.setOverlayIcon).toHaveBeenLastCalledWith(
      expect.anything(),
      'Unread notifications: 8',
    );
  });
});
