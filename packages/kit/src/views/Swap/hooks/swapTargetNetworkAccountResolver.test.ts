import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { isSwapAddressInfoReadyForOwner } from '../../../states/jotai/contexts/swap/addressInfoReadiness';
import { isSwapTokenDetailAddressInfoReady } from '../../../states/jotai/contexts/swap/tokenDetailRequest';

import {
  buildSwapTargetNetworkAccountResolutionPlan,
  getSwapTargetNetworkAccountResolution,
  resolveSwapTargetNetworkAccount,
} from './swapTargetNetworkAccountResolver';

const networkAccount = {
  id: 'account-evm-1',
} as INetworkAccount;

describe('resolveSwapTargetNetworkAccount', () => {
  it('coalesces concurrent consumers of the same owner and network', async () => {
    let finishRequest: ((account: INetworkAccount) => void) | undefined;
    const pendingRequest = new Promise<INetworkAccount>((resolve) => {
      finishRequest = resolve;
    });
    const resolve = jest.fn(() => pendingRequest);

    const consumers = Array.from({ length: 12 }, () =>
      resolveSwapTargetNetworkAccount({
        key: 'evm--1|indexed-1||default',
        resolve,
      }),
    );
    expect(resolve).toHaveBeenCalledTimes(1);

    finishRequest?.(networkAccount);
    await expect(Promise.all(consumers)).resolves.toEqual(
      Array.from({ length: 12 }, () => networkAccount),
    );
  });

  it('does not cache a failure and allows the same identity to retry', async () => {
    const resolve = jest
      .fn<Promise<INetworkAccount>, []>()
      .mockRejectedValueOnce(new OneKeyLocalError('network account failed'))
      .mockResolvedValueOnce(networkAccount);

    await expect(
      resolveSwapTargetNetworkAccount({ key: 'retry-key', resolve }),
    ).rejects.toThrow('network account failed');
    await expect(
      resolveSwapTargetNetworkAccount({ key: 'retry-key', resolve }),
    ).resolves.toBe(networkAccount);
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it('evicts a hung request after the bounded timeout', async () => {
    const neverSettles = new Promise<INetworkAccount>(() => undefined);
    const resolve = jest
      .fn<Promise<INetworkAccount>, []>()
      .mockReturnValueOnce(neverSettles)
      .mockResolvedValueOnce(networkAccount);

    await expect(
      resolveSwapTargetNetworkAccount({
        key: 'timeout-key',
        resolve,
        timeoutMs: 5,
      }),
    ).rejects.toThrow('timed out');
    await expect(
      resolveSwapTargetNetworkAccount({ key: 'timeout-key', resolve }),
    ).resolves.toBe(networkAccount);
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it('does not merge requests after owner or network identity changes', async () => {
    const resolve = jest.fn().mockResolvedValue(networkAccount);

    await Promise.all([
      resolveSwapTargetNetworkAccount({ key: 'evm--1|owner-a', resolve }),
      resolveSwapTargetNetworkAccount({ key: 'evm--137|owner-a', resolve }),
      resolveSwapTargetNetworkAccount({ key: 'evm--1|owner-b', resolve }),
    ]);

    expect(resolve).toHaveBeenCalledTimes(3);
  });
});

describe('Swap target-network account resolution semantics', () => {
  it('changes the request key when the target network or owner changes', () => {
    const base = buildSwapTargetNetworkAccountResolutionPlan({
      activeAccountReady: true,
      activeNetworkId: 'onekeyall--all',
      deriveType: 'default',
      indexedAccountId: 'indexed-a',
      isAllNetwork: true,
      tokenNetworkId: 'evm--1',
    });
    const changedNetwork = buildSwapTargetNetworkAccountResolutionPlan({
      activeAccountReady: true,
      activeNetworkId: 'onekeyall--all',
      deriveType: 'default',
      indexedAccountId: 'indexed-a',
      isAllNetwork: true,
      tokenNetworkId: 'evm--137',
    });
    const changedOwner = buildSwapTargetNetworkAccountResolutionPlan({
      activeAccountReady: true,
      activeNetworkId: 'onekeyall--all',
      deriveType: 'default',
      indexedAccountId: 'indexed-b',
      isAllNetwork: true,
      tokenNetworkId: 'evm--1',
    });

    expect(base.key).toBe('evm--1|indexed-a||default');
    expect(changedNetwork.key).not.toBe(base.key);
    expect(changedOwner.key).not.toBe(base.key);
  });

  it('keeps a ready no-wallet owner valid without starting a request', () => {
    const plan = buildSwapTargetNetworkAccountResolutionPlan({
      activeAccountReady: true,
      activeNetworkId: 'onekeyall--all',
      isAllNetwork: true,
      tokenNetworkId: 'evm--1',
    });
    const resolution = getSwapTargetNetworkAccountResolution({
      activeAccountReady: true,
      requestState: { status: 'idle' },
      targetKey: plan.key,
    });

    expect(plan).toEqual({ key: undefined, shouldResolve: false });
    expect(resolution).toEqual({
      isAddressInfoReady: true,
      status: 'not-required',
    });
  });

  it('distinguishes an active-owner failure from a resolved account', () => {
    const failed = getSwapTargetNetworkAccountResolution({
      activeAccountReady: true,
      requestState: { key: 'owner-key', status: 'failed' },
      targetKey: 'owner-key',
    });
    const resolved = getSwapTargetNetworkAccountResolution({
      activeAccountReady: true,
      requestState: {
        account: networkAccount,
        key: 'owner-key',
        status: 'resolved',
      },
      targetKey: 'owner-key',
    });

    expect(failed).toEqual({
      isAddressInfoReady: false,
      status: 'failed',
    });
    const failedOwnerReady = isSwapAddressInfoReadyForOwner({
      isAddressInfoReady: failed.isAddressInfoReady,
      owner: { indexedAccount: { id: 'indexed-a' } },
    });
    expect(failedOwnerReady).toBe(false);
    expect(
      isSwapTokenDetailAddressInfoReady({
        direction: ESwapDirectionType.FROM,
        addressInfoReady: failedOwnerReady,
      }),
    ).toBe(false);
    expect(resolved).toEqual({
      account: networkAccount,
      isAddressInfoReady: true,
      status: 'resolved',
    });
  });
});
