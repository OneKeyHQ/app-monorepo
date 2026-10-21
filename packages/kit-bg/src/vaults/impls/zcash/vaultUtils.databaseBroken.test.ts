import { isZcashRuntimeDatabaseBroken } from './vaultUtils';

function runtimeError(code: string, params: Record<string, unknown>) {
  return Object.assign(new Error(code), {
    code,
    params,
    payload: { code, params },
  });
}

describe('isZcashRuntimeDatabaseBroken', () => {
  it('treats a failed migration as broken', () => {
    expect(
      isZcashRuntimeDatabaseBroken(
        runtimeError('DATABASE_ERROR', { operation: 'migrate' }),
      ),
    ).toBe(true);
  });

  // A newer app's database must never be wiped by an older one.
  it('never treats a database from a newer app as broken', () => {
    expect(
      isZcashRuntimeDatabaseBroken(
        runtimeError('DATABASE_TOO_NEW', { unknownMigrations: 1 }),
      ),
    ).toBe(false);
  });
});
