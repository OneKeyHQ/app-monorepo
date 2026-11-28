import {
  buildOneKeyIdDefaultAvatarXml,
  describeOneKeyIdDefaultAvatar,
} from './defaultAvatarXml';

const LOCK_IDS = ['u-000000', 'u-000002', 'u-000009', 'u-00000e', 'u-000019'];

// FNV-1a: a short, stable fingerprint of the full markup.
function fingerprint(text: string) {
  let hash = 0x81_1c_9d_c5;
  for (let i = 0; i < text.length; i += 1) {
    // oxlint-disable-next-line no-bitwise
    hash ^= text.charCodeAt(i);
    // oxlint-disable-next-line no-bitwise
    hash = Math.imul(hash, 0x01_00_01_93) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

describe('OneKey ID default avatar', () => {
  // A user's character must not change between releases: if this fails, an
  // entry was added to, removed from or moved within a list or pick slot.
  test('keeps each ID on the same look', () => {
    expect(LOCK_IDS.map(describeOneKeyIdDefaultAvatar)).toEqual([
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

  // Tilt, gaze, blush and accents too: the drawing itself must not change.
  test('keeps each ID on the same drawing', () => {
    expect(
      LOCK_IDS.map((id) =>
        fingerprint(
          buildOneKeyIdDefaultAvatarXml(id, { small: false, idPrefix: 'lock' }),
        ),
      ),
    ).toEqual(['9f46446c', 'ed22c087', '063ab461', '38fac4b3', '3fa1d772']);
    expect(
      LOCK_IDS.map((id) =>
        fingerprint(
          buildOneKeyIdDefaultAvatarXml(id, { small: true, idPrefix: 'lock' }),
        ),
      ),
    ).toEqual(['fabedb31', 'e17b1d00', '00fd0ecf', '3a3a67ca', 'b3d9a58f']);
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
