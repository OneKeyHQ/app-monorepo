import { getOverlayWidthClass } from './useOverlayWidthClass';

describe('getOverlayWidthClass', () => {
  it.each([
    [390, 'compact'], // phone portrait
    [466, 'compact'], // iPhone Duo outer display, portrait
    [639, 'compact'],
    [640, 'medium'],
    [669, 'medium'], // iPhone Duo inner display, portrait
    [678, 'medium'], // iPhone Duo outer display, landscape
    [767, 'medium'],
    [768, 'expanded'],
    [834, 'expanded'], // iPad portrait
    [951, 'expanded'], // iPhone Duo inner display, landscape
  ] as const)('maps %i pt to %s', (width, expected) => {
    expect(getOverlayWidthClass(width)).toBe(expected);
  });
});
