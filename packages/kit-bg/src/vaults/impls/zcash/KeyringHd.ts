import bs58check from 'bs58check';

import {
  deriveZcashAccountSecrets,
  deriveZcashAccountViewingSecrets,
} from '@onekeyhq/core/src/chains/zcash/accountSecrets';
import type { IZcashAccountViewingSecrets } from '@onekeyhq/core/src/chains/zcash/accountSecrets';
import { ZCASH_NETWORK_MAIN } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import { fetchZcashChainTipDirect } from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect';
import type {
  IZcashPcztReviewRequest,
  IZcashTransparentTxRequest,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { seedFromHdCredentialAsync } from '@onekeyhq/core/src/secret';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import { getPbkdf2KdfParamsForNonDbTx } from '@onekeyhq/shared/src/appCrypto/modules/pbkdf2';
import { NotImplemented, OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { KeyringHd as KeyringHdBtc } from '../btc/KeyringHd';

import { resolveAndSaveZcashAccountMeta } from './accountMeta';
import {
  ZCASH_HW_PREVIEW_STOP_MESSAGE,
  isZcashHardwarePreviewEnabled,
  printZcashShieldedHardwarePreview,
  printZcashTransparentHardwarePreview,
} from './hardwareRequestPreview';
import { getZcashLifecycleMutex } from './lifecycle';
import { getZcashPcztReviewRequest } from './pcztReview';
import { signTransparentTransaction } from './signTransparentTransaction';
import { parseZcashTransaction } from './transactionReview';
import { zcashTrackUserOperation } from './vaultUtils';

import type { IEncodedTxZcash } from './types';
import type Vault from './Vault';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IExportAccountSecretKeysParams,
  IExportAccountSecretKeysResult,
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignTransactionParams,
} from '../../types';

// Version, depth, child number, chain code and key; skips the parent
// fingerprint (bytes 5..9).
function isSameAccountXpubKey(a: string, b: string): boolean {
  const left = bs58check.decode(a);
  const right = bs58check.decode(b);
  if (left.length !== 78 || right.length !== 78) return false;
  const keyBytes = (x: Uint8Array) =>
    Buffer.concat([Buffer.from(x.subarray(0, 5)), Buffer.from(x.subarray(9))]);
  return keyBytes(left).equals(keyBytes(right));
}

function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.length).toString(
    'hex',
  );
}

export class KeyringHd extends KeyringHdBtc {
  override coreApi = coreChainApi.zec.hd;

  override getPrivateKeys(
    _params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    throw new NotImplemented();
  }

  override exportAccountSecretKeys(
    _params: IExportAccountSecretKeysParams,
  ): Promise<IExportAccountSecretKeysResult> {
    throw new NotImplemented();
  }

