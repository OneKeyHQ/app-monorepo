import {
  normalizeOptionalRecipientText,
  shouldSkipResolvedRecipientUpdate,
} from './recipientSelectionUtils';

describe('recipientSelectionUtils', () => {
  it('normalizes optional memo/note values to avoid stale form values', () => {
    expect(normalizeOptionalRecipientText('memo-1')).toBe('memo-1');
    expect(normalizeOptionalRecipientText(undefined)).toBe('');
  });

  it('skips address update when same raw address is already resolved', () => {
    expect(
      shouldSkipResolvedRecipientUpdate({
        currentTo: { raw: '0xabc', resolved: '0xabc' },
        selectedAddress: '0xabc',
      }),
    ).toBe(true);
  });

  it('does not skip update for different or unresolved address', () => {
    expect(
      shouldSkipResolvedRecipientUpdate({
        currentTo: { raw: '0xabc', resolved: '0xabc' },
        selectedAddress: '0xdef',
      }),
    ).toBe(false);

    expect(
      shouldSkipResolvedRecipientUpdate({
        currentTo: { raw: '0xabc' },
        selectedAddress: '0xabc',
      }),
    ).toBe(false);
  });
});
