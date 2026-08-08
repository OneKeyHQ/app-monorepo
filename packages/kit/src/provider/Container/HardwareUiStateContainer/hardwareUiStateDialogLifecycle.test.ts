import { HardwareUiStateDialogLifecycle } from './hardwareUiStateDialogLifecycle';

describe('HardwareUiStateDialogLifecycle', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not wait when the hardware dialog is already closed', async () => {
    const lifecycle = new HardwareUiStateDialogLifecycle(5000, 0);
    let closeCalled = false;

    await lifecycle.closeAndWait(async () => {
      closeCalled = true;
    });

    expect(closeCalled).toBe(true);
  });

  it('waits for a pending hardware dialog to open before continuing', async () => {
    const lifecycle = new HardwareUiStateDialogLifecycle(5000, 0);
    let completed = false;

    const openPromise = lifecycle
      .openAndWait(async () => undefined)
      .then(() => {
        completed = true;
      });

    await Promise.resolve();
    expect(completed).toBe(false);

    lifecycle.updateOpenState(true);
    await openPromise;

    expect(completed).toBe(true);
  });

  it('serializes a pending open and close acknowledgement', async () => {
    const lifecycle = new HardwareUiStateDialogLifecycle(5000, 0);

    const openPromise = lifecycle.openAndWait(async () => undefined);
    lifecycle.updateOpenState(true);
    await openPromise;

    let closeCompleted = false;
    const closePromise = lifecycle
      .closeAndWait(async () => undefined)
      .then(() => {
        closeCompleted = true;
      });

    await Promise.resolve();
    expect(closeCompleted).toBe(false);

    lifecycle.updateOpenState(false);
    await closePromise;

    expect(closeCompleted).toBe(true);
  });

  it('waits for the UI commit that closes an open hardware dialog', async () => {
    const lifecycle = new HardwareUiStateDialogLifecycle(5000, 0);
    lifecycle.updateOpenState(true);
    let completed = false;

    const closePromise = lifecycle
      .closeAndWait(async () => undefined)
      .then(() => {
        completed = true;
      });

    await Promise.resolve();
    expect(completed).toBe(false);

    lifecycle.updateOpenState(false);
    await closePromise;

    expect(completed).toBe(true);
  });

  it('waits for the native Sheet exit window after the close commit', async () => {
    jest.useFakeTimers();
    const lifecycle = new HardwareUiStateDialogLifecycle(5000, 300);
    lifecycle.updateOpenState(true);
    let completed = false;

    const closePromise = lifecycle
      .closeAndWait(async () => undefined)
      .then(() => {
        completed = true;
      });

    lifecycle.updateOpenState(false);
    jest.advanceTimersByTime(299);
    await Promise.resolve();
    expect(completed).toBe(false);

    jest.advanceTimersByTime(1);
    await closePromise;
    expect(completed).toBe(true);
  });

  it('cancels close settlement when another hardware dialog opens', async () => {
    jest.useFakeTimers();
    const lifecycle = new HardwareUiStateDialogLifecycle(5000, 300);
    lifecycle.updateOpenState(true);
    let completed = false;

    const closePromise = lifecycle
      .closeAndWait(async () => undefined)
      .then(() => {
        completed = true;
      });

    lifecycle.updateOpenState(false);
    jest.advanceTimersByTime(150);
    lifecycle.updateOpenState(true);
    jest.advanceTimersByTime(300);
    await Promise.resolve();
    expect(completed).toBe(false);

    lifecycle.updateOpenState(false);
    jest.advanceTimersByTime(300);
    await closePromise;
    expect(completed).toBe(true);
  });

  it('rejects instead of mounting another overlay without a close acknowledgement', async () => {
    jest.useFakeTimers();
    const lifecycle = new HardwareUiStateDialogLifecycle(1000, 0);
    lifecycle.updateOpenState(true);

    const closePromise = lifecycle.closeAndWait(async () => undefined);
    jest.advanceTimersByTime(1000);

    await expect(closePromise).rejects.toThrow(
      'Hardware UI dialog close acknowledgement timed out',
    );
  });

  it('rejects when a requested hardware dialog never opens', async () => {
    jest.useFakeTimers();
    const lifecycle = new HardwareUiStateDialogLifecycle(1000, 0);

    const openPromise = lifecycle.openAndWait(async () => undefined);
    jest.advanceTimersByTime(1000);

    await expect(openPromise).rejects.toThrow(
      'Hardware UI dialog open acknowledgement timed out',
    );
  });
});
