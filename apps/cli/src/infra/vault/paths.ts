import os from 'node:os';
import path from 'node:path';

export const VAULT_DIR = path.join(os.homedir(), '.onekey-cli/bot-wallet');
export const VAULT_FILE = path.join(VAULT_DIR, 'vault.enc');
export const VAULT_LOCK = `${VAULT_FILE}.lock`;
export const MASTER_KEY_ACCOUNT = 'bot-wallet/master-key';
