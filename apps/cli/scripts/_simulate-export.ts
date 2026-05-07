import { createCipheriv, randomBytes } from 'node:crypto';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  ICliBotWalletEncryptedCredential,
  ICliBotWalletRevealableSeed,
  IPersistAuthSessionInput,
} from '@onekeyhq/shared/src/types/cliBotWallet';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';

type IRegisterResponse = {
  accessToken: string;
  keyId: string;
};

type ISimulatedExportOptions = {
  accessToken?: string;
  key?: Buffer;
  keyId?: string;
  sourceLabel?: string;
  walletId?: string;
};

export type ISimulatedExportFixture = {
  input: Extract<IPersistAuthSessionInput, { kind: 'cli-bot-wallet' }>;
  keyBase64: string;
};

const SERVICE_BASE_URL =
  process.env.BOT_WALLET_KEY_SERVICE_URL ?? 'http://127.0.0.1:8787';

function getSimulatedRevealableSeed(): ICliBotWalletRevealableSeed {
  if (process.env.ONEKEY_E2E_REVEALABLE_SEED_JSON) {
    const parsed = JSON.parse(
      process.env.ONEKEY_E2E_REVEALABLE_SEED_JSON,
    ) as Partial<ICliBotWalletRevealableSeed> | null;
    if (
      parsed &&
      typeof parsed.entropyWithLangPrefixed === 'string' &&
      typeof parsed.seed === 'string'
    ) {
      return {
        entropyWithLangPrefixed: parsed.entropyWithLangPrefixed,
        seed: parsed.seed,
      };
    }
    throw new OneKeyLocalError('ONEKEY_E2E_REVEALABLE_SEED_JSON is malformed');
  }
  return {
    entropyWithLangPrefixed: `0110${'00'.repeat(32)}`,
    seed: '11'.repeat(64),
  };
}

export function encryptCredential(key: Buffer): string {
  const nonce = randomBytes(12);
  const plaintext = Buffer.from(
    stableStringify(getSimulatedRevealableSeed()),
    'utf8',
  );
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([nonce, ciphertext, tag]).toString('base64');
}

export function createSimulatedExportFixture(
  options: ISimulatedExportOptions = {},
): ISimulatedExportFixture {
  const key = Buffer.from(options.key ?? randomBytes(32));
  const keyBase64 = key.toString('base64');

  try {
    const payload: ICliBotWalletEncryptedCredential = {
      version: 1,
      walletId:
        options.walletId ??
        process.env.ONEKEY_E2E_WALLET_ID ??
        'e2e-wallet-001',
      ciphertextBase64: encryptCredential(key),
      keyId: options.keyId ?? 'K'.repeat(43),
      accessToken: options.accessToken ?? 'T'.repeat(43),
      sourceLabel:
        options.sourceLabel ??
        process.env.ONEKEY_E2E_SOURCE_LABEL ??
        'PoC E2E Export',
      algorithm: 'aes-256-gcm',
    };

    return {
      input: {
        kind: 'cli-bot-wallet',
        payload,
      },
      keyBase64,
    };
  } finally {
    key.fill(0);
  }
}

export async function registerKey(
  keyBase64: string,
): Promise<IRegisterResponse> {
  const response = await fetch(`${SERVICE_BASE_URL}/v1/bot-wallet-keys`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ keyBase64 }),
  });

  if (!response.ok) {
    throw new OneKeyLocalError(
      `register failed: HTTP ${response.status} ${await response.text()}`,
    );
  }

  const json = (await response.json()) as Partial<IRegisterResponse>;
  if (typeof json.keyId !== 'string' || typeof json.accessToken !== 'string') {
    throw new OneKeyLocalError('register failed: malformed response');
  }

  return {
    accessToken: json.accessToken,
    keyId: json.keyId,
  };
}

async function main(): Promise<void> {
  if (process.argv.includes('--help')) {
    process.stdout.write(
      [
        'Usage: node -r esbuild-register apps/cli/scripts/_simulate-export.ts',
        '',
        'Registers a random key with the local BotWallet key service and prints',
        'a CLI BotWallet auth payload JSON object to stdout.',
        '',
      ].join('\n'),
    );
    return;
  }

  const key = randomBytes(32);
  const keyBase64 = key.toString('base64');
  const registered = await registerKey(keyBase64);
  const fixture = (() => {
    try {
      return createSimulatedExportFixture({
        accessToken: registered.accessToken,
        key,
        keyId: registered.keyId,
      });
    } finally {
      key.fill(0);
    }
  })();

  process.stdout.write(`${JSON.stringify(fixture.input)}\n`);
}

if (process.argv[1]?.endsWith('_simulate-export.ts')) {
  void main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
