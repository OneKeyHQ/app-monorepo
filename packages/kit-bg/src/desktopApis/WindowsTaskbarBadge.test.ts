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
});
