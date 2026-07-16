import {
  addDevSettingsSearchHistoryItem,
  parseDevSettingsSearchHistory,
  removeDevSettingsSearchHistoryItem,
} from './devSettingsSearchHistoryUtils';

describe('devSettingsSearchHistoryUtils', () => {
  it('keeps every saved search with the latest item first', () => {
    expect(
      addDevSettingsSearchHistoryItem(
        ['Fourth', 'Third', 'Second', 'First'],
        'Fifth',
      ),
    ).toEqual(['Fifth', 'Fourth', 'Third', 'Second', 'First']);
  });

  it('deduplicates saved searches case-insensitively', () => {
    expect(
      addDevSettingsSearchHistoryItem(
        ['Network Throttle', 'API Endpoint Management'],
        ' network throttle ',
      ),
    ).toEqual(['network throttle', 'API Endpoint Management']);
  });

  it('removes one saved search case-insensitively', () => {
    expect(
      removeDevSettingsSearchHistoryItem(
        ['Network Throttle', 'API Endpoint Management'],
        ' network throttle ',
      ),
    ).toEqual(['API Endpoint Management']);
  });

  it('sanitizes persisted history without limiting its size', () => {
    expect(
      parseDevSettingsSearchHistory(
        JSON.stringify([
          ' Fifth ',
          42,
          '',
          'fifth',
          'Fourth',
          'Third',
          'Second',
          'First',
        ]),
      ),
    ).toEqual(['Fifth', 'Fourth', 'Third', 'Second', 'First']);
  });

  it('ignores malformed persisted history', () => {
    expect(parseDevSettingsSearchHistory('{')).toEqual([]);
    expect(
      parseDevSettingsSearchHistory(JSON.stringify({ item: 'Latest' })),
    ).toEqual([]);
  });
});
