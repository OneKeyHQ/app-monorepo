import { dynamicIslandRect } from './dynamicIsland';

describe('dynamicIslandRect', () => {
  it('seats the island under the 14 Pro / 15 / 16 class status bar', () => {
    expect(dynamicIslandRect(59, true)).toEqual({
      top: 11,
      width: 126,
      height: 37,
      radius: 18.5,
    });
  });

  it('seats the island under the 16 Pro class status bar', () => {
    expect(dynamicIslandRect(62, true)?.top).toBe(14);
  });

  it.each([
    ['a notch phone', 47],
    ['an iPad', 24],
    ['landscape', 0],
  ])('has no island for %s', (_name, insetTop) => {
    expect(dynamicIslandRect(insetTop, true)).toBeUndefined();
  });

  it('has no island off native iOS', () => {
    expect(dynamicIslandRect(62, false)).toBeUndefined();
  });
});
