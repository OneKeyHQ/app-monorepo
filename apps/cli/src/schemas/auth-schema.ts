import { z } from 'zod';

import {
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
} from '@onekeyhq/shared/src/consts/dbConsts';

import {
  AUTH_LOGIN_METHOD_APP_TRANSFER,
  AUTH_LOGIN_METHOD_HARDWARE,
  PASSPHRASE_MODE_NONE,
  PASSPHRASE_MODE_ON_DEVICE,
  PASSPHRASE_MODE_ON_HOST,
} from '../core/auth/auth-types';

const authStatusSchema = z.enum(['authenticated', 'unauthenticated']);
const authLoginMethodSchema = z.enum([
  AUTH_LOGIN_METHOD_APP_TRANSFER,
  AUTH_LOGIN_METHOD_HARDWARE,
]);
const authWalletKindSchema = z.enum([WALLET_TYPE_HD, WALLET_TYPE_HW]);
const passphraseModeSchema = z.enum([
  PASSPHRASE_MODE_NONE,
  PASSPHRASE_MODE_ON_HOST,
  PASSPHRASE_MODE_ON_DEVICE,
]);
const secureStorageBackendSchema = z.enum([
  'macos-keychain',
  'linux-secret-service',
  'windows-credential-manager',
]);

const deviceInfoSchema = z.object({
  connectId: z.string(),
  deviceId: z.string(),
  deviceLabel: z.string(),
});

export const authLoginInputSchema = z.object({
  appTransfer: z
    .boolean()
    .optional()
    .describe('Authenticate with a OneKey App Bot Wallet'),
  hardware: z
    .boolean()
    .optional()
    .describe('Authenticate with a connected hardware wallet device'),
  deviceId: z
    .string()
    .optional()
    .describe(
      'Target hardware device UUID (from `onekey device search`). Required when multiple devices are connected. Only valid with --hardware.',
    ),
  passphraseMode: z
    .enum([
      PASSPHRASE_MODE_NONE,
      PASSPHRASE_MODE_ON_HOST,
      PASSPHRASE_MODE_ON_DEVICE,
    ])
    .optional()
    .describe(
      'Hardware passphrase mode. Required in non-interactive mode when device passphrase protection is enabled.',
    ),
  payload: z
    .string()
    .optional()
    .describe('CLI Bot Wallet payload JSON or base64-encoded JSON'),
});

export const authLoginOutputSchema = z.object({
  // z.enum (not z.literal) so the generator emits the literal type
  // instead of widening to `string` in cli-api.d.ts.
  auth_status: z.enum(['authenticated']),
  login_method: authLoginMethodSchema,
  source_label: z.string().nullable(),
  display_address: z.string().nullable(),
  storage_backend: secureStorageBackendSchema,
});

export const authStatusInputSchema = z.object({});

export const authStatusOutputSchema = z.object({
  authStatus: authStatusSchema,
  hasSecrets: z.boolean(),
  storageBackend: secureStorageBackendSchema,
  loginMethod: authLoginMethodSchema.nullable(),
  walletKind: authWalletKindSchema.nullable(),
  sourceLabel: z.string().nullable(),
  displayAddress: z.string().nullable(),
  importedAt: z.string().nullable(),
  device: deviceInfoSchema.nullable(),
  passphraseMode: passphraseModeSchema.nullable(),
});

export const authLogoutInputSchema = z.object({});

export const authLogoutOutputSchema = z.object({
  status: z.enum(['logged_out', 'already_logged_out', 'cancelled']),
  authStatus: authStatusSchema,
  changed: z.boolean(),
  sourceLabel: z.string().nullable(),
  displayAddress: z.string().nullable(),
});
