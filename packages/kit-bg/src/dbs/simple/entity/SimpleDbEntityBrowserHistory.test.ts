import { withMemoryStorage } from '@onekeyhq/shared/src/test-utils/mocks/memoryStorage';

import { SimpleDbEntityBrowserHistory } from './SimpleDbEntityBrowserHistory';

function historyEntry(id: string, url: string) {
  return { id, url, title: id, createdAt: 1 };
}

it('keeps the newest occurrence of each URL in a closed-tab batch', async () => {
  const entity = withMemoryStorage(new SimpleDbEntityBrowserHistory());
  const firstUrl = 'https://first.example';
  const secondUrl = 'https://second.example';
  const unrelated = historyEntry('unrelated', 'https://unrelated.example');
  const second = historyEntry('second', secondUrl);
  const last = historyEntry('last', firstUrl);
  await entity.setRawData({
    data: [historyEntry('previous', firstUrl), unrelated],
  });

  await entity.addEntries([historyEntry('first', firstUrl), second, last]);

  expect(await entity.getRawData()).toEqual({
    data: [last, second, unrelated],
  });
});

it('keeps history empty when clearing behind a pending closed-tab batch', async () => {
  const entity = withMemoryStorage(new SimpleDbEntityBrowserHistory());
  const write = entity.appStorage.setItem.bind(entity.appStorage);
  const writeStarted = Promise.withResolvers<void>();
  const releaseWrite = Promise.withResolvers<void>();
  jest
    .mocked(entity.appStorage.setItem)
    .mockImplementationOnce(async (key, value) => {
      writeStarted.resolve();
      await releaseWrite.promise;
      return write(key, value);
    });
  const batch = entity.addEntries([
    historyEntry('first', 'https://first.example'),
    historyEntry('second', 'https://second.example'),
  ]);
  await writeStarted.promise;

  const clear = entity.setRawData({ data: [] });
  releaseWrite.resolve();
  await expect(Promise.all([batch, clear])).resolves.toEqual([
    true,
    { data: [] },
  ]);
  expect(await entity.getRawData()).toEqual({ data: [] });
});
