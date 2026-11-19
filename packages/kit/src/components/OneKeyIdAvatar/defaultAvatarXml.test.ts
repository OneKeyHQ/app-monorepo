import {
  buildOneKeyIdDefaultAvatarXml,
  describeOneKeyIdDefaultAvatar,
} from './defaultAvatarXml';

describe('OneKey ID default avatar', () => {
  // A user's character must not change between releases: if this fails, a
  // palette, accessory or pick slot was reordered instead of appended.
  test('keeps each ID on the same look', () => {
    expect(
      ['u-000000', 'u-000002', 'u-000009', 'u-00000e', 'u-000019'].map(
        describeOneKeyIdDefaultAvatar,
      ),
    ).toEqual([
      { palette: 'purple', accessory: 'bow', eyes: 'round', mouth: 'oh' },
      { palette: 'orange', accessory: 'cap', eyes: 'wink', mouth: 'smile' },
      { palette: 'pink', accessory: 'sunglasses', eyes: 'happy', mouth: 'cat' },
      { palette: 'yellow', accessory: 'beanie', eyes: 'calm', mouth: 'oh' },
      {
        palette: 'night',
        accessory: 'headphones',
        eyes: 'sparkle',
        mouth: 'grin',
      },
    ]);
  });

  test('reaches every accessory', () => {
    const seen = new Set(
      Array.from(
        { length: 400 },
        (_, i) => describeOneKeyIdDefaultAvatar(`s${i}`).accessory,
      ),
    );
    expect(seen.size).toBe(8);
  });

  test('scopes every id to the prefix', () => {
    const xml = buildOneKeyIdDefaultAvatarXml('u-000000', {
      small: false,
      idPrefix: 'avatarA',
    });
    const ids = [...xml.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id.startsWith('avatarA_'))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    const refs = [...xml.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
    expect(refs.every((ref) => ids.includes(ref))).toBe(true);
  });
});
