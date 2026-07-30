import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import {
  getSwapAddressAccountSelectorNum,
  getSwapRecipientActionState,
  getSwapRecipientValidationAccountId,
  shouldResetSwapRecipientOnAccountNetworkSync,
  shouldShowSwapRecipientAddressInfo,
  shouldUseSwapCustomRecipientAddress,
} from './useSwapAccount.utils';

describe('getSwapRecipientActionState', () => {
  const validState = {
    isActionDisabled: false,
    isRefreshAction: false,
    noConnectWallet: false,
    hasQuoteToAmount: true,
    recipientAddress: undefined,
    isAddressInfoReady: true,
    providerSupportReceiveAddress: true,
  };

  it('allows recipient entry after target address resolution completes', () => {
    expect(getSwapRecipientActionState(validState)).toEqual({
      shouldEnterRecipient: true,
      shouldDisableAction: false,
    });
  });

  it('disables the action while target address resolution is pending', () => {
    expect(
      getSwapRecipientActionState({
        ...validState,
        isAddressInfoReady: false,
      }),
    ).toEqual({
      shouldEnterRecipient: false,
      shouldDisableAction: true,
    });
  });

  it('disables the action when the provider does not support a recipient', () => {
    expect(
      getSwapRecipientActionState({
        ...validState,
        providerSupportReceiveAddress: false,
      }),
    ).toEqual({
      shouldEnterRecipient: false,
      shouldDisableAction: true,
    });
  });

  it('preserves an existing disabled state when recipient entry is otherwise allowed', () => {
    expect(
      getSwapRecipientActionState({
        ...validState,
        isActionDisabled: true,
      }),
    ).toEqual({
      shouldEnterRecipient: false,
      shouldDisableAction: true,
    });
  });

  it('preserves a refresh action when the recipient address is missing', () => {
    expect(
      getSwapRecipientActionState({
        ...validState,
        isRefreshAction: true,
      }),
    ).toEqual({
      shouldEnterRecipient: false,
      shouldDisableAction: false,
    });
  });

  it('preserves a connect-wallet action when the recipient address is missing', () => {
    expect(
      getSwapRecipientActionState({
        ...validState,
        noConnectWallet: true,
      }),
    ).toEqual({
      shouldEnterRecipient: false,
      shouldDisableAction: false,
    });
  });
});

describe('getSwapRecipientValidationAccountId', () => {
  it('uses the account when it owns the resolved recipient address', () => {
    expect(
      getSwapRecipientValidationAccountId({
        accountId: 'account-1',
        accountAddress: '0xABCD',
        recipientAddress: '0xabcd',
      }),
    ).toBe('account-1');
  });

  it('omits a source account that could not resolve on the recipient network', () => {
    expect(
      getSwapRecipientValidationAccountId({
        accountId: 'watching--ltc',
        accountAddress: 'ltc1source',
      }),
    ).toBeUndefined();
  });

  it('omits an account that does not own the recipient address', () => {
    expect(
      getSwapRecipientValidationAccountId({
        accountId: 'account-1',
        accountAddress: '0xaaaa',
        recipientAddress: '0xbbbb',
      }),
    ).toBeUndefined();
  });
});

describe('getSwapAddressAccountSelectorNum', () => {
  it('uses the source account for the FROM address', () => {
    expect(
      getSwapAddressAccountSelectorNum({
        type: ESwapDirectionType.FROM,
        swapToAnotherAccountSwitchOn: true,
      }),
    ).toBe(0);
  });

  it('uses the source account for the TO address when custom recipient is off', () => {
    expect(
      getSwapAddressAccountSelectorNum({
        type: ESwapDirectionType.TO,
        swapToAnotherAccountSwitchOn: false,
      }),
    ).toBe(0);
  });

  it('uses the recipient account for the TO address when custom recipient is on', () => {
    expect(
      getSwapAddressAccountSelectorNum({
        type: ESwapDirectionType.TO,
        swapToAnotherAccountSwitchOn: true,
      }),
    ).toBe(1);
  });
});

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
