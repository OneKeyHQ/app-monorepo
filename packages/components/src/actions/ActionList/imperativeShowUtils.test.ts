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

    lifecycle.close();
    lifecycle.close();
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
