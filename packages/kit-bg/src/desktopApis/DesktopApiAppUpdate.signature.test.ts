import fs from 'fs';
import path from 'path';

import { generateKey } from 'openpgp';

import DesktopApiAppUpdate from './DesktopApiAppUpdate';

import type { IDesktopApi } from './base/types';

let mockASC = '';
let mockPublicKey: string | undefined;
jest.mock('electron', () => ({
  app: { getVersion: () => '6.6.0' },
  autoUpdater: {},
  BrowserWindow: {},
  dialog: {},
  shell: {},
}));
jest.mock('electron-log/main', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('@onekeyhq/desktop/app/libs/store', () => ({
  getASCFile: () => mockASC,
}));
jest.mock('@onekeyhq/desktop/app/i18n', () => ({
  ElectronTranslations: {
    update_signature_verification_failed_alert_text: 'Invalid update signature',
  },
}));
jest.mock('@onekeyhq/desktop/app/constant/gpg', () => ({
  get PUBLIC_KEY() {
    return (
      mockPublicKey ??
      jest.requireActual<{ PUBLIC_KEY: string }>(
        '@onekeyhq/desktop/app/constant/gpg',
      ).PUBLIC_KEY
    );
  },
}));
jest.mock('./electronUpdateRequest', () => ({ requestUpdateUrl: jest.fn() }));

// Official v6.6.0 release fixture; tests only read the saved public artifact.
// https://web.onekey-asset.com/app-monorepo/v6.6.0/OneKey-Wallet-6.6.0-mac-arm64.zip.SHA256SUMS.asc
const fixture = fs.readFileSync(
  path.join(
    __dirname,
    '__fixtures__',
    'OneKey-Wallet-6.6.0-mac-arm64.zip.SHA256SUMS.asc',
  ),
  'utf8',
);
const checksum =
  '8fb41055fafa2b19b90a50a2e177df30c9a88753c87932f5344025280c0f76fd';
let api: DesktopApiAppUpdate;
beforeEach(() => {
  mockASC = fixture;
  mockPublicKey = undefined;
  api = new DesktopApiAppUpdate({ desktopApi: {} as IDesktopApi });
});

test('verifies a real app-shell checksum signature with the production public key', async () => {
  expect(await api.getSha256()).toBe(checksum);
  expect(await api.getSha256('OneKey-Wallet-6.6.0-mac-arm64.zip')).toBe(
    checksum,
  );
  expect(await api.getSha256('OneKey-Wallet-6.5.0-mac-arm64.zip')).toBe('');
  expect(await api.verifyASC()).toBe(true);
});

test('rejects a changed signed checksum', async () => {
  mockASC = fixture.replace(checksum, `0${checksum.slice(1)}`);
  await expect(api.getSha256()).rejects.toThrow('Invalid update signature');
});

test('rejects a changed armored signature', async () => {
  mockASC = fixture.replace('iQJeBAEBCABIFiEE', 'jQJeBAEBCABIFiEE');
  await expect(api.verifyASC()).rejects.toThrow('Invalid update signature');
});

test('rejects the real release signature under an unrelated public key', async () => {
  const key = await generateKey({
    type: 'ecc',
    curve: 'curve25519',
    userIDs: [{ name: 'Fixture' }],
    format: 'armored',
  });
  mockPublicKey = key.publicKey;
  await expect(api.getSha256()).rejects.toThrow('Invalid update signature');
});
