import { filterSelectItems } from './filterSelectItems';

import type { ISelectItem } from './type';

const ITEMS: ISelectItem[] = [
  {
    label: 'English',
    value: 'en',
    searchKeywords: ['English', 'en', 'en-US'],
  },
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

  it('accepts locale separators, case, and the deprecated English alias', () => {
    expect(
      filterSelectItems(ITEMS, ' PT_br ').map((item) => item.value),
    ).toEqual(['pt-BR']);
    expect(filterSelectItems(ITEMS, 'JA_jp').map((item) => item.value)).toEqual(
      ['ja-JP'],
    );
    expect(filterSelectItems(ITEMS, 'en_US').map((item) => item.value)).toEqual(
      ['en'],
    );
  });

  it('puts exact matches first while preserving partial matches and input order', () => {
    const items: ISelectItem[] = [
      { label: 'French', value: 'fr-FR' },
      ITEMS[0],
      { label: 'Bengali', value: 'bn' },
    ];
    expect(filterSelectItems(items, 'en').map((item) => item.value)).toEqual([
      'en',
      'fr-FR',
      'bn',
    ]);
    expect(items.map((item) => item.value)).toEqual(['fr-FR', 'en', 'bn']);
  });
});
