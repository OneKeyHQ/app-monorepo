import { resolvePhraseLengthAfterPaste } from './mnemonicPasteUtils';

describe('mnemonicPasteUtils', () => {
  it('updates the selected phrase length in either direction', () => {
    expect(resolvePhraseLengthAfterPaste(15, 12)).toBe(15);
    expect(resolvePhraseLengthAfterPaste(12, 24)).toBe(12);
  });

  it('keeps the selected phrase length for a non-standard word count', () => {
    expect(resolvePhraseLengthAfterPaste(13, 12)).toBe(12);
  });
});
