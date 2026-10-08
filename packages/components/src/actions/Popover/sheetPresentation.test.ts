import { shouldUseNativeSheetPresentation } from './sheetPresentation';

describe('shouldUseNativeSheetPresentation', () => {
  it.each([
    {
      name: 'uses the native presentation on a phone',
      usingSheet: true,
      nativeSheet: true,
      isGtMd: false,
      isNativeIOSPad: false,
      expected: true,
    },
    {
      name: 'keeps the JS sheet on a gtMd screen',
      usingSheet: true,
      nativeSheet: true,
      isGtMd: true,
      isNativeIOSPad: false,
      expected: false,
    },
    {
      name: 'keeps the JS sheet on iPad',
      usingSheet: true,
      nativeSheet: true,
      isGtMd: false,
      isNativeIOSPad: true,
      expected: false,
    },
    {
      name: 'keeps the JS sheet when native presentation is disabled',
      usingSheet: true,
      nativeSheet: false,
      isGtMd: false,
      isNativeIOSPad: false,
      expected: false,
    },
    {
      name: 'does not use a native presentation when sheets are disabled',
      usingSheet: false,
      nativeSheet: true,
      isGtMd: false,
      isNativeIOSPad: false,
      expected: false,
    },
  ])('$name', ({ expected, ...options }) => {
    expect(shouldUseNativeSheetPresentation(options)).toBe(expected);
  });
});
