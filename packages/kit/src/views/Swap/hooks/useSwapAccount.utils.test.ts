import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  ESwapDirectionType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import {
  getSwapAddressAccountSelectorNum,
  getSwapRecipientActionState,
  getSwapRecipientEditorAccountInfo,
  getSwapRecipientValidationAccountId,
  resolveSwapTargetNetworkAccount,
  shouldResetSwapRecipientOnAccountNetworkSync,
  shouldShowSwapRecipientAddressInfo,
  shouldShowSwapRecipientEntry,
  shouldUseSwapCustomRecipientAddress,
} from './useSwapAccount.utils';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';

function buildAccountInfo({
  accountId,
  ready = true,
}: {
  accountId?: string;
  ready?: boolean;
} = {}): IAccountSelectorActiveAccountInfo {
  return {
    ready,
    account: accountId
      ? ({ id: accountId } as IAccountSelectorActiveAccountInfo['account'])
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
  it('prefers ready recipient ownership information', () => {
    const recipientAccountInfo = buildAccountInfo({
      accountId: 'recipient-account',
    });
    const activeAccount = buildAccountInfo({ accountId: 'active-account' });

    expect(
      getSwapRecipientEditorAccountInfo({
        recipientAccountInfo,
        activeAccount,
      }),
    ).toBe(recipientAccountInfo);
  });

  it('falls back to a ready active account for an external recipient', () => {
    const activeAccount = buildAccountInfo({ accountId: 'active-account' });

    expect(
      getSwapRecipientEditorAccountInfo({
        recipientAccountInfo: undefined,
        activeAccount,
      }),
    ).toBe(activeAccount);
  });

  it('allows a ready editor context before its network account is created', () => {
    const activeAccount = buildAccountInfo();

    expect(
      getSwapRecipientEditorAccountInfo({
        recipientAccountInfo: undefined,
        activeAccount,
      }),
    ).toBe(activeAccount);
  });

  it('waits until an account context is ready', () => {
    expect(
      getSwapRecipientEditorAccountInfo({
        recipientAccountInfo: buildAccountInfo({ ready: false }),
        activeAccount: buildAccountInfo({ ready: false }),
      }),
    ).toBeUndefined();
  });
});

describe('resolveSwapTargetNetworkAccount', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps derive lookup failures unresolved', async () => {
    const getDeriveType = jest.fn(async () => {
      throw new OneKeyLocalError('derive lookup failed');
    });
    const getNetworkAccount = jest.fn(async () => ({ id: 'account-1' }));

    const resolvePromise = resolveSwapTargetNetworkAccount({
      getDeriveType,
      getNetworkAccount,
    });
    const resolveErrorPromise = resolvePromise.catch((error: unknown) => error);
    await jest.runAllTimersAsync();

    await expect(resolveErrorPromise).resolves.toMatchObject({
      message: 'derive lookup failed',
    });
    expect(getDeriveType).toHaveBeenCalledTimes(2);
    expect(getNetworkAccount).not.toHaveBeenCalled();
  });

  it('retries one transient derive lookup failure', async () => {
    const getDeriveType = jest
      .fn()
      .mockRejectedValueOnce(new OneKeyLocalError('derive lookup failed'))
      .mockResolvedValueOnce('BIP84');
    const getNetworkAccount = jest.fn(async () => ({ id: 'account-1' }));

    const resolvePromise = resolveSwapTargetNetworkAccount({
      getDeriveType,
      getNetworkAccount,
    });
    await jest.runAllTimersAsync();

    await expect(resolvePromise).resolves.toEqual({
      account: { id: 'account-1' },
      deriveType: 'BIP84',
    });
    expect(getDeriveType).toHaveBeenCalledTimes(2);
    expect(getNetworkAccount).toHaveBeenCalledWith('BIP84');
  });

  it('preserves the target derive type when its account is missing', async () => {
    const getDeriveType = jest.fn(async () => 'BIP84' as const);
    const getNetworkAccount = jest.fn(async () => {
      throw new OneKeyLocalError('account not found');
    });

    await expect(
      resolveSwapTargetNetworkAccount({
        getDeriveType,
        getNetworkAccount,
      }),
    ).resolves.toEqual({
      account: undefined,
      deriveType: 'BIP84',
    });
    expect(getNetworkAccount).toHaveBeenCalledWith('BIP84');
  });
});

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

describe('shouldShowSwapRecipientEntry', () => {
  const baseParams = {
    swapType: ESwapTabSwitchType.SWAP,
    incognitoMode: false,
    recipientAddressSettingOn: false,
    recipientRequired: false,
    providerSupportReceiveAddress: true,
    hasFromToken: true,
    hasToToken: true,
  };

  it('shows the entry when the custom recipient setting is on', () => {
    expect(
      shouldShowSwapRecipientEntry({
        ...baseParams,
        recipientAddressSettingOn: true,
      }),
    ).toBe(true);
  });

  it('hides the entry when the setting is off and no recipient is required', () => {
    expect(shouldShowSwapRecipientEntry(baseParams)).toBe(false);
  });

  it('forces the entry when a recipient is required even with the setting off (OK-58326)', () => {
    expect(
      shouldShowSwapRecipientEntry({
        ...baseParams,
        recipientRequired: true,
      }),
    ).toBe(true);
  });

  it('never shows the entry when the provider does not support a recipient', () => {
    expect(
      shouldShowSwapRecipientEntry({
        ...baseParams,
        recipientRequired: true,
        recipientAddressSettingOn: true,
        providerSupportReceiveAddress: false,
      }),
    ).toBe(false);
  });

  it('keeps the entry hidden in incognito mode on Swap where the inline input owns it', () => {
    expect(
      shouldShowSwapRecipientEntry({
        ...baseParams,
        recipientRequired: true,
        incognitoMode: true,
      }),
    ).toBe(false);
  });

  it('shows the entry in incognito mode on Limit and Stock', () => {
    expect(
      shouldShowSwapRecipientEntry({
        ...baseParams,
        recipientRequired: true,
        incognitoMode: true,
        swapType: ESwapTabSwitchType.LIMIT,
      }),
    ).toBe(true);
    expect(
      shouldShowSwapRecipientEntry({
        ...baseParams,
        recipientRequired: true,
        incognitoMode: true,
        swapType: ESwapTabSwitchType.STOCK,
      }),
    ).toBe(true);
  });

  it('requires both tokens to be selected', () => {
    expect(
      shouldShowSwapRecipientEntry({
        ...baseParams,
        recipientRequired: true,
        hasToToken: false,
      }),
    ).toBe(false);
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
