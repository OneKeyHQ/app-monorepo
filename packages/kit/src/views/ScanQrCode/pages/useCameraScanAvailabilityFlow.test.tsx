/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';

import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { startAvailabilityFlow } from '@onekeyhq/shared/src/request/availabilityMetrics';
import type {
  IAvailabilityFlow,
  IAvailabilityFlowResult,
} from '@onekeyhq/shared/src/request/availabilityMetrics';

import { useCameraScanAvailabilityFlow } from './useCameraScanAvailabilityFlow';

import type {
  IScanQrCodeAvailabilityScene,
  IScanQrCodeCallbackResult,
} from './scanQrCodeAvailability';

jest.mock('@onekeyhq/shared/src/request/availabilityMetrics', () => ({
  ...jest.requireActual<
    typeof import('@onekeyhq/shared/src/request/availabilityMetrics')
  >('@onekeyhq/shared/src/request/availabilityMetrics'),
  startAvailabilityFlow: jest.fn(),
}));

type IStartedFlow = {
  flow: IAvailabilityFlow;
  detail: string | undefined;
  /** Every `finish` call, including the ones the handle ignores. */
  finishCalls: IAvailabilityFlowResult[];
  /** Mirrors the idempotent handle: only the first finish is recorded. */
  outcomes: IAvailabilityFlowResult[];
};

const startedFlows: IStartedFlow[] = [];
const mockStartAvailabilityFlow = jest.mocked(startAvailabilityFlow);

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function renderCameraFlow(
  scene: IScanQrCodeAvailabilityScene = 'general',
  options?: { strictMode?: boolean },
) {
  return renderHook(
    ({ hookScene }: { hookScene: IScanQrCodeAvailabilityScene }) =>
      useCameraScanAvailabilityFlow(hookScene),
    {
      initialProps: { hookScene: scene },
      // A StrictMode wrapper component would not replay effects: React only
      // replays them for a newly mounted subtree that is already strict.
      reactStrictMode: options?.strictMode,
    },
  );
}

function resolvedWith(result: IScanQrCodeCallbackResult) {
  return jest.fn(async (_value: string) => result);
}

