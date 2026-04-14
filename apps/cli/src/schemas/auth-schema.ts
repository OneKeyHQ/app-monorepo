import { z } from 'zod';

const authStatusSchema = z.enum(['authenticated', 'unauthenticated']);
const authLoginMethodSchema = z.enum(['mnemonic', 'app_transfer']);
const authWalletKindSchema = z.enum(['hd']);
const secureStorageBackendSchema = z.enum([
  'macos-keychain',
  'linux-secret-service',
]);

export const authLoginInputSchema = z.object({
  mnemonic: z
    .boolean()
    .optional()
    .describe('Authenticate with a BIP39 mnemonic phrase'),
  appTransfer: z
    .boolean()
    .optional()
    .describe('Authenticate with a OneKey App Bot Wallet'),
});

export const authLoginOutputSchema = z.union([
  z.object({
    address: z.string().describe('Imported wallet address'),
  }),
  z.object({
    auth_status: z.literal('authenticated'),
    login_method: z.literal('app_transfer'),
    source_label: z.string().nullable(),
    display_address: z.string().nullable(),
    storage_backend: secureStorageBackendSchema,
  }),
]);

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
});

export const authLogoutInputSchema = z.object({});

export const authLogoutOutputSchema = z.object({
  status: z.enum(['logged_out', 'already_logged_out', 'cancelled']),
  authStatus: authStatusSchema,
  changed: z.boolean(),
  sourceLabel: z.string().nullable(),
  displayAddress: z.string().nullable(),
});
