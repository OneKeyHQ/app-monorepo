/* eslint-disable import/first */
jest.mock('@onekeyfe/react-native-native-list', () => ({
  configureNativeListFonts: jest.fn(),
}));

import { BRAND_FONT_NATIVE_FAMILY } from '@onekeyhq/components/src/hocs/Provider/fonts/brandFont';

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
    expect(configure).toHaveBeenCalledWith(BRAND_FONT_NATIVE_FAMILY);
    expect(useNativeListFonts()).toBe(true);
    expect(useNativeListFonts()).toBe(true);
    expect(configure).toHaveBeenCalledTimes(1);
  });
});
