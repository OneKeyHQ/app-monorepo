import {
  createImperativeActionListLifecycle,
  getImperativeActionListPlacement,
  getImperativeActionListProxyGeometry,
  preventImperativeActionListCloseAutoFocus,
} from './imperativeShowUtils';

describe('imperative ActionList geometry', () => {
  it('preserves the point-trigger proxy contract', () => {
    expect(
      getImperativeActionListProxyGeometry({
        triggerPosition: { x: 120, y: 80 },
      }),
    ).toEqual({
      left: 120,
      top: 80,
      containerWidth: 0,
      containerHeight: 0,
      triggerWidth: 1,
      triggerHeight: 1,
    });
  });

  it('preserves point-trigger edge placement', () => {
    expect(
      getImperativeActionListPlacement({
        triggerPosition: { x: 700, y: 400 },
        windowWidth: 800,
        windowHeight: 600,
        isRTL: false,
      }),
    ).toBe('top-end');
  });

  it('uses the complete rectangle for the fixed trigger proxy', () => {
    expect(
      getImperativeActionListProxyGeometry({
        triggerRect: { x: 120, y: 80, width: 44, height: 32 },
      }),
    ).toEqual({
      left: 120,
      top: 80,
      containerWidth: 44,
      containerHeight: 32,
      triggerWidth: 44,
      triggerHeight: 32,
    });
  });

  it('uses the rectangle bottom edge to choose top placement', () => {
    expect(
      getImperativeActionListPlacement({
        triggerRect: { x: 100, y: 360, width: 48, height: 40 },
        windowWidth: 800,
        windowHeight: 600,
        isRTL: false,
      }),
    ).toBe('top-start');
  });

  it('uses the rectangle left edge to avoid the right viewport edge in LTR', () => {
    expect(
      getImperativeActionListPlacement({
        triggerRect: { x: 700, y: 100, width: 40, height: 40 },
        windowWidth: 800,
        windowHeight: 600,
        isRTL: false,
      }),
    ).toBe('bottom-end');
  });

  it('mirrors logical start placement in RTL', () => {
    expect(
      getImperativeActionListPlacement({
        triggerRect: { x: 700, y: 100, width: 40, height: 40 },
        windowWidth: 800,
        windowHeight: 600,
        isRTL: true,
      }),
    ).toBe('bottom-start');

    expect(
      getImperativeActionListPlacement({
        triggerRect: { x: 40, y: 100, width: 40, height: 40 },
        windowWidth: 800,
        windowHeight: 600,
        isRTL: true,
      }),
    ).toBe('bottom-end');
  });
});

describe('imperative ActionList lifecycle', () => {
  it.each([false, true])(
    'removes a replaced overlay immediately (already closing: %s)',
    (alreadyClosing) => {
      const onOpenChange = jest.fn();
      const onClose = jest.fn();
      const destroy = jest.fn();
      const scheduled: Array<() => void> = [];
      const lifecycle = createImperativeActionListLifecycle({
        onOpenChange,
        onClose,
        destroy,
        schedule: (callback) => scheduled.push(callback),
      });

      if (alreadyClosing) void lifecycle.close();
      lifecycle.closeImmediately();

      expect(destroy).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);

      lifecycle.closeImmediately();
      void lifecycle.close();
      scheduled.forEach((callback) => callback());

      expect(destroy).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledTimes(1);
    },
  );

  it('waits for the native exit completion before destroying and reuses the close promise', async () => {
    const onClose = jest.fn();
    const destroy = jest.fn();
    const scheduled: Array<{ callback: () => void; delay: number }> = [];
    let finishExit: (() => void) | undefined;
    const exit = new Promise<void>((resolve) => {
      finishExit = resolve;
    });
    const lifecycle = createImperativeActionListLifecycle({
      onClose,
      destroy,
      requestClose: () => {
        lifecycle.handleOpenChange(false);
        return exit;
      },
      getCloseCompletion: () => exit,
      schedule: (callback, delay) => scheduled.push({ callback, delay }),
    });

    const firstClose = lifecycle.close();
    const secondClose = lifecycle.close();
    expect(firstClose).toBe(exit);
    expect(secondClose).toBe(exit);
    expect(scheduled.map(({ delay }) => delay)).toEqual([0]);
    scheduled.forEach(({ callback }) => callback());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(destroy).not.toHaveBeenCalled();

    finishExit?.();
    await firstClose;
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('destroys an imperative list that closed before its native sheet mounted', () => {
    const destroy = jest.fn();
    const onOpenChange = jest.fn();
    const lifecycle = createImperativeActionListLifecycle({
      onOpenChange,
      destroy,
      requestClose: () => undefined,
      getCloseCompletion: () => undefined,
    });

    void lifecycle.close();
    void lifecycle.close();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('handles a rejected native exit when an imperative close is ignored', async () => {
    const destroy = jest.fn();
    const exit = Promise.reject(new Error('close canceled'));
    const lifecycle = createImperativeActionListLifecycle({
      destroy,
      requestClose: () => exit,
      getCloseCompletion: () => exit,
    });

    void lifecycle.close();
    await Promise.resolve();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('still destroys after the consumer open-change callback throws', async () => {
    const error = new Error('consumer callback failed');
    const destroy = jest.fn();
    let finishExit: (() => void) | undefined;
    const exit = new Promise<void>((resolve) => {
      finishExit = resolve;
    });
    const lifecycle = createImperativeActionListLifecycle({
      onOpenChange: () => {
        throw error;
      },
      destroy,
      getCloseCompletion: () => exit,
    });

    expect(() => lifecycle.handleOpenChange(false)).toThrow(error);
    expect(destroy).not.toHaveBeenCalled();
    finishExit?.();
    await exit;
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('prevents the focus scope from restoring focus to the proxy trigger', () => {
    const event = { preventDefault: jest.fn() };

    preventImperativeActionListCloseAutoFocus(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('closes and destroys once while preserving the close animation delay', () => {
    const onOpenChange = jest.fn();
    const onClose = jest.fn();
    const destroy = jest.fn();
    const scheduled: Array<{ callback: () => void; delay: number }> = [];
    const lifecycle = createImperativeActionListLifecycle({
      onOpenChange,
      onClose,
      destroy,
      schedule: (callback, delay) => scheduled.push({ callback, delay }),
    });

    void lifecycle.close();
    void lifecycle.close();
    lifecycle.handleOpenChange(false);
    lifecycle.handleOpenChange(true);

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(scheduled.map(({ delay }) => delay)).toEqual([0, 500]);

    for (const { callback } of scheduled) {
      callback();
    }

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
