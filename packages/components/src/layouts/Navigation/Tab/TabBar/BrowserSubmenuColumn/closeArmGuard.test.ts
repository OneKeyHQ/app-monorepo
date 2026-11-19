import { createCloseArmGuard } from './closeArmGuard';

const DELAY_MS = 250;
const THRESHOLD_PX = 4;

function setup(initialPointer: { x: number; y: number } | null) {
  const pointer = { current: initialPointer };
  const onArm = jest.fn();
  const guard = createCloseArmGuard({
    delayMs: DELAY_MS,
    thresholdPx: THRESHOLD_PX,
    getLatestPointer: () => pointer.current,
    onArm,
  });
  // Mirrors the column: the latest position is recorded before the guard sees
  // the move.
  const move = (x: number, y: number) => {
    pointer.current = { x, y };
    guard.onPointerMove(pointer.current);
  };
  return { guard, move, onArm };
}

describe('createCloseArmGuard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('arms on a single move of at least the threshold after the delay', () => {
    const { move, onArm } = setup({ x: 100, y: 100 });
    jest.advanceTimersByTime(DELAY_MS);
    move(104, 100);
    expect(onArm).toHaveBeenCalledTimes(1);
  });

  it('arms on a single vertical move of at least the threshold', () => {
    const { move, onArm } = setup({ x: 100, y: 100 });
    jest.advanceTimersByTime(DELAY_MS);
    move(100, 96);
    expect(onArm).toHaveBeenCalledTimes(1);
  });

  it('does not arm on a diagonal move below the threshold distance', () => {
    const { move, onArm } = setup({ x: 100, y: 100 });
    jest.advanceTimersByTime(DELAY_MS);
    // sqrt(2^2 + 2^2) ≈ 2.83px
    move(102, 102);
    expect(onArm).not.toHaveBeenCalled();
  });

  it('arms on a diagonal move at or over the threshold distance', () => {
    const { move, onArm } = setup({ x: 100, y: 100 });
    jest.advanceTimersByTime(DELAY_MS);
    // sqrt(3^2 + 3^2) ≈ 4.24px, although each axis moved less than 4px
    move(103, 103);
    expect(onArm).toHaveBeenCalledTimes(1);
  });

  it('arms once small moves add up to the threshold from the origin', () => {
    const { move, onArm } = setup({ x: 100, y: 100 });
    jest.advanceTimersByTime(DELAY_MS);
    move(102, 100);
    expect(onArm).not.toHaveBeenCalled();
    move(104, 100);
    expect(onArm).toHaveBeenCalledTimes(1);
  });

  it('ignores moves before the delay expires', () => {
    const { move, onArm } = setup({ x: 100, y: 100 });
    jest.advanceTimersByTime(DELAY_MS - 1);
    move(150, 150);
    expect(onArm).not.toHaveBeenCalled();
  });

  it('measures from the position at expiry, not from before it', () => {
    const { move, onArm } = setup({ x: 100, y: 100 });
    jest.advanceTimersByTime(100);
    move(150, 150);
    jest.advanceTimersByTime(DELAY_MS - 100);
    // The pointer rested at (150, 150) when the delay expired.
    move(152, 150);
    expect(onArm).not.toHaveBeenCalled();
    move(155, 150);
    expect(onArm).toHaveBeenCalledTimes(1);
  });

  it('uses the first move as origin when no position was known at expiry', () => {
    const { move, onArm } = setup(null);
    jest.advanceTimersByTime(DELAY_MS);
    move(100, 100);
    expect(onArm).not.toHaveBeenCalled();
    move(104, 100);
    expect(onArm).toHaveBeenCalledTimes(1);
  });

  it('arms only once', () => {
    const { move, onArm } = setup({ x: 100, y: 100 });
    jest.advanceTimersByTime(DELAY_MS);
    move(110, 100);
    move(130, 100);
    expect(onArm).toHaveBeenCalledTimes(1);
  });

  it('never arms after dispose', () => {
    const { guard, move, onArm } = setup({ x: 100, y: 100 });
    guard.dispose();
    jest.advanceTimersByTime(DELAY_MS);
    move(200, 200);
    expect(onArm).not.toHaveBeenCalled();
  });
});