describe('useCameraScanAvailabilityFlow', () => {
  beforeEach(() => {
    startedFlows.length = 0;
    mockStartAvailabilityFlow.mockReset();
    mockStartAvailabilityFlow.mockImplementation((flow, options) => {
      const startedFlow: IStartedFlow = {
        flow,
        detail: options?.detail,
        finishCalls: [],
        outcomes: [],
      };
      startedFlows.push(startedFlow);
      return {
        finish: (result) => {
          startedFlow.finishCalls.push(result);
          if (startedFlow.outcomes.length === 0) {
            startedFlow.outcomes.push(result);
          }
        },
      };
    });
  });

  it('starts one camera flow per mount with the scene as detail', () => {
    const { unmount } = renderCameraFlow('qr_wallet');

    expect(startedFlows).toEqual([
      { flow: 'qr_camera', detail: 'qr_wallet', finishCalls: [], outcomes: [] },
    ]);
    unmount();
  });

  it('records ok once for partial frames followed by the complete frame, then unmount', async () => {
    const { result, unmount } = renderCameraFlow();

    const firstFrame = resolvedWith({ progress: 0.3 });
    await expect(result.current('ur:1-3', firstFrame)).resolves.toEqual({
      progress: 0.3,
    });
    expect(firstFrame).toHaveBeenCalledWith('ur:1-3');
    await expect(
      result.current('ur:2-3', resolvedWith({ retry: true })),
    ).resolves.toEqual({ retry: true });
    await expect(
      result.current('ur:2-3', resolvedWith({ progress: 0.6 })),
    ).resolves.toEqual({ progress: 0.6 });
    expect(startedFlows[0].finishCalls).toEqual([]);

    await expect(
      result.current('ur:3-3', resolvedWith({ progress: 1 })),
    ).resolves.toEqual({ progress: 1 });
    expect(startedFlows[0].outcomes).toEqual([{ status: 'ok' }]);

    // The route callback pops the modal; the unmount must not override ok.
    unmount();
    expect(startedFlows[0].outcomes).toEqual([{ status: 'ok' }]);
  });

  it('records ok when the modal unmounts while the closing scan is pending', async () => {
    const { result, unmount } = renderCameraFlow();
    const deferred = createDeferred<IScanQrCodeCallbackResult>();

    const scan = result.current('address', () => deferred.promise);
    unmount();
    expect(startedFlows[0].finishCalls).toEqual([]);

    deferred.resolve({});
    await expect(scan).resolves.toEqual({});
    expect(startedFlows[0].finishCalls).toEqual([{ status: 'ok' }]);
  });

  it.each<[string, unknown, IAvailabilityFlowResult]>([
    ['failed', new Error('invalid'), { status: 'failed', errorCode: 'error' }],
    [
      'cancelled for a cancel error',
      { className: EOneKeyErrorClassNames.OneKeyErrorScanQrCodeCancel },
      { status: 'cancelled', errorCode: 'onekeyerrorscanqrcodecancel' },
    ],
  ])(
    'records %s when the pending scan throws after unmount',
    async (_label, error, expected) => {
      const { result, unmount } = renderCameraFlow();
      const deferred = createDeferred<IScanQrCodeCallbackResult>();

      const scan = result.current('address', () => deferred.promise);
      unmount();
      expect(startedFlows[0].finishCalls).toEqual([]);

      deferred.reject(error);
      await expect(scan).rejects.toBe(error);
      expect(startedFlows[0].finishCalls).toEqual([expected]);
    },
  );

  it('records the error of a scan that throws while mounted and keeps it on unmount', async () => {
    const { result, unmount } = renderCameraFlow();
    const error = new Error('invalid');

    await expect(
      result.current('address', async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(startedFlows[0].outcomes).toEqual([
      { status: 'failed', errorCode: 'error' },
    ]);

    unmount();
    // The rejected scan is no longer pending, so the unmount reports too; the
    // handle keeps the first outcome.
    expect(startedFlows[0].finishCalls).toEqual([
      { status: 'failed', errorCode: 'error' },
      { status: 'cancelled' },
    ]);
    expect(startedFlows[0].outcomes).toEqual([
      { status: 'failed', errorCode: 'error' },
    ]);
  });

  it.each<[string, IScanQrCodeCallbackResult]>([
    ['partial frame', { progress: 0.6 }],
    ['rejected frame', { retry: true }],
  ])(
    'records cancelled when the modal closes while the next %s is pending',
    async (_label, nextFrameResult) => {
      const { result, unmount } = renderCameraFlow();
      await result.current('ur:1-3', resolvedWith({ progress: 0.3 }));
      const deferred = createDeferred<IScanQrCodeCallbackResult>();

      const nextFrame = result.current('ur:2-3', () => deferred.promise);
      unmount();
      expect(startedFlows[0].finishCalls).toEqual([]);

      deferred.resolve(nextFrameResult);
      await expect(nextFrame).resolves.toEqual(nextFrameResult);
      expect(startedFlows[0].finishCalls).toEqual([{ status: 'cancelled' }]);
    },
  );

  it('records cancelled on unmount while waiting for the next frame', async () => {
    const { result, unmount } = renderCameraFlow();
    await result.current('ur:1-3', resolvedWith({ progress: 0.3 }));

    unmount();
    expect(startedFlows[0].finishCalls).toEqual([{ status: 'cancelled' }]);

    // A frame delivered after cleanup belongs to no flow.
    const lateFrame = resolvedWith({ progress: 0.6 });
    await expect(result.current('ur:2-3', lateFrame)).resolves.toEqual({
      progress: 0.6,
    });
    expect(lateFrame).toHaveBeenCalledWith('ur:2-3');
    expect(startedFlows[0].finishCalls).toEqual([{ status: 'cancelled' }]);
  });

  it('records cancelled once when the scanner reports no frame after cleanup', async () => {
    const { result, unmount } = renderCameraFlow();

    unmount();
    expect(startedFlows[0].finishCalls).toEqual([{ status: 'cancelled' }]);

    const emptyScan = resolvedWith({});
    await expect(result.current('', emptyScan)).resolves.toEqual({});
    expect(emptyScan).toHaveBeenCalledWith('');
    expect(startedFlows[0].finishCalls).toEqual([{ status: 'cancelled' }]);
    expect(startedFlows).toHaveLength(1);
  });

  it('records cancelled once when the scanner reports no frame before cleanup', async () => {
    const { result, unmount } = renderCameraFlow();
    const deferred = createDeferred<IScanQrCodeCallbackResult>();

    const emptyScan = result.current('', () => deferred.promise);
    unmount();
    expect(startedFlows[0].finishCalls).toEqual([]);

    deferred.resolve({});
    await expect(emptyScan).resolves.toEqual({});
    expect(startedFlows[0].finishCalls).toEqual([{ status: 'cancelled' }]);
  });

  it('starts a new flow on a StrictMode remount and scans attach to it', async () => {
    const { result, unmount } = renderCameraFlow('general', {
      strictMode: true,
    });

    expect(startedFlows).toHaveLength(2);
    expect(startedFlows[0].finishCalls).toEqual([{ status: 'cancelled' }]);
    expect(startedFlows[1].finishCalls).toEqual([]);

    await result.current('address', resolvedWith({}));
    expect(startedFlows[0].finishCalls).toEqual([{ status: 'cancelled' }]);
    expect(startedFlows[1].finishCalls).toEqual([{ status: 'ok' }]);

    unmount();
    expect(startedFlows[1].outcomes).toEqual([{ status: 'ok' }]);
  });

  it('keeps a scan pending across a scene change on the flow it started with', async () => {
    const { result, rerender, unmount } = renderCameraFlow('general');
    await result.current('ur:1-3', resolvedWith({ progress: 0.3 }));
    const deferred = createDeferred<IScanQrCodeCallbackResult>();

    const pendingFrame = result.current('ur:2-3', () => deferred.promise);
    rerender({ hookScene: 'qr_wallet' });
    expect(startedFlows.map(({ detail }) => detail)).toEqual([
      'general',
      'qr_wallet',
    ]);
    expect(startedFlows[0].finishCalls).toEqual([]);

    const newFlowFrame = result.current(
      'ur:1-2',
      resolvedWith({ progress: 0.5 }),
    );
    deferred.resolve({ progress: 0.6 });
    await expect(pendingFrame).resolves.toEqual({ progress: 0.6 });
    await newFlowFrame;
    expect(startedFlows[0].finishCalls).toEqual([{ status: 'cancelled' }]);
    expect(startedFlows[1].finishCalls).toEqual([]);

    unmount();
    expect(startedFlows[1].finishCalls).toEqual([{ status: 'cancelled' }]);
  });
});
