import { asLinkConfigItems } from './linkConfig';

import type { ILinkConfigItem } from './linkConfig';

const SAMPLE_ITEM: ILinkConfigItem = {
  linkId: 'campaign-1',
  title: 'Title',
  description: 'Description',
  mode: 3,
  payload: 'https://onekey.so',
  image: null,
};

describe('asLinkConfigItems', () => {
  it('returns a stable empty array for non-array payloads', () => {
    const empty = asLinkConfigItems(undefined);
    expect(empty).toEqual([]);
    expect(asLinkConfigItems(null)).toBe(empty);
    expect(asLinkConfigItems({})).toBe(empty);
    expect(asLinkConfigItems('x')).toBe(empty);
    expect(asLinkConfigItems(1)).toBe(empty);
  });

  it('returns the same array when the payload is already a list', () => {
    const items = [SAMPLE_ITEM];
    expect(asLinkConfigItems(items)).toBe(items);
    expect(asLinkConfigItems([])).toEqual([]);
  });
});
