import { mergeKeystoneAccountKeys } from './keystoneAccountKeys';

describe('mergeKeystoneAccountKeys', () => {
  it('adds entries seen for the first time', () => {
    expect(
      mergeKeystoneAccountKeys({ 'evm:a': 'k1' }, { 'btc:b': 'k2' }),
    ).toEqual({ merged: { 'evm:a': 'k1', 'btc:b': 'k2' }, mismatched: [] });
  });

  it('keeps the pinned keys and adds nothing when an entry differs', () => {
    expect(
      mergeKeystoneAccountKeys(
        { 'evm:a': 'k1' },
        { 'evm:a': 'other', 'btc:b': 'k2' },
      ),
    ).toEqual({ merged: { 'evm:a': 'k1' }, mismatched: ['evm:a'] });
  });
});
