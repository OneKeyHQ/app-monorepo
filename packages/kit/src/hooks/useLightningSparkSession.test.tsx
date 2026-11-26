/** @jest-environment jsdom */
import { cleanup, renderHook } from '@testing-library/react';

import { useLightningSparkSession } from './useLightningSparkSession';

type IHold = {
  holderId: string;
  accountId: string;
  networkId: string;
  pageId?: string;
};

const mockHoldSession = jest.fn<void, [IHold]>();
const mockReleaseSession = jest.fn<void, [{ holderId: string }]>();
const mockPlatformEnv = { isExtension: true };

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isExtension() {
      return mockPlatformEnv.isExtension;
    },
  },
}));
jest.mock('../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceLightningSpark: {
      holdSession: (params: IHold) => mockHoldSession(params),
      releaseSession: (params: { holderId: string }) =>
        mockReleaseSession(params),
    },
  },
}));

const PORT_PREFIX = 'onekey@EXT_PORT_SPARK_SESSION:';
const onPortDisconnect: Array<() => void> = [];
const connect = jest.fn((_info: { name: string }) => ({
  onDisconnect: {
    addListener: (listener: () => void) => onPortDisconnect.push(listener),
  },
}));
(globalThis as unknown as { chrome: unknown }).chrome = {
  runtime: { connect },
};

const SPARK = { accountId: 'hd-1--m/0', networkId: 'lightningspark--0' };

describe('useLightningSparkSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformEnv.isExtension = true;
  });
  afterEach(cleanup);

  it('names its extension page in every hold and keeps one port per page', () => {
    const home = renderHook(() => useLightningSparkSession(SPARK));
    const details = renderHook(() => useLightningSparkSession(SPARK));

    const [first, second] = mockHoldSession.mock.calls.map(([hold]) => hold);
    const pageId = first.pageId ?? '';
    expect(pageId).not.toBe('');
    expect(second.pageId).toBe(pageId);
    expect(first.holderId.startsWith(pageId)).toBe(true);
    expect(second.holderId).not.toBe(first.holderId);
    // The port that tells the background when this page closes.
    expect(connect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledWith({ name: `${PORT_PREFIX}${pageId}` });

    home.unmount();
    expect(mockReleaseSession).toHaveBeenCalledWith({
      holderId: first.holderId,
    });

    // A background restart closes the port; the next hold opens another.
    onPortDisconnect.at(-1)?.();
    details.unmount();
    renderHook(() => useLightningSparkSession(SPARK));
    expect(connect).toHaveBeenCalledTimes(2);
    expect(connect).toHaveBeenLastCalledWith({
      name: `${PORT_PREFIX}${pageId}`,
    });
  });

  it('holds without a page outside the extension', () => {
    mockPlatformEnv.isExtension = false;

    renderHook(() => useLightningSparkSession(SPARK));

    expect(mockHoldSession).toHaveBeenCalledWith(
      expect.objectContaining({ pageId: undefined }),
    );
    expect(connect).not.toHaveBeenCalled();
  });

  it('holds nothing for another network', () => {
    renderHook(() =>
      useLightningSparkSession({ ...SPARK, networkId: 'evm--1' }),
    );

    expect(mockHoldSession).not.toHaveBeenCalled();
  });
});
