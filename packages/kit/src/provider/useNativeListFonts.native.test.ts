/* eslint-disable import/first */
jest.mock('@onekeyfe/react-native-native-list', () => ({
  configureNativeListFonts: jest.fn(),
}));

import type { configureNativeListFonts } from '@onekeyfe/react-native-native-list';

it('configures native host faces once before the first list can mount', () => {
  jest.isolateModules(() => {
    const { useNativeListFonts } =
      require('./useNativeListFonts.native') as typeof import('./useNativeListFonts.native');
    const configure = (
      require('@onekeyfe/react-native-native-list') as {
        configureNativeListFonts: typeof configureNativeListFonts;
      }
    ).configureNativeListFonts;
    expect(configure).toHaveBeenCalledTimes(1);
    expect(configure).toHaveBeenCalledWith({
      regular: 'Roobert-Regular',
      medium: 'Roobert-Medium',
      semibold: 'Roobert-SemiBold',
      bold: 'Roobert-Bold',
    });
    expect(useNativeListFonts()).toBe(true);
    expect(useNativeListFonts()).toBe(true);
    expect(configure).toHaveBeenCalledTimes(1);
  });
});
