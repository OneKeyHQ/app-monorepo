import { HEADER_RIGHT_SLOT_PROPS } from './headerRightSlot';

describe('headerRight slot', () => {
  it('centers header-right children in the navigation slot', () => {
    expect(HEADER_RIGHT_SLOT_PROPS).toEqual({
      className: 'app-region-no-drag',
      alignItems: 'center',
    });
  });
});
