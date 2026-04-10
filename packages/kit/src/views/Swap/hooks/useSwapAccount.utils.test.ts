import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { shouldUseSwapCustomRecipientAddress } from './useSwapAccount.utils';

describe('shouldUseSwapCustomRecipientAddress', () => {
  it('keeps a confirmed custom recipient when the TO account is still empty', () => {
    expect(
      shouldUseSwapCustomRecipientAddress({
        type: ESwapDirectionType.TO,
        swapToAnotherAccountSwitchOn: true,
        selectedRecipientAddress: '0x1234',
        selectedRecipientNetworkId: 'evm--1',
        activeNetworkId: 'evm--1',
        tokenNetworkId: 'evm--1',
        isAllNetwork: false,
      }),
    ).toBe(true);
  });

  it('falls back when the confirmed recipient belongs to another network', () => {
    expect(
      shouldUseSwapCustomRecipientAddress({
        type: ESwapDirectionType.TO,
        swapToAnotherAccountSwitchOn: true,
        selectedRecipientAddress: '0x1234',
        selectedRecipientNetworkId: 'evm--1',
        activeNetworkId: 'evm--10',
        tokenNetworkId: 'evm--10',
        isAllNetwork: false,
      }),
    ).toBe(false);
  });

  it('allows the confirmed recipient on all-network accounts', () => {
    expect(
      shouldUseSwapCustomRecipientAddress({
        type: ESwapDirectionType.TO,
        swapToAnotherAccountSwitchOn: true,
        selectedRecipientAddress: '0x1234',
        selectedRecipientNetworkId: 'evm--1',
        activeNetworkId: 'onekeyall--all',
        tokenNetworkId: 'evm--1',
        isAllNetwork: true,
      }),
    ).toBe(true);
  });
});
