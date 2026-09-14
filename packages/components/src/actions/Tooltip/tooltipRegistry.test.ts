import { closeAllTooltips, registerOpenTooltip } from './tooltipRegistry';

describe('tooltipRegistry', () => {
  it('closeAllTooltips invokes every registered closer once', () => {
    const closeA = jest.fn();
    const closeB = jest.fn();
    const disposeA = registerOpenTooltip(closeA);
    const disposeB = registerOpenTooltip(closeB);

    closeAllTooltips();

    expect(closeA).toHaveBeenCalledTimes(1);
    expect(closeB).toHaveBeenCalledTimes(1);
    disposeA();
    disposeB();
  });

  it('a disposed closer is no longer invoked', () => {
    const close = jest.fn();
    const dispose = registerOpenTooltip(close);
    dispose();

    closeAllTooltips();

    expect(close).not.toHaveBeenCalled();
  });

  it('a closer that disposes itself while closing does not skip the others', () => {
    const closeB = jest.fn();
    const disposeA = registerOpenTooltip(() => disposeA());
    const disposeB = registerOpenTooltip(closeB);

    closeAllTooltips();

    expect(closeB).toHaveBeenCalledTimes(1);
    disposeB();
  });
});
