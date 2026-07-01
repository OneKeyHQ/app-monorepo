import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import {
  shouldResetSwapRecipientOnAccountNetworkSync,
  shouldShowSwapRecipientAddressInfo,
  shouldUseSwapCustomRecipientAddress,
} from './useSwapAccount.utils';

describe('shouldResetSwapRecipientOnAccountNetworkSync', () => {
  it('keeps a saved recipient while the current tab temporarily uses another token network', () => {
    expect(
      shouldResetSwapRecipientOnAccountNetworkSync({
        selectedRecipientAddress: '0x1234',
        selectedRecipientNetworkId: 'evm--1',
        hasTargetWallet: true,
        targetAccountId: 'account-1',
        sourceAccountId: 'account-1',
        providerSupportReceiveAddress: true,
      }),
    ).toBe(false);
  });

  it('resets when the current provider does not support a custom recipient', () => {
    expect(
      shouldResetSwapRecipientOnAccountNetworkSync({
        selectedRecipientAddress: '0x1234',
        selectedRecipientNetworkId: 'evm--1',
        hasTargetWallet: true,
        targetAccountId: 'account-1',
        sourceAccountId: 'account-1',
        providerSupportReceiveAddress: false,
      }),
    ).toBe(true);
  });

  it('resets an empty target wallet without a confirmed recipient network', () => {
    expect(
      shouldResetSwapRecipientOnAccountNetworkSync({
        hasTargetWallet: true,
        sourceAccountId: 'account-1',
        providerSupportReceiveAddress: true,
      }),
    ).toBe(true);
  });

  it('resets when a different target account was selected but not confirmed', () => {
    expect(
      shouldResetSwapRecipientOnAccountNetworkSync({
        selectedRecipientNetworkId: 'evm--1',
        hasTargetWallet: true,
        targetAccountId: 'account-2',
        sourceAccountId: 'account-1',
        providerSupportReceiveAddress: true,
      }),
    ).toBe(true);
  });
});

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

  it('keeps an EVM recipient when switching between EVM token networks', () => {
    expect(
      shouldUseSwapCustomRecipientAddress({
        type: ESwapDirectionType.TO,
        swapToAnotherAccountSwitchOn: true,
        selectedRecipientAddress: '0x1234',
        selectedRecipientNetworkId: 'evm--56',
        activeNetworkId: 'evm--1',
        tokenNetworkId: 'evm--1',
        isAllNetwork: false,
      }),
    ).toBe(true);
  });

  it('falls back when the confirmed recipient belongs to an incompatible network', () => {
    expect(
      shouldUseSwapCustomRecipientAddress({
        type: ESwapDirectionType.TO,
        swapToAnotherAccountSwitchOn: true,
        selectedRecipientAddress: '0x1234',
        selectedRecipientNetworkId: 'sol--101',
        activeNetworkId: 'evm--1',
        tokenNetworkId: 'evm--1',
        isAllNetwork: false,
      }),
    ).toBe(false);
  });

  it('allows the confirmed recipient on all-network accounts when the token network is compatible', () => {
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

  it('falls back on all-network accounts when the confirmed recipient is incompatible with the token network', () => {
    expect(
      shouldUseSwapCustomRecipientAddress({
        type: ESwapDirectionType.TO,
        swapToAnotherAccountSwitchOn: true,
        selectedRecipientAddress: 'sol-recipient',
        selectedRecipientNetworkId: 'sol--101',
        activeNetworkId: 'onekeyall--all',
        tokenNetworkId: 'evm--1',
        isAllNetwork: true,
      }),
    ).toBe(false);
  });
});

describe('shouldShowSwapRecipientAddressInfo', () => {
  it('shows the selected recipient info when the selected network matches the target token network', () => {
    expect(
      shouldShowSwapRecipientAddressInfo({
        swapToAnotherAccountSwitchOn: true,
        selectedRecipientAddress: '0x1234',
        selectedRecipientNetworkId: 'evm--1',
        toTokenNetworkId: 'evm--1',
        toAddressNetworkId: 'evm--1',
      }),
    ).toBe(true);
  });

  it('shows the selected recipient info when switching between EVM networks', () => {
    expect(
      shouldShowSwapRecipientAddressInfo({
        swapToAnotherAccountSwitchOn: true,
        selectedRecipientAddress: '0x1234',
        selectedRecipientNetworkId: 'evm--56',
        toTokenNetworkId: 'evm--1',
        toAddressNetworkId: 'evm--1',
      }),
    ).toBe(true);
  });

  it('falls back when the selected recipient belongs to an incompatible network', () => {
    expect(
      shouldShowSwapRecipientAddressInfo({
        swapToAnotherAccountSwitchOn: true,
        selectedRecipientAddress: '0x1234',
        selectedRecipientNetworkId: 'sol--101',
        toTokenNetworkId: 'evm--1',
        toAddressNetworkId: 'evm--1',
      }),
    ).toBe(false);
  });

  it('falls back when the recipient switch is off', () => {
    expect(
      shouldShowSwapRecipientAddressInfo({
        swapToAnotherAccountSwitchOn: false,
        selectedRecipientAddress: '0x1234',
        selectedRecipientNetworkId: 'evm--1',
        toTokenNetworkId: 'evm--1',
        toAddressNetworkId: 'evm--1',
      }),
    ).toBe(false);
  });
});
