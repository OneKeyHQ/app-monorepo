import path from 'node:path';

import {
  MASTER_KEY_ACCOUNT,
  VAULT_DIR,
  VAULT_FILE,
  VAULT_LOCK,
} from '../paths';

describe('vault paths', () => {
  it('keeps all vault files inside the bot-wallet directory', () => {
    expect(VAULT_DIR).toContain(path.join('.onekey-cli', 'bot-wallet'));
    expect(VAULT_FILE).toBe(path.join(VAULT_DIR, 'vault.enc'));
  });

  it('uses a lock file beside vault.enc', () => {
    expect(VAULT_LOCK).toBe(`${VAULT_FILE}.lock`);
  });

  it('uses the single master-key account', () => {
    expect(MASTER_KEY_ACCOUNT).toBe('bot-wallet/master-key');
  });
});
