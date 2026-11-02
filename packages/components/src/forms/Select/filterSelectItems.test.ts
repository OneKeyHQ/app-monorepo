import { filterSelectItems } from './filterSelectItems';

import type { ISelectItem } from './type';

const ITEMS: ISelectItem[] = [
  { label: 'English', value: 'en', searchKeywords: ['English', 'en'] },
  {
    label: '日本語',
    value: 'ja-JP',
    description: '日语',
    searchKeywords: ['Japanese', 'ja-JP', '日语'],
  },
  {
    label: 'Português(Brasil)',
    value: 'pt-BR',
    searchKeywords: ['Portuguese (Brazil)', 'pt-BR'],
  },
];

describe('filterSelectItems', () => {
  it('returns every item when the query is empty', () => {
    expect(filterSelectItems(ITEMS, '  ')).toBe(ITEMS);
  });

  it('returns an empty list when there are no items', () => {
    expect(filterSelectItems(undefined, 'ja')).toEqual([]);
  });

  it('matches the translated description and extra keywords', () => {
    expect(filterSelectItems(ITEMS, '日语').map((item) => item.value)).toEqual([
      'ja-JP',
    ]);
    expect(filterSelectItems(ITEMS, 'japan').map((item) => item.value)).toEqual(
      ['ja-JP'],
    );
  });

  it('matches accent-insensitively and returns nothing when nothing matches', () => {
    expect(
      filterSelectItems(ITEMS, 'portugues').map((item) => item.value),
    ).toEqual(['pt-BR']);
    expect(filterSelectItems(ITEMS, 'zzz')).toEqual([]);
  });
});
