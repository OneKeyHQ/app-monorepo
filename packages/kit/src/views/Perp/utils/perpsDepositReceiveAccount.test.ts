import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { resolvePerpsDepositReceiveAccountId } from './perpsDepositReceiveAccount';

import type { IPerpsDepositReceiveAccountDeps } from './perpsDepositReceiveAccount';

const EVM_ACCOUNT_ID = "hd-1--m/44'/60'/0'/0/0";
const SOL_ACCOUNT_ID = "hd-1--m/44'/501'/0'/0'";
const INDEXED_ACCOUNT_ID = 'hd-1--0';
const SOL_NETWORK_ID = 'sol--101';

function buildDeps(
  overrides: Partial<IPerpsDepositReceiveAccountDeps> = {},
): IPerpsDepositReceiveAccountDeps & {
  getGlobalDeriveTypeOfNetwork: jest.Mock;
  getNetworkAccount: jest.Mock;
} {
  return {
    getGlobalDeriveTypeOfNetwork: jest.fn(async () => 'default' as const),
    getNetworkAccount: jest.fn(async () => ({ id: SOL_ACCOUNT_ID })),
    ...overrides,
  } as IPerpsDepositReceiveAccountDeps & {
    getGlobalDeriveTypeOfNetwork: jest.Mock;
    getNetworkAccount: jest.Mock;
  };
}

describe('resolvePerpsDepositReceiveAccountId', () => {
  it('resolves the token-network account under the same indexed account', async () => {
    const deps = buildDeps();
    await expect(
      resolvePerpsDepositReceiveAccountId({
        selectedAccountId: EVM_ACCOUNT_ID,
        indexedAccountId: INDEXED_ACCOUNT_ID,
        tokenNetworkId: SOL_NETWORK_ID,
        deps,
      }),
    ).resolves.toBe(SOL_ACCOUNT_ID);
    expect(deps.getGlobalDeriveTypeOfNetwork).toHaveBeenCalledWith({
      networkId: SOL_NETWORK_ID,
    });
    expect(deps.getNetworkAccount).toHaveBeenCalledWith({
      accountId: undefined,
      indexedAccountId: INDEXED_ACCOUNT_ID,
      networkId: SOL_NETWORK_ID,
      deriveType: 'default',
    });
  });

  it('falls back to the default derive type when none is configured', async () => {
    const deps = buildDeps({
      getGlobalDeriveTypeOfNetwork: jest.fn(async () => undefined),
    });
    await resolvePerpsDepositReceiveAccountId({
      selectedAccountId: EVM_ACCOUNT_ID,
      indexedAccountId: INDEXED_ACCOUNT_ID,
      tokenNetworkId: SOL_NETWORK_ID,
      deps,
    });
    expect(deps.getNetworkAccount).toHaveBeenCalledWith(
      expect.objectContaining({ deriveType: 'default' }),
    );
  });

  it('hands resolution to the receive page when the indexed lookup fails', async () => {
    const deps = buildDeps({
      getNetworkAccount: jest.fn(async () => {
        throw new OneKeyLocalError('indexedAccounts not found');
      }),
    });
    await expect(
      resolvePerpsDepositReceiveAccountId({
        selectedAccountId: EVM_ACCOUNT_ID,
        indexedAccountId: INDEXED_ACCOUNT_ID,
        tokenNetworkId: SOL_NETWORK_ID,
        deps,
      }),
    ).resolves.toBe('');
  });

  it('keeps the selected account when there is no indexed account', async () => {
    const deps = buildDeps();
    await expect(
      resolvePerpsDepositReceiveAccountId({
        selectedAccountId: EVM_ACCOUNT_ID,
        indexedAccountId: null,
        tokenNetworkId: SOL_NETWORK_ID,
        deps,
      }),
    ).resolves.toBe(EVM_ACCOUNT_ID);
    expect(deps.getNetworkAccount).not.toHaveBeenCalled();
  });

  it('keeps the selected account when the token network is unknown', async () => {
    const deps = buildDeps();
    await expect(
      resolvePerpsDepositReceiveAccountId({
        selectedAccountId: EVM_ACCOUNT_ID,
        indexedAccountId: INDEXED_ACCOUNT_ID,
        tokenNetworkId: '',
        deps,
      }),
    ).resolves.toBe(EVM_ACCOUNT_ID);
    expect(deps.getNetworkAccount).not.toHaveBeenCalled();
  });

  it('returns an empty id when nothing is selected', async () => {
    const deps = buildDeps();
    await expect(
      resolvePerpsDepositReceiveAccountId({
        selectedAccountId: null,
        indexedAccountId: null,
        tokenNetworkId: SOL_NETWORK_ID,
        deps,
      }),
    ).resolves.toBe('');
  });
});
