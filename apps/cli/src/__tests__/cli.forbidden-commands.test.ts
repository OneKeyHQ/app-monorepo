import { runCliEntry } from '../__test-utils__/cli-entry-runner';

import { extractJson } from './test-helpers';

function restoreIsTty(descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) {
    Object.defineProperty(process.stdout, 'isTTY', descriptor);
  } else {
    delete (process.stdout as { isTTY?: boolean }).isTTY;
  }
}

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

  it('keeps the entry runner in non-TTY JSON mode even if a previous test changed stdout', async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      process.stdout,
      'isTTY',
    );
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: true,
    });

    try {
      const result = await runCliEntry(['auth', 'switch']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe('');
      expect(JSON.parse(extractJson(result.stdout))).toMatchObject({
        ok: false,
        error: { code: 'UNKNOWN_COMMAND' },
      });
    } finally {
      restoreIsTty(originalDescriptor);
    }
  });
});
