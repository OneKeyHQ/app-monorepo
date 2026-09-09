import { getUnifoldDesktopDialogBodyMaxHeight } from './unifoldDialogLayout';

describe('getUnifoldDesktopDialogBodyMaxHeight', () => {
  it('subtracts dialog chrome from a short viewport', () => {
    expect(getUnifoldDesktopDialogBodyMaxHeight(386)).toBe(232);
  });

  it('never returns a negative body height', () => {
    expect(getUnifoldDesktopDialogBodyMaxHeight(120)).toBe(0);
  });
});
