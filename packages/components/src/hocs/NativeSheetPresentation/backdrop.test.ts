import { getNativeSheetBackdropDimAmount } from './backdrop';

describe('NativeSheet backdrop', () => {
  it('uses the exact alpha of the resolved light theme token', () => {
    expect(getNativeSheetBackdropDimAmount('#00000044')).toBe(68 / 255);
  });

  it('uses the exact alpha of the resolved dark theme token', () => {
    expect(getNativeSheetBackdropDimAmount('#0000009b')).toBe(155 / 255);
  });
});
