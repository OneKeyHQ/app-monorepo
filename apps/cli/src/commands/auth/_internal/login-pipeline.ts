import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  ICliBotWalletEncryptedCredential,
  ILegacyDefaultPayload,
  IPersistAuthSessionInput,
} from '@onekeyhq/shared/src/types/cliBotWallet';

import { AUTH_DEFAULT_EVM_NETWORK_ID } from '../../../core/auth/auth-types';
import {
  ABSOLUTE_MAX_TTL_MS,
  VaultClient,
  createMasterKey,
  createVaultAddressCacheKey,
} from '../../../infra/vault';
import { cliBotWalletPayloadSchema } from '../../../schemas/cli-bot-wallet-payload';

import { executeLogoutPipeline } from './logout-pipeline';

import type { IVaultPlaintext } from '../../../infra/vault';

export type ILoginPipelineInput = {
  kind: 'cli-bot-wallet';
  payload: ICliBotWalletEncryptedCredential;
};

export type ILoginPipelineResult = {
  ok: true;
  data: {
    keyId: string;
  };
};

export class LoginPipelineError extends Error {
  constructor(readonly code: 'INVALID_PAYLOAD') {
    super(code);
    this.name = 'LoginPipelineError';
  }
}

export type IDeriveDisplayAddress = () => Promise<string>;

export type ILoginPipelineDependencies = {
  logoutPipeline?: () => Promise<void>;
  createMasterKey?: typeof createMasterKey;
  vaultClient?: Pick<VaultClient, 'initialize'> &
    Partial<Pick<VaultClient, 'atomicMutate'>>;
  now?: () => number;
  /**
   * Receiver-side hook that derives the first EVM address from the just-
   * imported credential. Defaults to the lazy-loaded `SignerHd` wired
   * against the live vault + local key service. Tests inject a stub.
   *
   * Trust boundary: the sender does NOT supply `displayAddress` in the wire
   * payload. The CLI MUST derive it locally from the decrypted seed so that
   * any user-facing address claim is the result of our own crypto on our own
   * decrypt — never something the App side could have lied about.
   */
  deriveDisplayAddress?: IDeriveDisplayAddress;
};

export type IRouteAuthSessionDependencies = ILoginPipelineDependencies & {
  legacyDefaultHandler?: (
    payload: ILegacyDefaultPayload,
  ) => Promise<ILoginPipelineResult>;
};

function assertNever(value: never): never {
  throw new OneKeyLocalError(
    `Unsupported auth session kind: ${JSON.stringify(value)}`,
  );
}

export function createInitialVaultPlaintext(
  payload: ICliBotWalletEncryptedCredential,
  now: number,
): IVaultPlaintext {
  return {
    schemaVersion: 1,
    records: {
      [payload.keyId]: {
        walletId: payload.walletId,
        accessToken: payload.accessToken,
        ciphertextBase64: payload.ciphertextBase64,
        createdAt: now,
      },
    },
    // The address cache and sessionLabels.displayAddress start empty: the
    // receiver has not yet decrypted the credential, so it has no chain
    // identity to record. `executeLoginPipeline` populates both immediately
    // after vault init via `deriveDisplayAddress()`.
    cache: {},
    metadata: {
      activeWalletId: payload.walletId,
      activeKeyId: payload.keyId,
      schemaVersion: 1,
      vaultCreatedAt: now,
    },
    sessionLabels: {
      [payload.keyId]: {
        displayAddress: '',
        sourceLabel: payload.sourceLabel,
      },
    },
  };
}

async function defaultDeriveDisplayAddress(): Promise<string> {
  const { SignerHd } = await import('../../../signer/impls/evm/SignerHd');
  const signer = new SignerHd();
  const addressInfo = await signer.getAddress(AUTH_DEFAULT_EVM_NETWORK_ID);
  return addressInfo.address;
}

export async function executeLoginPipeline(
  input: ILoginPipelineInput,
  dependencies: ILoginPipelineDependencies = {},
): Promise<ILoginPipelineResult> {
  const parsedPayload = cliBotWalletPayloadSchema.parse(input.payload);

  const logoutPipeline =
    dependencies.logoutPipeline ?? (() => executeLogoutPipeline());
  const createMasterKeyFn = dependencies.createMasterKey ?? createMasterKey;
  const vaultClient = dependencies.vaultClient ?? new VaultClient();
  const now = dependencies.now ?? Date.now;
  const deriveDisplayAddress =
    dependencies.deriveDisplayAddress ?? defaultDeriveDisplayAddress;

  await logoutPipeline();
  const masterKey = await createMasterKeyFn();
  masterKey.fill(0);
  await vaultClient.initialize(
    createInitialVaultPlaintext(parsedPayload, now()),
  );

  // Receiver-side address derivation: best-effort. A failure here leaves
  // sessionLabels.displayAddress = '' (the initial value). The signer flow
  // will retry derivation on first sign(), and any user-facing display path
  // tolerates empty string per the redact / mask helpers.
  let derivedAddress = '';
  try {
    derivedAddress = await deriveDisplayAddress();
  } catch {
    derivedAddress = '';
  }

  if (derivedAddress) {
    const issuedAt = now();
    if (vaultClient.atomicMutate) {
      await vaultClient.atomicMutate((vault) => ({
        nextVault: {
          ...vault,
          cache: {
            ...vault.cache,
            [createVaultAddressCacheKey(
              parsedPayload.walletId,
              parsedPayload.keyId,
            )]: {
              hdCredentialBlob: derivedAddress,
              issuedAt,
              expiresAt: issuedAt + ABSOLUTE_MAX_TTL_MS,
            },
          },
          sessionLabels: {
            ...vault.sessionLabels,
            [parsedPayload.keyId]: {
              ...vault.sessionLabels[parsedPayload.keyId],
              displayAddress: derivedAddress,
            },
          },
        },
        result: undefined,
      }));
    }
  }

  return {
    ok: true,
    data: {
      keyId: parsedPayload.keyId,
    },
  };
}

export async function routeAuthSession(
  input: IPersistAuthSessionInput,
  dependencies: IRouteAuthSessionDependencies = {},
): Promise<ILoginPipelineResult> {
  switch (input.kind) {
    case 'cli-bot-wallet':
      return executeLoginPipeline(
        { kind: 'cli-bot-wallet', payload: input.payload },
        dependencies,
      );
    case 'legacy-default':
      if (dependencies.legacyDefaultHandler) {
        return dependencies.legacyDefaultHandler(input.payload);
      }
      throw new LoginPipelineError('INVALID_PAYLOAD');
    default:
      return assertNever(input);
  }
}
