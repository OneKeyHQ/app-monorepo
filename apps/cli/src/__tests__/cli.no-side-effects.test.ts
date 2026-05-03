import { runCliEntry } from '../__test-utils__/cli-entry-runner';

describe('static CLI commands have no vault side effects', () => {
  it('--help exits successfully without reading keychain, vault, or axios', async () => {
    const result = await runCliEntry(['--help']);

    expect(result.exitCode).toBe(0);
    expect(result.sideEffects).toEqual({
      axiosCalls: 0,
      keychainGetCalls: 0,
      vaultReadCount: 0,
    });
  });

  it('--version exits successfully without reading keychain, vault, or axios', async () => {
    const result = await runCliEntry(['--version']);

    expect(result.exitCode).toBe(0);
    expect(result.sideEffects).toEqual({
      axiosCalls: 0,
      keychainGetCalls: 0,
      vaultReadCount: 0,
    });
  });

  it('schema discovery exits successfully without reading keychain, vault, or axios', async () => {
    const result = await runCliEntry(['schema', '--list']);

    expect(result.exitCode).toBe(0);
    expect(result.sideEffects).toEqual({
      axiosCalls: 0,
      keychainGetCalls: 0,
      vaultReadCount: 0,
    });
  });
});
