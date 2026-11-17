import { isSelectSearchSheet } from './selectSearchPresentation';

describe('isSelectSearchSheet', () => {
  it('uses a sheet on a phone-width window', () => {
    expect(
      isSelectSearchSheet({
        hasPopoverTrigger: false,
        isExpandedWindow: false,
      }),
    ).toBe(true);
  });

  it('uses a sheet on a wide window when anchoring has no trigger', () => {
    expect(
      isSelectSearchSheet({
        hasPopoverTrigger: false,
        isExpandedWindow: true,
      }),
    ).toBe(true);
  });

  it('uses the anchored panel only when the wide window has a trigger', () => {
    expect(
      isSelectSearchSheet({
        hasPopoverTrigger: true,
        isExpandedWindow: true,
      }),
    ).toBe(false);
  });

  it('keeps a sheet when a trigger exists on a narrow window', () => {
    expect(
      isSelectSearchSheet({
        hasPopoverTrigger: true,
        isExpandedWindow: false,
      }),
    ).toBe(true);
  });
});