  // PCZT signing path. The vault built and locked the PCZT at review time
  // (Vault.zcashAttachPczt); this keyring only proves it and signs with the
  // account keys re-derived from the seed in the background. A hardware
  // keyring runs the same three vault steps with the device as the signer.
  // Never routes through the BTC sighash path (core signTransaction throws).
  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx, password } = params;
    const encodedTx = parseZcashTransaction(unsignedTx.encodedTx);
    const accountId = this.vault.accountId;
    if (encodedTx.zcashMode === 'transparent') {
      return this.signTransparentTransaction({ encodedTx, password });
    }
    const zcashVault = this.vault as Vault;

    const meta = await this.backgroundApi.simpleDb.zcash.getAccountMeta({
      accountId,
    });
    if (!meta) {
      throw new OneKeyLocalError(
        'zcash: shielded account meta missing (use retryLocalWalletSetup to retry)',
      );
    }
    const { pcztHex, pcztReservationId: reservationId } = encodedTx;
    if (!pcztHex || !reservationId) {
      throw new OneKeyLocalError(
        'zcash: unsigned PCZT missing; build and review the transaction again',
      );
    }
    const lifecycleMutex = getZcashLifecycleMutex(meta.ufvk);
    return lifecycleMutex.runExclusive(async () => {
      const privacyModeEnabled =
        await this.backgroundApi.simpleDb.zcash.isPrivacyModeEnabled({
          accountId,
        });
      if (!privacyModeEnabled) {
        throw new OneKeyLocalError(
          'zcash: Privacy Mode was disabled before signing completed',
        );
      }
      let signed: { pcztHex: string };
      try {
        const review = getZcashPcztReviewRequest(encodedTx, meta.ufvk);
        if (await isZcashHardwarePreviewEnabled(this.backgroundApi)) {
          const api = await zcashVault.zcashGetApi();
          printZcashShieldedHardwarePreview({
            keys: meta,
            unprovedPcztHex: (
              await api.redactPcztForHardwareSigner({ pcztHex })
            ).pcztHex,
            review,
          });
          throw new OneKeyLocalError(ZCASH_HW_PREVIEW_STOP_MESSAGE);
        }
        const proved = await zcashVault.zcashPreparePcztForSigning({
          accountId,
          reservationId,
          pcztHex,
          encodedTx,
        });
        signed = await this.signPcztHex({
          password,
          hdIndex: meta.hdIndex,
          pcztHex: proved.pcztHex,
          review,
        });
        await zcashVault.zcashCommitSignedPczt({ accountId, reservationId });
      } catch (e) {
        try {
          await zcashVault.zcashAbandonPczt({ accountId, reservationId });
        } catch (releaseError) {
          console.error('[zcash] failed to release abandoned PCZT inputs', {
            accountId,
            releaseError,
          });
        }
        throw e;
      }
      const signedEncodedTx: IEncodedTxZcash = {
        ...encodedTx,
        signedPcztHex: signed.pcztHex,
        pcztReservationId: reservationId,
      };
      return {
        txid: '',
        rawTx: signed.pcztHex,
        encodedTx: signedEncodedTx,
      };
    });
  }

  private async signTransparentTransaction({
    encodedTx,
    password,
  }: {
    encodedTx: IEncodedTxZcash;
    password: string;
  }): Promise<ISignedTxPro> {
    const zcashVault = this.vault as Vault;
    const request = await zcashVault.zcashPrepareFreshTransparentRequest({
      encodedTx,
    });
    return signTransparentTransaction({
      journal: this.backgroundApi.simpleDb.zcash,
      accountId: this.vault.accountId,
      encodedTx,
      request,
      parseOutputs: (result) => zcashVault.zcashParseTransparentOutputs(result),
      sign: () =>
        this.withAccountSecrets(
          {
            password,
            derive: (seed) =>
              deriveZcashAccountSecrets({
                seed,
                accountIndex: request.accountIndex,
              }),
          },
          async (secrets) => {
            if (await isZcashHardwarePreviewEnabled(this.backgroundApi)) {
              try {
                await this.printTransparentHardwarePreview({
                  request,
                  secrets,
                });
              } catch (e) {
                const reason = e instanceof Error ? e.message : String(e);
                console.error(
                  '[zcash-hw-preview] transparent preview failed',
                  e,
                );
                throw new OneKeyLocalError(
                  `Zcash hardware request preview failed: ${reason}`,
                );
              }
              throw new OneKeyLocalError(ZCASH_HW_PREVIEW_STOP_MESSAGE);
            }
            const api = await zcashVault.zcashGetApi();
            // A shield proves its Orchard output here; hold off background sync on the same Worker.
            return zcashTrackUserOperation(() =>
              api.buildTransparentTxWithAccountXprv({
                ...request,
                accountXprvHex: secrets.accountXprvHex,
              }),
            );
          },
        ),
    });
  }

  // Derives account-scoped keys from the seed in the background and wipes the
  // seed before any SDK call: the Zcash SDK never receives the seed.
  private async withAccountSecrets<S extends IZcashAccountViewingSecrets, T>(
    {
      password,
      derive,
    }: {
      password: string;
      derive: (seed: Uint8Array) => S;
    },
    fn: (secrets: S) => Promise<T>,
  ): Promise<T> {
    const account = await this.backgroundApi.serviceAccount.getDBAccount({
      accountId: this.vault.accountId,
    });
    if (!('xpub' in account) || !account.xpub) {
      throw new OneKeyLocalError('zcash: account xpub missing');
    }
    const credentials = await this.baseGetCredentialsInfo({ password });
    const seedBuf = await seedFromHdCredentialAsync({
      hdCredential: checkIsDefined(credentials.hd),
      password,
      ...getPbkdf2KdfParamsForNonDbTx(),
    });
    let secrets: S;
    try {
      secrets = derive(seedBuf);
    } finally {
      seedBuf.fill(0);
    }
    try {
      if (!isSameAccountXpubKey(account.xpub, secrets.accountXpub)) {
        throw new OneKeyLocalError(
          'zcash: derived account key does not match this account',
        );
      }
      return await fn(secrets);
    } finally {
      secrets.orchardSk.fill(0);
    }
  }

  // Dev-only. Mirrors KeyringHardware.signTransparentTransaction: viewing key
  // and fingerprint as the device would return them, the xpub rebuilt from
  // that UFVK, then the same PCZT the device would be asked to sign.
  private async printTransparentHardwarePreview({
    request,
    secrets,
  }: {
    request: IZcashTransparentTxRequest;
    secrets: IZcashAccountViewingSecrets;
  }): Promise<void> {
    const vault = this.vault as Vault;
    const api = await vault.zcashGetApi();
    const meta = await this.backgroundApi.simpleDb.zcash.getAccountMeta({
      accountId: vault.accountId,
    });
    const keys = meta ?? {
      ...(await api.deriveAccount({
        network: ZCASH_NETWORK_MAIN,
        orchardSkHex: bytesToHex(secrets.orchardSk),
        accountXpub: secrets.accountXpub,
        hdIndex: request.accountIndex,
        lightwalletdUrl: await vault.zcashResolveLightwalletdUrl(),
      })),
      seedFingerprintHex: secrets.seedFingerprintHex,
      hdIndex: request.accountIndex,
    };
    const { xpub } = await api.deriveTransparentXpubFromUfvk({
      network: request.network,
      ufvk: keys.ufvk,
      hdIndex: request.accountIndex,
    });
    const account = await this.backgroundApi.serviceAccount.getDBAccount({
      accountId: vault.accountId,
    });
    // A UFVK carries no parent fingerprint, so the rebuilt xpub zeroes it
    // while a seed-derived one does not; compare the key itself.
    if (!('xpub' in account) || !isSameAccountXpubKey(account.xpub, xpub)) {
      throw new OneKeyLocalError(
        'zcash: viewing key does not derive this account xpub',
      );
    }
    const { pcztHex } = await api.createTransparentHardwarePczt({
      request,
      accountXpub: xpub,
      seedFingerprintHex: keys.seedFingerprintHex,
    });
    const device = await api.redactPcztForHardwareSigner({ pcztHex });
    printZcashTransparentHardwarePreview({
      keys,
      request,
      pcztHex: device.pcztHex,
    });
  }

  // Signs a proved PCZT hex with the account keys re-derived from the seed.
  private async signPcztHex({
    password,
    hdIndex,
    pcztHex,
    review,
  }: {
    password: string;
    hdIndex: number;
    pcztHex: string;
    review: IZcashPcztReviewRequest;
  }): Promise<{ pcztHex: string }> {
    return this.withAccountSecrets(
      {
        password,
        derive: (seed) =>
          deriveZcashAccountSecrets({ seed, accountIndex: hdIndex }),
      },
      async (secrets) => {
        const api = await (this.vault as Vault).zcashGetApi();
        return api.signPczt({
          network: ZCASH_NETWORK_MAIN,
          orchardSkHex: bytesToHex(secrets.orchardSk),
          accountXprvHex: secrets.accountXprvHex,
          hdIndex,
          pcztHex,
          review,
        });
      },
    );
  }

  override async prepareAccounts(
    params: IPrepareHdAccountsParams,
  ): Promise<IDBAccount[]> {
    const accounts = await super.prepareAccounts(params);
    for (const account of accounts) {
      // eslint-disable-next-line no-await-in-loop
      await this.initializePrivacyModeOff({ account });
    }
    return accounts;
  }

  private async initializePrivacyModeOff({ account }: { account: IDBAccount }) {
    const walletId = accountUtils.getWalletIdFromAccountId({
      accountId: account.id,
    });
    const [isFreshlyGeneratedMnemonic, walletCreatedAt] = await Promise.all([
      this.backgroundApi.simpleDb.zcash.getWalletFreshMnemonic({ walletId }),
      this.backgroundApi.simpleDb.zcash.getWalletCreatedAtTimestamp({
        walletId,
      }),
    ]);
    const birthdayMonthHint =
      isFreshlyGeneratedMnemonic && typeof walletCreatedAt === 'number'
        ? {
            timestamp: walletCreatedAt,
            source: 'created-wallet' as const,
          }
        : undefined;
    await this.backgroundApi.simpleDb.zcash.initializePrivacyModeOff({
      accountId: account.id,
      birthdayMonthHint,
    });
  }

  // Explicit, password-gated setup for an account whose enable operation was
  // persisted by ServicePrivacyChain. Account creation never enters this path.
  async retryLocalWalletSetup({
    password,
  }: {
    password: string;
  }): Promise<void> {
    const accountId = this.vault.accountId;
    const privacyModeState =
      await this.backgroundApi.simpleDb.zcash.getPrivacyModeState({
        accountId,
      });
    if (
      privacyModeState.intent !== 'on' &&
      privacyModeState.operation?.type !== 'enable'
    ) {
      throw new OneKeyLocalError(
        'zcash: privacy mode must be enabled before deriving viewing metadata',
      );
    }
    const account = await this.backgroundApi.serviceAccount.getDBAccount({
      accountId,
    });
    await this.withAccountSecrets(
      {
        password,
        derive: (seed) =>
          deriveZcashAccountViewingSecrets({
            seed,
            accountIndex: checkIsDefined(account.pathIndex),
          }),
      },
      (secrets) =>
        this.zcashDeriveAndSaveOneAccountMeta({
          account,
          secrets,
        }),
    );
  }

  private async zcashDeriveAndSaveOneAccountMeta({
    account,
    secrets,
  }: {
    account: IDBAccount;
    secrets: IZcashAccountViewingSecrets;
  }) {
    const secretsHdIndex = checkIsDefined(account.pathIndex);
    await resolveAndSaveZcashAccountMeta({
      backgroundApi: this.backgroundApi,
      account,
      derive: async ({ hdIndex }) => {
        if (hdIndex !== secretsHdIndex) {
          throw new OneKeyLocalError('zcash: account index mismatch');
        }
        const vault = this.vault as Vault;
        const api = await vault.zcashGetApi();
        const lightwalletdUrl = await vault.zcashResolveLightwalletdUrl();

        // lightwalletd calls go through a proxy that occasionally resets
        // mid-response (transient, not a real failure) -- absorb a few retries.
        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          try {
            // eslint-disable-next-line no-await-in-loop
            const derived = await api.deriveAccount({
              network: ZCASH_NETWORK_MAIN,
              orchardSkHex: bytesToHex(secrets.orchardSk),
              accountXpub: secrets.accountXpub,
              hdIndex,
              lightwalletdUrl,
            });
            const viewing = {
              ...derived,
              seedFingerprintHex: secrets.seedFingerprintHex,
            };
            if (viewing.chainTip !== null) return viewing;
            return {
              ...viewing,
              // eslint-disable-next-line no-await-in-loop
              chainTip: await fetchZcashChainTipDirect({
                lightwalletdUrl,
              }),
            };
          } catch (e) {
            if (attempt === maxAttempts) {
              throw e;
            }
            console.warn('[zcash] deriveAccount attempt failed, retrying', {
              accountId: account.id,
              attempt,
              error: e instanceof Error ? e.message : String(e),
            });
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          }
        }
        throw new OneKeyLocalError(
          'zcash: deriveAccount retry loop exited unexpectedly',
        );
      },
    });
  }
}
