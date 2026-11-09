import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ENFTType } from '@onekeyhq/shared/types/nft';

import {
  getSendAddressRiskCheckButtonState,
  normalizeOptionalRecipientText,
  shouldSkipAmountInputForNFT,
  shouldSkipResolvedRecipientUpdate,
  splitLocalWalletAddressForms,
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

  const supportedPrimeState: Parameters<
    typeof getSendAddressRiskCheckButtonState
  >[0] = {
    currentNetworkId: 'evm--1',
    supportNetworkId: 'evm--1',
    isSupported: true,
    canRunCheck: true,
    resolvedAddress: '0xabc',
  };

  it.each<
    [
      string,
      Partial<typeof supportedPrimeState>,
      ReturnType<typeof getSendAddressRiskCheckButtonState>,
    ]
  >([
    ['hides unsupported networks', { isSupported: false }, 'hidden'],
    [
      'loads while support belongs to the previous network',
      { currentNetworkId: 'evm--137' },
      'loading',
    ],
    [
      'keeps the dashboard upsell actionable without an address',
      { canRunCheck: false, resolvedAddress: undefined },
      'enabled',
    ],
    [
      'treats a free user the press checks for like Prime and hides without an address',
      { canRunCheck: true, resolvedAddress: undefined },
      'hidden',
    ],
    [
      'hides a Prime check without a resolved address',
      { resolvedAddress: undefined },
      'hidden',
    ],
    [
      'hides a Prime check without an address before support loads',
      { currentNetworkId: 'evm--137', resolvedAddress: undefined },
      'hidden',
    ],
    ['hides a pending Prime check', { isPending: true }, 'hidden'],
    ['enables a resolved Prime check', {}, 'enabled'],
  ])('%s', (_name, overrides, expected) => {
    expect(
      getSendAddressRiskCheckButtonState({
        ...supportedPrimeState,
        ...overrides,
      }),
    ).toBe(expected);
  });
});

describe('splitLocalWalletAddressForms', () => {
  it('adds a private entry only for accounts whose private address is handed out', () => {
    type IEntry = {
      account: { id: string };
      deriveType?: string;
      addressForm?: { labelId: ETranslations; address?: string };
    };
    const accounts: IEntry[] = [
      { account: { id: 'a' } },
      { account: { id: 'b' } },
    ];
    const groups = [{ walletId: 'hd-1', accounts }];
    const [group] = splitLocalWalletAddressForms({
      groups,
      privateAddresses: { a: 'u1a' },
      publicLabel: ETranslations.privacy_balance_public__title,
      privateLabel: ETranslations.private_send_private_option,
    });
    expect(
      group.accounts.map((item) => [
        item.account.id,
        item.deriveType,
        item.addressForm?.address,
      ]),
    ).toEqual([
      ['a', 'public', undefined],
      ['a', 'private', 'u1a'],
      ['b', 'public', undefined],
    ]);
    expect(group.walletId).toBe('hd-1');
  });
});
