import { resolveOneKeyIdLastLoginMethod } from '@onekeyhq/shared/src/consts/oneKeyIdLastLoginMethod';

import { oneKeyIdLastLoginMethodPersistAtom } from './prime';

export async function persistOneKeyIdLastLoginMethod(
  method: unknown,
): Promise<boolean> {
  const resolved = resolveOneKeyIdLastLoginMethod(method);
  if (!resolved) {
    return false;
  }
  try {
    await oneKeyIdLastLoginMethodPersistAtom.set({ method: resolved });
    return true;
  } catch {
    return false;
  }
}
