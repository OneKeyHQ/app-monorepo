import {
  ESwapDirectionType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import {
  getSwapAddressAccountSelectorNum,
  getSwapRecipientEditorAccountId,
  getSwapRecipientEditorAccountInfo,
  shouldActivateSwapCustomRecipientAddress,
  shouldRequireSwapRecipientAddress,
  shouldResetSwapRecipientOnAccountNetworkSync,
  shouldShowSwapRecipientAddressInfo,
  shouldUseSwapCustomRecipientAddress,
} from './useSwapAccount.utils';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';

function buildAccountInfo(
  accountId?: string,
  {
    networkId,
    ready = true,
  }: {
    networkId?: string;
    ready?: boolean;
  } = {},
): IAccountSelectorActiveAccountInfo {
  return {
    ready,
    account: accountId
      ? ({
          id: accountId,
          addressDetail: networkId ? { networkId } : undefined,
        } as IAccountSelectorActiveAccountInfo['account'])
      : undefined,
    indexedAccount: undefined,
    dbAccount: undefined,
    accountName: '',
    wallet: undefined,
    device: undefined,
    network: undefined,
    vaultSettings: undefined,
    deriveType: undefined,
    deriveInfoItems: [],
  };
}

describe('getSwapRecipientEditorAccountInfo', () => {
  it('uses recipient ownership information when it is available', () => {
    const recipientAccountInfo = buildAccountInfo('recipient-account');
    const activeAccount = buildAccountInfo('active-account');

    expect(
      getSwapRecipientEditorAccountInfo({
        recipientAccountInfo,
        activeAccount,
      }),
    ).toBe(recipientAccountInfo);
  });

  it('falls back to the active account when an external recipient has no account ownership information', () => {
    const activeAccount = buildAccountInfo('active-account');

    expect(
      getSwapRecipientEditorAccountInfo({
        recipientAccountInfo: undefined,
        activeAccount,
      }),
    ).toBe(activeAccount);
  });

  it('uses a ready account context even before its network account is created', () => {
    const activeAccount = buildAccountInfo();

    expect(
      getSwapRecipientEditorAccountInfo({
        recipientAccountInfo: undefined,
        activeAccount,
      }),
    ).toBe(activeAccount);
  });

  it('waits until an account context is ready before rendering the editor', () => {
    expect(
      getSwapRecipientEditorAccountInfo({
        recipientAccountInfo: buildAccountInfo(undefined, { ready: false }),
        activeAccount: buildAccountInfo(undefined, { ready: false }),
      }),
    ).toBeUndefined();
  });
});

describe('getSwapRecipientEditorAccountId', () => {
  it('uses an account ID from the target network implementation', () => {
    expect(
      getSwapRecipientEditorAccountId({
        editorAccountInfo: buildAccountInfo('evm-account', {
          networkId: 'evm--1',
        }),
        targetNetworkId: 'evm--137',
      }),
    ).toBe('evm-account');
  });

  it('omits an account ID from an incompatible network implementation', () => {
    expect(
      getSwapRecipientEditorAccountId({
        editorAccountInfo: buildAccountInfo('evm-account', {
          networkId: 'evm--1',
        }),
        targetNetworkId: 'sol--101',
      }),
    ).toBeUndefined();
  });

  it('omits the account ID when no network account has been created', () => {
    expect(
      getSwapRecipientEditorAccountId({
        editorAccountInfo: buildAccountInfo(),
        targetNetworkId: 'sol--101',
      }),
    ).toBeUndefined();
  });
});

describe('shouldRequireSwapRecipientAddress', () => {
  const crossChainRecipientParams = {
    fromNetworkId: 'evm--1',
    toNetworkId: 'sol--101',
    fromAddress: '0x1234',
    toAddress: undefined,
    hasActionableQuote: true,
    hasSelectedRecipient: false,
    isAddressInfoReady: true,
    incognitoMode: false,
    providerSupportsRecipient: true,
    swapType: ESwapTabSwitchType.SWAP,
    targetCanCreateAddress: false,
  };

  it('requires a recipient for an actionable cross-chain quote without a target account', () => {
    expect(shouldRequireSwapRecipientAddress(crossChainRecipientParams)).toBe(
      true,
    );
  });

  it('does not require a recipient after the target address is resolved', () => {
    expect(
      shouldRequireSwapRecipientAddress({
        ...crossChainRecipientParams,
        toAddress: 'solana-address',
      }),
    ).toBe(false);
  });

  it('keeps an automatically selected recipient active after it is resolved', () => {
    expect(
      shouldRequireSwapRecipientAddress({
        ...crossChainRecipientParams,
        toAddress: 'solana-address',
        hasActionableQuote: false,
        hasSelectedRecipient: true,
      }),
    ).toBe(true);
  });

  it('uses address creation instead of recipient input when the target address can be created', () => {
    expect(
      shouldRequireSwapRecipientAddress({
        ...crossChainRecipientParams,
        targetCanCreateAddress: true,
      }),
    ).toBe(false);
  });

  it('waits for target address capability resolution', () => {
    expect(
      shouldRequireSwapRecipientAddress({
        ...crossChainRecipientParams,
        isAddressInfoReady: false,
      }),
    ).toBe(false);
  });

  it('does not require a recipient for same-chain swaps', () => {
    expect(
      shouldRequireSwapRecipientAddress({
        ...crossChainRecipientParams,
        toNetworkId: 'evm--1',
      }),
    ).toBe(false);
  });

  it('does not require a recipient when the selected provider cannot receive one', () => {
    expect(
      shouldRequireSwapRecipientAddress({
        ...crossChainRecipientParams,
        providerSupportsRecipient: false,
      }),
    ).toBe(false);
  });

  it('keeps incognito recipient input on its dedicated path', () => {
    expect(
      shouldRequireSwapRecipientAddress({
        ...crossChainRecipientParams,
        incognitoMode: true,
      }),
    ).toBe(false);
  });
});

describe('shouldActivateSwapCustomRecipientAddress', () => {
  const automaticRecipientParams = {
    type: ESwapDirectionType.TO,
    swapToAnotherAccountSwitchOn: true,
    selectedRecipientAddress: 'solana-address',
    swapEnableRecipientAddress: false,
    fromNetworkId: 'evm--1',
    toNetworkId: 'sol--101',
    incognitoMode: false,
    providerSupportsRecipient: true,
    swapType: ESwapTabSwitchType.SWAP,
    targetCanCreateAddress: false,
  };

  it('activates an automatically selected recipient for the cross-chain pair', () => {
    expect(
      shouldActivateSwapCustomRecipientAddress(automaticRecipientParams),
    ).toBe(true);
  });

  it('deactivates an automatic recipient after switching back to the source network', () => {
    expect(
      shouldActivateSwapCustomRecipientAddress({
        ...automaticRecipientParams,
        toNetworkId: 'evm--1',
      }),
    ).toBe(false);
  });

  it('keeps the explicit setting path available for same-chain recipients', () => {
    expect(
      shouldActivateSwapCustomRecipientAddress({
        ...automaticRecipientParams,
        swapEnableRecipientAddress: true,
        toNetworkId: 'evm--1',
      }),
    ).toBe(true);
  });

  it('deactivates a recipient when the selected provider does not support it', () => {
    expect(
      shouldActivateSwapCustomRecipientAddress({
        ...automaticRecipientParams,
        providerSupportsRecipient: false,
      }),
    ).toBe(false);
  });

  it('deactivates an automatic recipient when the new target can create an address', () => {
    expect(
      shouldActivateSwapCustomRecipientAddress({
        ...automaticRecipientParams,
        targetCanCreateAddress: true,
      }),
    ).toBe(false);
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
