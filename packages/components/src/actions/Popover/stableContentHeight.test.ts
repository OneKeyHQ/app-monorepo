import {
  type IStableContentHeightMeasurement,
  createStableContentHeightScheduler,
  getStableContentHeightForGeneration,
} from './stableContentHeight';

function createFrameHarness() {
  let nextHandle = 1;
  let callbacks = new Map<number, (timestamp: number) => void>();
  const requestFrame = (callback: (timestamp: number) => void) => {
    const handle = nextHandle;
    nextHandle += 1;
    callbacks.set(handle, callback);
    return handle;
  };
  const cancelFrame = (handle: number) => {
    callbacks.delete(handle);
  };
  const flushFrame = () => {
    const currentCallbacks = callbacks;
    callbacks = new Map();
    currentCallbacks.forEach((callback) => callback(0));
  };
  return { requestFrame, cancelFrame, flushFrame };
}

describe('stable NativeSheet content height', () => {
  it('commits only the final height when the same content grows across layout frames', () => {
    const frameHarness = createFrameHarness();
    const stableMeasurements: IStableContentHeightMeasurement[] = [];
    const scheduler = createStableContentHeightScheduler({
      onStableMeasurement: (measurement) =>
        stableMeasurements.push(measurement),
      requestFrame: frameHarness.requestFrame,
      cancelFrame: frameHarness.cancelFrame,
    });

    scheduler.schedule(160, 1);
    frameHarness.flushFrame();
    scheduler.schedule(240, 1);
    frameHarness.flushFrame();
    expect(stableMeasurements).toEqual([]);

    frameHarness.flushFrame();
    expect(stableMeasurements).toEqual([{ contentGeneration: 1, height: 240 }]);
  });

  it('invalidates a stable height when render content changes generation', () => {
    const frameHarness = createFrameHarness();
    let stableMeasurement: IStableContentHeightMeasurement | undefined;
    const scheduler = createStableContentHeightScheduler({
      onStableMeasurement: (measurement) => {
        stableMeasurement = measurement;
      },
      requestFrame: frameHarness.requestFrame,
      cancelFrame: frameHarness.cancelFrame,
    });

    scheduler.schedule(160, 1);
    frameHarness.flushFrame();
    frameHarness.flushFrame();
    expect(getStableContentHeightForGeneration(stableMeasurement, 1)).toBe(160);

    expect(getStableContentHeightForGeneration(stableMeasurement, 2)).toBe(
      undefined,
    );

    scheduler.schedule(240, 2);
    frameHarness.flushFrame();
    expect(getStableContentHeightForGeneration(stableMeasurement, 2)).toBe(
      undefined,
    );
    frameHarness.flushFrame();
    expect(getStableContentHeightForGeneration(stableMeasurement, 2)).toBe(240);
  });
});
