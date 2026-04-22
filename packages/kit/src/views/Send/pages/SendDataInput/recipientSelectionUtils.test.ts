import { ENFTType } from '@onekeyhq/shared/types/nft';

import {
  normalizeOptionalRecipientText,
  shouldSkipAmountInputForNFT,
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

  it('skips update for same EVM address when case differs', () => {
    expect(
      shouldSkipResolvedRecipientUpdate({
        currentTo: {
          raw: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
          resolved: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        },
        selectedAddress: '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed',
      }),
    ).toBe(true);
  });

  it('keeps non-EVM addresses case-sensitive', () => {
    expect(
      shouldSkipResolvedRecipientUpdate({
        currentTo: { raw: 'AbCd123', resolved: 'AbCd123' },
        selectedAddress: 'abcd123',
      }),
    ).toBe(false);
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

  it('skips amount input for ERC721 but not ERC1155', () => {
    expect(
      shouldSkipAmountInputForNFT({
        isNFT: true,
        nft: { collectionType: ENFTType.ERC721 },
      }),
    ).toBe(true);

    expect(
      shouldSkipAmountInputForNFT({
        isNFT: true,
        nft: { collectionType: ENFTType.ERC1155 },
      }),
    ).toBe(false);

    expect(
      shouldSkipAmountInputForNFT({
        isNFT: false,
        nft: { collectionType: ENFTType.ERC721 },
      }),
    ).toBe(false);
  });
});
