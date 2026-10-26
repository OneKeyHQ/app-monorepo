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
  it('returns an empty array for a malformed null payload', () => {
    expect(asLinkConfigItems(null)).toEqual([]);
  });

  it('returns a valid array payload unchanged', () => {
    const items = [SAMPLE_ITEM];
    expect(asLinkConfigItems(items)).toEqual(items);
  });
});
