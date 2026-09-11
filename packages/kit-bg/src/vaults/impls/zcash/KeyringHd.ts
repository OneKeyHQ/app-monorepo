import {
  ZCASH_LIGHTWALLETD_MAINNET,
  ZCASH_NETWORK_MAIN,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import { fetchZcashChainTipDirect } from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { seedFromHdCredentialAsync } from '@onekeyhq/core/src/secret';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import { getPbkdf2KdfParamsForNonDbTx } from '@onekeyhq/shared/src/appCrypto/modules/pbkdf2';
import { NotImplemented, OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { KeyringHd as KeyringHdBtc } from '../btc/KeyringHd';

import { resolveAndSaveZcashAccountMeta } from './accountMeta';
import { getZcashLifecycleMutex } from './lifecycle';

import type {
  IEncodedTxZcash,
  IZcashVaultPcztApi,
  IZcashVaultTransparentApi,
} from './types';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IExportAccountSecretKeysParams,
  IExportAccountSecretKeysResult,
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignTransactionParams,
} from '../../types';

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
  // USK re-derived from the seed. A hardware keyring runs the same three
  // vault steps with the device as the signer. Never routes through the BTC
  // sighash path (core signTransaction throws).
  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx, password } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxZcash;
    const accountId = this.vault.accountId;
    if (encodedTx.zcashMode === 'transparent') {
      return this.signTransparentTransaction({ encodedTx, password });
    }
    // typed view of the zcash vault's PCZT methods (type-only import avoids
    // the Vault <-> KeyringHd circular value import)
    const zcashVault = this.vault as unknown as IZcashVaultPcztApi;

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
        const proved = await zcashVault.zcashPreparePcztForSigning({
          accountId,
          reservationId,
          pcztHex,
        });
        signed = await this.signPcztHex({
          password,
          hdIndex: meta.hdIndex,
          pcztHex: proved.pcztHex,
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
    const zcashVault = this.vault as unknown as IZcashVaultTransparentApi;
    const request = await zcashVault.zcashPrepareFreshTransparentRequest({
      encodedTx,
    });
    const plan = checkIsDefined(encodedTx.zcashTransparentPlan);
    await this.backgroundApi.simpleDb.zcash.reserveTransparentOutpoints({
      accountId: this.vault.accountId,
      ownerId: plan.ownerId,
      outpoints: request.selectedOutpoints,
      currentHeight: request.targetHeight,
      expiryHeight: request.expiryHeight,
    });
    let pendingSaved = false;
    try {
      const credentials = await this.baseGetCredentialsInfo({ password });
      const seedBuf = await seedFromHdCredentialAsync({
        hdCredential: checkIsDefined(credentials.hd),
        password,
        ...getPbkdf2KdfParamsForNonDbTx(),
      });
      try {
        const zcashSdk = (
          await import('@onekeyhq/core/src/chains/zcash/sdkZcash/sdk')
        ).default;
        const result = await (
          await zcashSdk.getZcashApi()
        ).buildTransparentTxWithSeed({
          ...request,
          seedHex: seedBuf.toString('hex'),
        });
        const expectedOutpoints = new Set(
          request.selectedOutpoints.map(
            (outpoint) => `${outpoint.txid}:${outpoint.vout}`,
          ),
        );
        if (
          result.feeZat !== encodedTx.fee ||
          result.expiryHeight !== request.expiryHeight ||
          result.spentOutpoints.length !== expectedOutpoints.size ||
          result.spentOutpoints.some(
            (outpoint) =>
              !expectedOutpoints.has(`${outpoint.txid}:${outpoint.vout}`),
          )
        ) {
          throw new OneKeyLocalError(
            'Zcash transparent signing result did not match the reviewed transaction',
          );
        }
        const signedEncodedTx: IEncodedTxZcash = {
          ...encodedTx,
          zcashTransparentBuild: result,
        };
        await this.backgroundApi.simpleDb.zcash.saveTransparentPendingTx({
          accountId: this.vault.accountId,
          tx: {
            ownerId: plan.ownerId,
            rawTx: result.rawTx,
            txid: result.txid,
            spentOutpoints: result.spentOutpoints,
            expiryHeight: result.expiryHeight,
            createdAt: Date.now(),
            broadcastState: 'unknown',
          },
        });
        pendingSaved = true;
        return {
          txid: result.txid,
          rawTx: result.rawTx,
          encodedTx: signedEncodedTx,
        };
      } finally {
        seedBuf.fill(0);
      }
    } catch (error) {
      if (!pendingSaved) {
        await this.backgroundApi.simpleDb.zcash.releaseTransparentReservation({
          accountId: this.vault.accountId,
          ownerId: plan.ownerId,
        });
      }
      throw error;
    }
  }

  // Signs a proved PCZT hex with the USK re-derived from the seed.
  private async signPcztHex({
    password,
    hdIndex,
    pcztHex,
  }: {
    password: string;
    hdIndex: number;
    pcztHex: string;
  }): Promise<{ pcztHex: string }> {
    const credentials = await this.baseGetCredentialsInfo({ password });
    const seedBuf = await seedFromHdCredentialAsync({
      hdCredential: checkIsDefined(credentials.hd),
      password,
      ...getPbkdf2KdfParamsForNonDbTx(),
    });
    try {
      const zcashSdk = (
        await import('@onekeyhq/core/src/chains/zcash/sdkZcash/sdk')
      ).default;
      const api = await zcashSdk.getZcashApi();
      return await api.signPczt({
        network: ZCASH_NETWORK_MAIN,
        seedHex: seedBuf.toString('hex'),
        hdIndex,
        pcztHex,
      });
    } finally {
      seedBuf.fill(0);
    }
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
    const credentials = await this.baseGetCredentialsInfo({ password });
    const seedBuf = await seedFromHdCredentialAsync({
      hdCredential: checkIsDefined(credentials.hd),
      password,
      ...getPbkdf2KdfParamsForNonDbTx(),
    });
    try {
      await this.zcashDeriveAndSaveOneAccountMeta({
        account,
        seedHex: seedBuf.toString('hex'),
      });
    } finally {
      seedBuf.fill(0);
    }
  }

  private async zcashDeriveAndSaveOneAccountMeta({
    account,
    seedHex,
  }: {
    account: IDBAccount;
    seedHex: string;
  }) {
    await resolveAndSaveZcashAccountMeta({
      backgroundApi: this.backgroundApi,
      account,
      derive: async ({ hdIndex }) => {
        const zcashSdk = (
          await import('@onekeyhq/core/src/chains/zcash/sdkZcash/sdk')
        ).default;
        const api = await zcashSdk.getZcashApi();

        // lightwalletd calls go through a proxy that occasionally resets
        // mid-response (transient, not a real failure) -- absorb a few retries.
        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          try {
            // eslint-disable-next-line no-await-in-loop
            const derived = await api.deriveAccount({
              network: ZCASH_NETWORK_MAIN,
              seedHex,
              hdIndex,
              lightwalletdUrl: ZCASH_LIGHTWALLETD_MAINNET,
            });
            if (derived.chainTip !== null) return derived;
            return {
              ...derived,
              // eslint-disable-next-line no-await-in-loop
              chainTip: await fetchZcashChainTipDirect({
                lightwalletdUrl: ZCASH_LIGHTWALLETD_MAINNET,
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
