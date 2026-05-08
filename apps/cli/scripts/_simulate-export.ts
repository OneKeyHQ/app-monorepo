import { createCipheriv, createHash, randomBytes } from 'node:crypto';

import safeStringify from 'fast-safe-stringify';

import type {
  ICliBotWalletEncryptedCredential,
  ICliBotWalletRevealableSeed,
  IPersistAuthSessionInput,
} from '@onekeyhq/shared/src/types/cliBotWallet';

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

type IApiResponse<T> = {
  code: number;
  message: string;
  data: T;
};

const BOT_WALLET_KEY_API_PATH = '/prime/v1/bot-wallet-keys';
const BOT_WALLET_HASH_SALT = 'onekey-cli-bot-wallet-key-api:v1';

class SimulatedExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimulatedExportError';
  }
}

function buildBotWalletHash(walletId: string): string {
  return createHash('sha256')
    .update(`${BOT_WALLET_HASH_SALT}:${walletId}`, 'utf8')
    .digest('hex');
}

function getBotWalletKeyApiBaseUrl(): string {
  const explicitBaseUrl = process.env.BOT_WALLET_KEY_API_BASE_URL;
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/+$/, '');
  }
  return process.env.ONEKEY_E2E_ENV === 'prod'
    ? 'https://prime.onekeycn.com'
    : 'https://prime.onekeytest.com';
}

const BOT_WALLET_KEY_API_BASE_URL = getBotWalletKeyApiBaseUrl();

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
    throw new SimulatedExportError(
      'ONEKEY_E2E_REVEALABLE_SEED_JSON is malformed',
    );
  }
  return {
    entropyWithLangPrefixed: `0110${'00'.repeat(32)}`,
    seed: '11'.repeat(64),
  };
}

export function encryptCredential(key: Buffer): string {
  const nonce = randomBytes(12);
  const plaintext = Buffer.from(
    safeStringify.stableStringify(getSimulatedRevealableSeed()),
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
        'Bot Wallet E2E Export',
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
  botWalletHash: string,
): Promise<IRegisterResponse> {
  const response = await fetch(
    `${BOT_WALLET_KEY_API_BASE_URL}${BOT_WALLET_KEY_API_PATH}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ botWalletHash, keyBase64 }),
    },
  );

  if (!response.ok) {
    throw new SimulatedExportError(
      `register failed: HTTP ${response.status} ${await response.text()}`,
    );
  }

  const json = (await response.json()) as Partial<
    IApiResponse<Partial<IRegisterResponse>>
  >;
  if (json.code !== 0) {
    throw new SimulatedExportError(
      `register failed: API ${json.code ?? 'unknown'} ${
        json.message ?? 'Unknown error'
      }`,
    );
  }
  const data = json.data;
  if (
    typeof data?.keyId !== 'string' ||
    typeof data?.accessToken !== 'string'
  ) {
    throw new SimulatedExportError('register failed: malformed response');
  }

  return {
    accessToken: data.accessToken,
    keyId: data.keyId,
  };
}

async function main(): Promise<void> {
  if (process.argv.includes('--help')) {
    process.stdout.write(
      [
        'Usage: node -r esbuild-register apps/cli/scripts/_simulate-export.ts',
        '',
        'Registers a random key with the Bot Wallet key API and prints',
        'a CLI BotWallet auth payload JSON object to stdout.',
        '',
      ].join('\n'),
    );
    return;
  }

  const key = randomBytes(32);
  const keyBase64 = key.toString('base64');
  const walletId = process.env.ONEKEY_E2E_WALLET_ID ?? 'e2e-wallet-001';
  const registered = await registerKey(keyBase64, buildBotWalletHash(walletId));
  const fixture = (() => {
    try {
      return createSimulatedExportFixture({
        accessToken: registered.accessToken,
        key,
        keyId: registered.keyId,
        walletId,
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
