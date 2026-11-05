import { normalizeTaskAccountAddress } from '@onekeyhq/kit/src/views/Earn/tasks/taskAddress';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

type ILutOwner = {
  accountId: string;
  networkId: string;
  accountAddress: string;
};

function ownerKey({ accountId, networkId, accountAddress }: ILutOwner) {
  if (
    !accountId ||
    accountId !== accountId.trim() ||
    !networkId ||
    networkId !== networkId.trim() ||
    !accountAddress ||
    accountAddress !== accountAddress.trim()
  ) {
    throw new OneKeyLocalError('Missing Borrow LUT task owner');
  }
  return JSON.stringify([
    networkId,
    normalizeTaskAccountAddress(networkId, accountAddress),
  ]);
}

// The caller owns the retained task's lifecycle. This registry is scoped to
// one JS runtime and never infers completion or releases a reservation by time.
export function createBorrowLutTaskRegistry<
  TController extends { getTask: () => unknown },
>() {
  const entries = new Map<
    string,
    { accountId: string; controller: TController; token: symbol }
  >();
  return {
    find: (owner: ILutOwner) => {
      const entry = entries.get(ownerKey(owner));
      return entry?.accountId === owner.accountId
        ? entry.controller
        : undefined;
    },
    findReservation: (owner: ILutOwner) => {
      const entry = entries.get(ownerKey(owner));
      if (!entry) return undefined;
      if (entry.accountId !== owner.accountId)
        return { type: 'conflict' as const };
      return {
        type: 'owned' as const,
        controller: entry.controller,
        token: entry.token,
      };
    },
    reserve: (owner: ILutOwner, controller: TController) => {
      const key = ownerKey(owner);
      const existing = entries.get(key);
      if (existing) {
        return { type: 'conflict' } as const;
      }
      const token = Symbol('borrow-lut-task');
      entries.set(key, { accountId: owner.accountId, controller, token });
      return { type: 'reserved', token } as const;
    },
    replace: (owner: ILutOwner, token: symbol, controller: TController) => {
      const key = ownerKey(owner);
      const existing = entries.get(key);
      if (
        !existing ||
        existing.accountId !== owner.accountId ||
        existing.token !== token
      )
        return undefined;
      const nextToken = Symbol('borrow-lut-task');
      entries.set(key, {
        accountId: owner.accountId,
        controller,
        token: nextToken,
      });
      return nextToken;
    },
    release: (owner: ILutOwner, token: symbol) => {
      const key = ownerKey(owner);
      const existing = entries.get(key);
      if (
        !existing ||
        existing.accountId !== owner.accountId ||
        existing.token !== token
      )
        return false;
      return entries.delete(key);
    },
  };
}
