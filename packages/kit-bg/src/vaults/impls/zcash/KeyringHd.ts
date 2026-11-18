import bs58check from 'bs58check';

import {
  deriveZcashAccountSecrets,
  deriveZcashAccountTransparentSecrets,
  deriveZcashAccountViewingSecrets,
} from '@onekeyhq/core/src/chains/zcash/accountSecrets';
import type {
  IZcashAccountSecrets,
  IZcashAccountTransparentSecrets,
  IZcashAccountViewingSecrets,
} from '@onekeyhq/core/src/chains/zcash/accountSecrets';
import { isShieldedAddress } from '@onekeyhq/core/src/chains/zcash/sdkZcash';
import { ZCASH_NETWORK_MAIN } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import type {
  IZcashDeriveAccountKeysResult,
  IZcashPcztReviewRequest,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { seedFromHdCredentialAsync } from '@onekeyhq/core/src/secret';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import { getPbkdf2KdfParamsForNonDbTx } from '@onekeyhq/shared/src/appCrypto/modules/pbkdf2';
import { NotImplemented, OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { ensureLocalWalletPrivacyAvailable } from '../../localWallet/remoteConfig';
import { KeyringHd as KeyringHdBtc } from '../btc/KeyringHd';

import { resolveAndSaveZcashAccountMeta } from './accountMeta';
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

  // Proves the review-time PCZT, verifies it against the review, signs with seed-derived keys, then combines. Never uses the BTC sighash path.
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
    const privacyContext = {
      backgroundApi: this.backgroundApi,
      networkId: this.vault.networkId,
    };
    await ensureLocalWalletPrivacyAvailable(privacyContext);

    const meta =
      await this.backgroundApi.simpleDb.privacyChainState.getZcashAccountMeta({
        accountId,
      });
    if (!meta) {
      throw new OneKeyLocalError(
        'zcash: shielded account meta missing (use retryLocalWalletSetup to retry)',
      );
    }
    const { pcztHex } = encodedTx;
    if (!pcztHex) {
      throw new OneKeyLocalError(
        'zcash: unsigned PCZT missing; build and review the transaction again',
      );
    }
    const ufvk = await zcashVault.zcashGetAccountUfvk({ accountId, meta });
    const lifecycleMutex = getZcashLifecycleMutex(meta.vkFp);
    return lifecycleMutex.runExclusive(async () => {
      await ensureLocalWalletPrivacyAvailable(privacyContext);
      const privacyModeEnabled =
        await this.backgroundApi.simpleDb.privacyChainState.isZcashPrivacyModeEnabled(
          {
            accountId,
          },
        );
      if (!privacyModeEnabled) {
        throw new OneKeyLocalError(
          'zcash: Privacy Mode was disabled before signing completed',
        );
      }
      const review = getZcashPcztReviewRequest(encodedTx, ufvk);
      const proved = await zcashVault.zcashPreparePcztForSigning({
        accountId,
        pcztHex,
        encodedTx,
      });
      await ensureLocalWalletPrivacyAvailable(privacyContext);
      // Signing verifies the proved PCZT against this review before using the keys.
      const signed = await this.signPcztHex({
        password,
        hdIndex: meta.hdIndex,
        pcztHex: proved.pcztHex,
        review,
      });
      const combined = await zcashVault.zcashCombineSignedPczt({
        accountId,
        originalPcztHex: proved.pcztHex,
        signedPcztHex: signed.pcztHex,
      });
      await ensureLocalWalletPrivacyAvailable(privacyContext);
      const signedEncodedTx: IEncodedTxZcash = {
        ...encodedTx,
        signedPcztHex: combined.pcztHex,
      };
      return {
        txid: '',
        rawTx: combined.pcztHex,
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
    const accountId = this.vault.accountId;
    const request = await zcashVault.zcashPrepareFreshTransparentRequest({
      encodedTx,
    });
    // A shielded payment is sealed to the account's OVK, from the stored UFVK or one rebuilt from the seed.
    const isShielding = request.recipients.some(({ address }) =>
      isShieldedAddress(address),
    );
    const storedUfvk = isShielding
      ? await zcashVault.zcashGetStoredUfvk({ accountId })
      : undefined;
    const rebuildsUfvk = isShielding && !storedUfvk;
    return signTransparentTransaction({
      journal: this.backgroundApi.simpleDb.privacyChainJournal,
      sentStore: this.backgroundApi.simpleDb.privacyChainZcashSent,
      accountId,
      encodedTx,
      request,
      parseOutputs: (result) => zcashVault.zcashParseTransparentOutputs(result),
      sign: async () => {
        // The Orchard key is derived only to rebuild a missing UFVK.
        return this.withAccountSecrets(
          {
            password,
            derive: (
              seed,
            ): IZcashAccountTransparentSecrets &
              Partial<Pick<IZcashAccountSecrets, 'orchardSk'>> =>
              rebuildsUfvk
                ? deriveZcashAccountSecrets({
                    seed,
                    accountIndex: request.accountIndex,
                  })
                : deriveZcashAccountTransparentSecrets({
                    seed,
                    accountIndex: request.accountIndex,
                  }),
          },
          async (secrets) => {
            const api = await zcashVault.zcashGetApi();
            const ufvk = secrets.orchardSk
              ? (
                  await api.deriveAccountKeys({
                    network: ZCASH_NETWORK_MAIN,
                    orchardSkHex: bytesToHex(secrets.orchardSk),
                    accountXpub: secrets.accountXpub,
                    hdIndex: request.accountIndex,
                  })
                ).ufvk
              : storedUfvk;
            // A shield proves its Orchard output here; hold off background sync on the same Worker.
            return zcashTrackUserOperation(() =>
              api.buildTransparentTxWithAccountXprv({
                ...request,
                accountXprvHex: secrets.accountXprvHex,
                ufvk,
              }),
            );
          },
        );
      },
    });
  }

  // Derives account keys from the seed in bg and wipes the seed before any SDK call.
  private async withAccountSecrets<
    S extends Pick<IZcashAccountSecrets, 'accountXpub'> &
      Partial<Pick<IZcashAccountSecrets, 'orchardSk'>>,
    T,
  >(
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
      secrets.orchardSk?.fill(0);
    }
  }

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

  // Explicit, password-gated setup for an account whose enable was persisted; account creation never enters this path.
  async retryLocalWalletSetup({
    password,
    forceDerivation,
  }: {
    password: string;
    forceDerivation?: boolean;
  }): Promise<void> {
    const accountId = this.vault.accountId;
    const privacyModeState =
      await this.backgroundApi.simpleDb.privacyChainState.getZcashPrivacyModeState(
        {
          accountId,
        },
      );
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
          forceDerivation,
        }),
    );
  }

  private async zcashDeriveAndSaveOneAccountMeta({
    account,
    secrets,
    forceDerivation,
  }: {
    account: IDBAccount;
    secrets: IZcashAccountViewingSecrets;
    forceDerivation?: boolean;
  }) {
    const secretsHdIndex = checkIsDefined(account.pathIndex);
    await resolveAndSaveZcashAccountMeta({
      backgroundApi: this.backgroundApi,
      networkId: this.vault.networkId,
      account,
      forceDerivation,
      derive: async ({ hdIndex }) => {
        if (hdIndex !== secretsHdIndex) {
          throw new OneKeyLocalError('zcash: account index mismatch');
        }
        const vault = this.vault as Vault;
        const api = await vault.zcashGetApi();
        let keys: IZcashDeriveAccountKeysResult;
        try {
          keys = await api.deriveAccountKeys({
            network: ZCASH_NETWORK_MAIN,
            orchardSkHex: bytesToHex(secrets.orchardSk),
            accountXpub: secrets.accountXpub,
            hdIndex,
          });
        } finally {
          secrets.orchardSk.fill(0);
        }
        const viewing = {
          ...keys,
          seedFingerprintHex: secrets.seedFingerprintHex,
        };
        return { ...viewing, chainTip: null };
      },
    });
  }
}
