/** @jest-environment jsdom */

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import extUtils from './extUtils';

const mockValues: Record<string, string> = {};
let mockUuid = 0;
let mockIsBackground = true;
const mockGet = jest.fn(async (key: string) => ({ [key]: mockValues[key] }));
const mockSet = jest.fn(async (values: Record<string, string>) => {
  Object.assign(mockValues, values);
});

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isExtensionBackground() {
      return mockIsBackground;
    },
  },
}));
jest.mock('@onekeyhq/shared/src/utils/sidePanelUtils', () => ({
  sidePanelState: { isOpen: false },
}));
jest.mock('../eventBus/appEventBus', () => ({
  EAppEventBusNames: {},
  appEventBus: {},
}));
jest.mock('./miscUtils', () => ({
  generateUUID: () => {
    mockUuid += 1;
    return `browser-${mockUuid}`;
  },
}));
jest.mock('./routeUtils', () => ({ buildModalRouteParams: jest.fn() }));

const chromeDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'chrome');
const locksDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks');

beforeEach(() => {
  jest.clearAllMocks();
  mockUuid = 0;
  mockIsBackground = true;
  Object.keys(mockValues).forEach((key) => delete mockValues[key]);
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: { storage: { session: { get: mockGet, set: mockSet } } },
  });
});

afterAll(() => {
  if (chromeDescriptor)
    Object.defineProperty(globalThis, 'chrome', chromeDescriptor);
  else Reflect.deleteProperty(globalThis, 'chrome');
  if (locksDescriptor)
    Object.defineProperty(navigator, 'locks', locksDescriptor);
  else Reflect.deleteProperty(navigator, 'locks');
});

it('gives concurrent background callers one browser-session ID without Web Locks', async () => {
  const ids = await Promise.all([
    extUtils.getBrowserSessionId(),
    extUtils.getBrowserSessionId(),
    extUtils.getBrowserSessionId(),
  ]);

  expect(ids).toEqual(['browser-1', 'browser-1', 'browser-1']);
  expect(mockSet).toHaveBeenCalledTimes(1);
});

it('does not create a session ID in an independent UI runtime', async () => {
  mockIsBackground = false;

  await expect(extUtils.getBrowserSessionId()).resolves.toBeUndefined();

  expect(mockGet).not.toHaveBeenCalled();
  expect(mockSet).not.toHaveBeenCalled();
});

it('also keeps the Web Locks path coordinated by the background', async () => {
  const request = jest.fn(
    async (_key: string, callback: () => Promise<string | undefined>) =>
      callback(),
  );
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: { request },
  });

  await expect(
    Promise.all([
      extUtils.getBrowserSessionId(),
      extUtils.getBrowserSessionId(),
    ]),
  ).resolves.toEqual(['browser-1', 'browser-1']);

  expect(request).toHaveBeenCalledTimes(1);
  expect(mockSet).toHaveBeenCalledTimes(1);
});

it('reads a new browser-session ID after session storage is cleared', async () => {
  await expect(extUtils.getBrowserSessionId()).resolves.toBe('browser-1');
  Object.keys(mockValues).forEach((key) => delete mockValues[key]);
  await expect(extUtils.getBrowserSessionId()).resolves.toBe('browser-2');
});

it('retries after session storage becomes available again', async () => {
  mockGet.mockRejectedValueOnce(new OneKeyLocalError('Storage unavailable'));
  await expect(extUtils.getBrowserSessionId()).resolves.toBeUndefined();
  await expect(extUtils.getBrowserSessionId()).resolves.toBe('browser-1');
});
