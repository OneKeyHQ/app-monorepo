import { runCliEntry } from '../__test-utils__/cli-entry-runner';

import { extractJson } from './test-helpers';

describe('forbidden CLI commands', () => {
  it.each([
    ['auth switch', ['auth', 'switch']],
    ['auth list', ['auth', 'list']],
    ['vault dump', ['vault', 'dump']],
  ])(
    '%s is rejected as an unknown command without vault side effects',
    async (_label, args) => {
      const result = await runCliEntry(args);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe('');
      expect(JSON.parse(extractJson(result.stdout))).toMatchObject({
        ok: false,
        error: { code: 'UNKNOWN_COMMAND' },
      });
      expect(result.sideEffects).toEqual({
        axiosCalls: 0,
        keychainGetCalls: 0,
        vaultReadCount: 0,
      });
    },
  );
});
