/* eslint-disable import/first */

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('electron-is-dev', () => false);

jest.mock('electron-log/main', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('node-fetch', () => jest.fn());

jest.mock('../resoucePath', () => ({
  getAppStaticResourcesPath: jest.fn(() => '/mock/resources'),
}));

import { spawn } from 'child_process';

import BridgeProcess, { BRIDGE_SUPPORTED_SYSTEMS } from './Bridge';

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
const originalArch = Object.getOwnPropertyDescriptor(process, 'arch');

type ILoggerMock = {
  info: jest.Mock;
};

function getLoggerMock(): ILoggerMock {
  const loggerMock = jest.requireMock<ILoggerMock>('electron-log/main');
  return loggerMock;
}

function mockPlatform(platform: NodeJS.Platform, arch: NodeJS.Architecture) {
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value: platform,
  });
  Object.defineProperty(process, 'arch', {
    configurable: true,
    value: arch,
  });
}

function restorePlatform() {
  if (originalPlatform) {
    Object.defineProperty(process, 'platform', originalPlatform);
  }
  if (originalArch) {
    Object.defineProperty(process, 'arch', originalArch);
  }
}

describe('BridgeProcess', () => {
  afterEach(() => {
    jest.clearAllMocks();
    restorePlatform();
  });

  test('only supports Linux bridge systems', () => {
    expect(BRIDGE_SUPPORTED_SYSTEMS).toEqual(['linux-arm64', 'linux-x64']);
  });

  test('skips on macOS', async () => {
    mockPlatform('darwin', 'arm64');

    const bridge = new BridgeProcess();
    await bridge.start();

    expect(spawn).not.toHaveBeenCalled();
    expect(getLoggerMock().info).toHaveBeenCalledWith(
      'Skipping process onekeyd, unsupported system: mac-arm64',
    );
  });

  test('skips on Windows', async () => {
    mockPlatform('win32', 'x64');

    const bridge = new BridgeProcess();
    await bridge.start();

    expect(spawn).not.toHaveBeenCalled();
    expect(getLoggerMock().info).toHaveBeenCalledWith(
      'Skipping process onekeyd, unsupported system: win-x64',
    );
  });

  test('keeps Linux enabled', () => {
    mockPlatform('linux', 'x64');

    const bridge = new BridgeProcess();

    expect(bridge.isCurrentSystemSupported()).toBe(true);
  });
});
