const DEV_MODE_CLICK_TIMEOUT_MS = 5000;
const DEV_MODE_REQUIRED_CLICKS = 10;

export type IDevModeClickState = {
  clickCount: number;
  startTime: number | undefined;
};

export function advanceDevModeClickSequence({
  state,
  now,
}: {
  state: IDevModeClickState;
  now: number;
}) {
  const isNewSequence =
    state.startTime === undefined ||
    now - state.startTime > DEV_MODE_CLICK_TIMEOUT_MS;
  const clickCount = isNewSequence ? 1 : state.clickCount + 1;

  return {
    state: {
      clickCount,
      startTime: isNewSequence ? now : state.startTime,
    },
    shouldCopyVersion: isNewSequence,
    shouldOpenDevMode: clickCount >= DEV_MODE_REQUIRED_CLICKS,
  };
}
