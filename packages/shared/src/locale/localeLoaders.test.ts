import { OneKeyLocalError } from '../errors';

import {
  LOCALE_LOADERS,
  __clearLocaleMessagesCacheForTests,
  loadLocaleMessages,
} from './localeLoaders';

import type { ILocaleJSONSymbol } from './type';

describe('localeLoaders', () => {
  const locale: ILocaleJSONSymbol = 'en-US';
  const originalLoader = LOCALE_LOADERS[locale];

  afterEach(() => {
    LOCALE_LOADERS[locale] = originalLoader;
    __clearLocaleMessagesCacheForTests(locale);
    jest.restoreAllMocks();
  });

  it('removes rejected locale loads from cache so a later retry can recover', async () => {
    type ILocaleMessages = Awaited<
      ReturnType<(typeof LOCALE_LOADERS)[typeof locale]>
    >;
    const messages = {} as ILocaleMessages;
    const loader = jest
      .fn<ReturnType<(typeof LOCALE_LOADERS)[typeof locale]>, []>()
      .mockRejectedValueOnce(new OneKeyLocalError('chunk failed'))
      .mockResolvedValueOnce(messages);

    LOCALE_LOADERS[locale] = loader;

    await expect(loadLocaleMessages(locale)).rejects.toThrow('chunk failed');
    await expect(loadLocaleMessages(locale)).resolves.toBe(messages);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
