type IFrameCallback = (timestamp: number) => void;
type IRequestFrame = (callback: IFrameCallback) => number;
type ICancelFrame = (handle: number) => void;

export interface IStableContentHeightMeasurement {
  contentGeneration: number;
  height: number;
}

export function getStableContentHeightForGeneration(
  measurement: IStableContentHeightMeasurement | undefined,
  contentGeneration: number,
) {
  return measurement?.contentGeneration === contentGeneration
    ? measurement.height
    : undefined;
}

export function createStableContentHeightScheduler({
  onStableMeasurement,
  requestFrame = requestAnimationFrame,
  cancelFrame = cancelAnimationFrame,
}: {
  onStableMeasurement: (measurement: IStableContentHeightMeasurement) => void;
  requestFrame?: IRequestFrame;
  cancelFrame?: ICancelFrame;
}) {
  let firstFrame: number | undefined;
  let secondFrame: number | undefined;
  let generation = 0;
  let disposed = false;

  const cancelScheduledFrames = () => {
    if (firstFrame !== undefined) {
      cancelFrame(firstFrame);
      firstFrame = undefined;
    }
    if (secondFrame !== undefined) {
      cancelFrame(secondFrame);
      secondFrame = undefined;
    }
  };

  const schedule = (height: number, contentGeneration: number) => {
    generation += 1;
    const scheduledGeneration = generation;
    cancelScheduledFrames();
    firstFrame = requestFrame(() => {
      firstFrame = undefined;
      if (disposed || generation !== scheduledGeneration) {
        return;
      }
      secondFrame = requestFrame(() => {
        secondFrame = undefined;
        if (disposed || generation !== scheduledGeneration) {
          return;
        }
        onStableMeasurement({
          contentGeneration,
          height: Math.ceil(height),
        });
      });
    });
  };

  const dispose = () => {
    disposed = true;
    generation += 1;
    cancelScheduledFrames();
  };

  return { schedule, dispose };
}
