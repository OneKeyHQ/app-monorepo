import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  isPublicAccountCreationContext,
  withPublicAccountCreationContext,
} from './publicAccountCreationContext';

describe('trusted public account user creation context', () => {
  test('cannot be forged by a serialized object or flag and expires after the operation', async () => {
    const observed = await withPublicAccountCreationContext(
      async (context) => ({
        context,
        active: isPublicAccountCreationContext(context),
        copied: isPublicAccountCreationContext({ ...context }),
      }),
    );
    expect(observed.active).toBe(true);
    expect(observed.copied).toBe(false);
    expect(isPublicAccountCreationContext({})).toBe(false);
    expect(isPublicAccountCreationContext(observed.context)).toBe(false);
  });

  test('revokes the capability when the user creation flow fails', async () => {
    let captured: object | undefined;
    await expect(
      withPublicAccountCreationContext(async (context) => {
        captured = context;
        throw new OneKeyLocalError('Synthetic creation failure');
      }),
    ).rejects.toThrow('Synthetic creation failure');
    expect(isPublicAccountCreationContext(captured)).toBe(false);
  });
});
