/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('react-native-webview-cleaner', () => ({
  __esModule: true,
  default: {
    clearAll: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/utils/imageUtils', () => ({
  __esModule: true,
  default: {},
}));

import ServiceDiscovery from './ServiceDiscovery';

describe('ServiceDiscovery', () => {
  it('drops stored bookmark logos when icons are disabled', async () => {
    const buildWebsiteIconUrl = jest.fn();
    const service = {
      backgroundApi: {
        simpleDb: {
          browserBookmarks: {
            getRawData: jest.fn().mockResolvedValue({
              data: [
                {
                  title: 'OneKey',
                  url: 'https://onekey.so',
                  logo: 'data:image/png;base64,abc',
                  sortIndex: 0,
                },
              ],
            }),
          },
        },
      },
      buildWebsiteIconUrl,
    } as unknown as ServiceDiscovery;

    const result = await ServiceDiscovery.prototype.getBookmarkData.call(
      service,
      {
        generateIcon: false,
      },
    );

    expect(result).toEqual([
      {
        title: 'OneKey',
        url: 'https://onekey.so',
        logo: undefined,
        sortIndex: 0,
      },
    ]);
    expect(buildWebsiteIconUrl).not.toHaveBeenCalled();
  });
});
