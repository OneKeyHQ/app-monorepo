import { isEqual, isNil, isObject, isString } from 'lodash';
import natsort from 'natsort';

import {
  getBtcForkNetwork,
  getPublicKeyFromXpub,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import { verifyNexaAddressPrefix } from '@onekeyhq/core/src/chains/nexa/sdkNexa';
import {
  decrypt,
  encodeSensitiveText,
  encryptImportedCredential,
  fixV4VerifyStringToV5,
  revealEntropyToMnemonic,
  sha256,
} from '@onekeyhq/core/src/secret';
import {
  ECoreApiExportedSecretKeyType,
  type ICoreCredentialsInfo,
} from '@onekeyhq/core/src/types';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import {
  COINTYPE_ADA,
  COINTYPE_BTC,
  COINTYPE_COSMOS,
  COINTYPE_DNX,
  COINTYPE_DOT,
  COINTYPE_LIGHTNING,
  COINTYPE_LIGHTNING_TESTNET,
  COINTYPE_NEXA,
  COINTYPE_SOL,
  COINTYPE_STC,
  COINTYPE_SUI,
  COINTYPE_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { EDBAccountType } from '../../dbs/local/consts';
import v5localDb from '../../dbs/local/localDb';
import simpleDb from '../../dbs/simple/simpleDb';
import { vaultFactory } from '../../vaults/factory';

import { v4CoinTypeToNetworkId } from './v4CoinTypeToNetworkId';
import v4dbHubs from './v4dbHubs';
import { EV4LocalDBStoreNames } from './v4local/v4localDBStoreNames';
import { V4MigrationManagerBase } from './V4MigrationManagerBase';
import v4MigrationUtils from './v4MigrationUtils';
import { EV4DBAccountType } from './v4types';

import type {
  IDBAccount,
  IDBCreateHWWalletParams,
  IDBDevice,
  IDBDeviceSettings,
  IDBUtxoAccount,
  IDBWallet,
} from '../../dbs/local/types';
import type { VaultBase } from '../../vaults/base/VaultBase';
import type VaultNexa from '../../vaults/impls/nexa/Vault';
import type {
  IV4MigrationHdCredential,
  IV4MigrationImportedCredential,
  IV4MigrationWallet,
  IV4OnAccountMigrated,
  IV4RunWalletMigrationParams,
} from './types';
import type {
  IV4DBAccount,
  IV4DBCredentialBase,
  IV4DBDevice,
  IV4DBDevicePayloadJson,
  IV4DBHdCredentialRaw,
  IV4DBImportedCredentialRaw,
  IV4DBUtxoAccount,
} from './v4local/v4localDBTypes';

export class V4MigrationForAccount extends V4MigrationManagerBase {
  async decryptV4ImportedCredential({
    v4dbCredential,
    encodedPassword,
  }: {
    v4dbCredential: IV4DBCredentialBase;
    encodedPassword: string;
  }): Promise<IV4MigrationImportedCredential> {
    const credentialText: string = v4dbCredential.credential;
    const credential = JSON.parse(credentialText);
    if (v4dbCredential.id.startsWith('imported-')) {
      const credentialImported = credential as IV4DBImportedCredentialRaw;
      const privateKey = bufferUtils.bytesToHex(
        decrypt(encodedPassword, credentialImported.privateKey),
      );
      const v4account = await v4dbHubs.v4localDb.getRecordById({
        name: EV4LocalDBStoreNames.Account,
        id: v4dbCredential.id,
      });
      const networkId = v4CoinTypeToNetworkId[v4account.coinType];
      if (!networkId) {
        throw new Error(
          `Unsupported coinType for migration: ${v4account.coinType}`,
        );
      }
      const credentials: ICoreCredentialsInfo = {
        imported: encryptImportedCredential({
          credential: {
            privateKey,
          },
          password: encodedPassword,
        }),
      };
      const { deriveInfo } =
        await this.backgroundApi.serviceNetwork.getDeriveTypeByTemplate({
          networkId,
          template: await this.fixV4AccountTemplate({
            v4account,
          }),
        });
      const addressEncoding = deriveInfo?.addressEncoding;

      let exportedPrivateKey = '';
      if (
        v4MigrationUtils.isCoinTypeSupport({ coinType: v4account.coinType })
      ) {
        const chainId = networkUtils.getNetworkChainId({
          networkId,
          hex: false,
        });
        const coreApi = this.getCoreApi({ networkId });
        exportedPrivateKey = await coreApi.imported.getExportedSecretKey({
          networkInfo: { chainId } as any, // only works for HD

          password: encodedPassword,
          credentials,

          account: v4account,

          keyType:
            v4account.type === EV4DBAccountType.UTXO
              ? ECoreApiExportedSecretKeyType.xprvt
              : ECoreApiExportedSecretKeyType.privateKey,
          addressEncoding,
        });
      }

      if (
        !exportedPrivateKey &&
        privateKey &&
        v4account?.coinType === COINTYPE_STC
      ) {
        exportedPrivateKey = hexUtils.addHexPrefix(privateKey);
      }

      return {
        exportedPrivateKey,
        privateKey,
        account: v4account,
        dbCredentialRaw: credentialImported,
      };
    }
    throw new Error(`Unsupported credential type: ${v4dbCredential.id}`);
  }

  async decryptV4HdCredential({
    v4dbCredential,
    encodedPassword,
  }: {
    v4dbCredential: IV4DBCredentialBase;
    encodedPassword: string;
  }): Promise<IV4MigrationHdCredential> {
    const credentialText: string = v4dbCredential.credential;
    const credential = JSON.parse(credentialText);
    if (v4dbCredential.id.startsWith('hd-')) {
      const credentialHD = credential as IV4DBHdCredentialRaw;
      // TODO fallback to v4 password prompt
      const entropy = decrypt(encodedPassword, credentialHD.entropy);
      const wallet = await v4dbHubs.v4localDb.getRecordById({
        name: EV4LocalDBStoreNames.Wallet,
        id: v4dbCredential.id,
      });
      const mnemonic = revealEntropyToMnemonic(entropy);

      return {
        mnemonic,
        wallet,
        dbCredentialRaw: credentialHD,
      };
    }
    throw new Error(`Unsupported credential type: ${v4dbCredential.id}`);
  }

  async getV4Credentials() {
    // const r = await this.v4localDb.getAllRecords({
    //   name: EV4LocalDBStoreNames.Credential,
    // });
    // const v4credentials = await Promise.all(
    //   r.records.map((item) =>
    //     this.decryptV4HdCredential({ v4dbCredential: item }),
    //   ),
    // );
    // return v4credentials;
    return [];
  }

  async getV4Wallets() {
    const v4WalletsResult = await v4dbHubs.v4localDb.getAllRecords({
      name: EV4LocalDBStoreNames.Wallet,
    });
    const v4wallets = v4WalletsResult.records || [];
    const result: IV4MigrationWallet[] = [];
    for (const v4wallet of v4wallets) {
      v4wallet.accounts = v4wallet.accounts || [];
      // const v4accounts: IV4DBAccount[] = [];
      // const r = await this.v4localDb.getAllRecords({
      //   name: EV4LocalDBStoreNames.Account,
      //   ids: v4wallet.accounts,
      // });
      // v4accounts = r?.records || [];

      result.push({
        wallet: v4wallet,
        isHD: accountUtils.isHdWallet({ walletId: v4wallet.id }),
        isHw: accountUtils.isHwWallet({ walletId: v4wallet.id }),
        isImported: accountUtils.isImportedWallet({ walletId: v4wallet.id }),
        isWatching: accountUtils.isWatchingWallet({ walletId: v4wallet.id }),
        isExternal: accountUtils.isExternalWallet({ walletId: v4wallet.id }),
        // accounts: v4accounts,
      });
    }
    return result?.filter(Boolean);
  }

  async buildV4WalletsForBackup({
    v4wallets,
  }: {
    v4wallets: IV4MigrationWallet[];
  }) {
    const v4walletsForBackup = v4wallets
      .filter(
        (w) =>
          accountUtils.isHdWallet({ walletId: w.wallet.id }) ||
          (accountUtils.isImportedWallet({ walletId: w.wallet.id }) &&
            w.wallet.accounts.length > 0),
      )
      .sort((a, b) => {
        if (a.wallet.type === b.wallet.type) {
          return natsort({ insensitive: true })(a.wallet.id, b.wallet.id);
        }
        return a.wallet.type === WALLET_TYPE_HD ? -1 : 1;
      });

    // v4walletsForBackup[0].wallet.accounts = [];
    // v4walletsForBackup[1].wallet.accounts = [];
    // v4walletsForBackup[2].wallet.accounts = [];

    // return [];
    return v4walletsForBackup?.filter(Boolean);
  }

  async migrateV4PasswordToV5() {
    const isPasswordSet = await v5localDb.isPasswordSet();
    if (!isPasswordSet) {
      const v4context = await this.getV4LocalDbContext();
      if (v4context?.verifyString) {
        await v5localDb.updateContextVerifyString({
          verifyString: fixV4VerifyStringToV5({
            verifyString: v4context.verifyString,
          }),
        });
        await this.backgroundApi.servicePassword.unLockApp();
      }
      // TODO migrate backupUUID?
      // v4context?.backupUUID;

      // TODO migrate settings.instanceId
      return true;
    }
    return false;
  }

  async fixV4AccountMissingFields({ v4account }: { v4account: IV4DBAccount }) {
    const old = v4dbHubs.logger.saveAccountDetailsV4({
      v4accountId: v4account.id,
      v4account,
    });

    const v4accountUtxo = v4account as IV4DBUtxoAccount;
    const networkId: string | undefined = v4account.coinType
      ? v4CoinTypeToNetworkId[v4account.coinType]
      : undefined;

    const logErrorFn = (error: Error | undefined) =>
      `${error?.message || 'error'}  ${JSON.stringify({
        id: v4account?.id,
        address: v4account?.address,
        path: v4account?.path,
      })}`;

    await v4dbHubs.logger.runAsyncWithCatch(
      async () => this.fixV4AccountTemplate({ v4account }),
      {
        name: 'fixV4AccountTemplate',
        errorResultFn: () => undefined,
        logErrorFn,
        logErrorOnly: true,
      },
    );

    await v4dbHubs.logger.runAsyncWithCatch(
      async () => this.fixV4AccountBtcPub({ v4account }),
      {
        name: 'fixV4AccountBtcPub',
        errorResultFn: () => undefined,
        logErrorFn,
        logErrorOnly: true,
      },
    );

    await v4dbHubs.logger.runAsyncWithCatch(
      async () => this.fixV4AccountLightningType({ v4account }),
      {
        name: 'fixV4AccountLightningType',
        errorResultFn: () => undefined,
        logErrorFn,
        logErrorOnly: true,
      },
    );

    await v4dbHubs.logger.runAsyncWithCatch(
      async () => {
        //
      },
      {
        name: 'fixV4AccountMissingFields TODO',
        errorResultFn: () => undefined,
        logErrorFn,
        logErrorOnly: true,
      },
    );

    if (accountUtils.isHwAccount({ accountId: v4account.id })) {
      await v4dbHubs.logger.runAsyncWithCatch(
        async () => {
          //
          if (v4account.coinType === COINTYPE_SOL) {
            if (v4account?.pub && v4account?.pub === v4account?.address) {
              v4account.pub = '';
            }
          }
        },
        {
          name: 'fixV4AccountMissingFields SOL',
          errorResultFn: () => undefined,
          logErrorFn,
          logErrorOnly: true,
        },
      );

      await v4dbHubs.logger.runAsyncWithCatch(
        async () => {
          if ([COINTYPE_NEXA, COINTYPE_ADA].includes(v4account.coinType)) {
            if (v4account.id && v4account.id.endsWith("'/0'/0/0")) {
              if (v4account.id) {
                v4account.id = v4account.id.replace(/\/0\/0$/, '');
              }
            }
            if (v4account.path && v4account.path.endsWith("'/0'/0/0")) {
              if (v4account.path) {
                v4account.path = v4account.path.replace(/\/0\/0$/, '');
              }
            }
          }
        },
        {
          name: 'fixV4AccountMissingFields Nexa,ADA path',
          errorResultFn: () => undefined,
          logErrorFn,
          logErrorOnly: true,
        },
      );

      await v4dbHubs.logger.runAsyncWithCatch(
        async () => {
          if (v4account.coinType === COINTYPE_DNX) {
            if (v4accountUtxo && !v4accountUtxo.xpub) {
              (v4accountUtxo as { xpub?: string }).xpub = undefined;
            }
          }
        },
        {
          name: 'fixV4AccountMissingFields DNX',
          errorResultFn: () => undefined,
          logErrorFn,
          logErrorOnly: true,
        },
      );

      await v4dbHubs.logger.runAsyncWithCatch(
        async () => {
          if (v4account.coinType === COINTYPE_SUI) {
            // TODO
          }
        },
        {
          name: 'fixV4AccountMissingFields SUI',
          errorResultFn: () => undefined,
          logErrorFn,
          logErrorOnly: true,
        },
      );

      await v4dbHubs.logger.runAsyncWithCatch(
        async () => {
          if (
            v4account.coinType === COINTYPE_COSMOS ||
            v4account.coinType === COINTYPE_DOT
          ) {
            if (networkId) {
              const vault = (await vaultFactory?.getChainOnlyVault({
                networkId,
              })) as VaultBase;
              const addressDetail = await vault?.buildAccountAddressDetail({
                account: v4account as any,
                networkId,
                networkInfo: await vault.getNetworkInfo(),
              });
              if (addressDetail?.address) {
                v4accountUtxo.addresses = v4accountUtxo.addresses || {};
                v4accountUtxo.addresses[networkId] = addressDetail.address;
              }
            }
          }
        },
        {
          name: 'fixV4AccountMissingFields COSMOS',
          errorResultFn: () => undefined,
          logErrorFn,
          logErrorOnly: true,
        },
      );

      await v4dbHubs.logger.runAsyncWithCatch(
        async () => {
          if (v4account.coinType === COINTYPE_NEXA) {
            // address may be pub
            if (
              v4account.address &&
              !verifyNexaAddressPrefix(v4account.address)
            ) {
              v4account.pub = v4account.address || '';
            }
            if (networkId) {
              const vault = (await vaultFactory?.getChainOnlyVault({
                networkId,
              })) as VaultNexa;
              const addressDetail = await vault?.buildAccountAddressDetail({
                account: v4account as any,
                networkId,
                networkInfo: await vault.getNetworkInfo(),
              });
              if (addressDetail?.address) {
                v4accountUtxo.addresses = v4accountUtxo.addresses || {};
                v4accountUtxo.addresses[networkId] = addressDetail.address;
                // The address of nexa must be pub, not the actual address, because the mainnet and testnet addresses of nexa are different
                // v4account.address = addressDetail.address;
              }
            }
          }
        },
        {
          name: 'fixV4AccountMissingFields NEXA',
          errorResultFn: () => undefined,
          logErrorFn,
          logErrorOnly: true,
        },
      );
    }

    if (!isEqual(old, v4account)) {
      v4dbHubs.logger.saveAccountDetailsV4({
        v4accountId: v4account.id,
        v4accountFixed: v4account,
      });
    }
  }

  // async fixV4AccountAddressOrPub({ v4account }: { v4account: IV4DBAccount }) {
  //   const coinType = v4account.coinType;
  //   if (accountUtils.isWatchingAccount({ accountId: v4account.id })) {
  //     if (coinType === COINTYPE_ALGO) {
  //       // use address to create
  //       delete v4account.pub;
  //     }
  //     if (coinType === COINTYPE_CFX) {
  //       // use addresses to create
  //       if (v4account && v4account.address) {
  //         // @ts-ignore
  //         delete (v4account as IV4DBSimpleAccount).address;
  //       }
  //     }
  //   }
  // }

  async fixV4AccountLightningType({ v4account }: { v4account: IV4DBAccount }) {
    if (
      v4account.coinType === COINTYPE_LIGHTNING ||
      v4account.coinType === COINTYPE_LIGHTNING_TESTNET
    ) {
      if (accountUtils.isHwAccount({ accountId: v4account.id })) {
        v4account.type = EV4DBAccountType.SIMPLE;
      }
    }
  }

  async fixV4AccountBtcPub({ v4account }: { v4account: IV4DBAccount }) {
    const coinType = v4account.coinType;
    if (
      [COINTYPE_BTC, COINTYPE_TBTC].includes(v4account.coinType) &&
      !accountUtils.isWatchingAccount({ accountId: v4account.id })
    ) {
      const xpub = (v4account as IV4DBUtxoAccount)?.xpub;
      if (xpub) {
        const networkId = v4CoinTypeToNetworkId[coinType];
        const network = await this.backgroundApi.serviceNetwork.getNetworkSafe({
          networkId,
        });
        if (network) {
          const btcForkNetwork = getBtcForkNetwork(network.code);
          const pub = getPublicKeyFromXpub({
            network: btcForkNetwork,
            xpub,
            relPath: '0/0',
          });
          v4account.pub = pub;
        }
      }
    }
  }

  async fixV4AccountTemplate({
    v4account,
  }: {
    v4account: IV4DBAccount;
  }): Promise<string> {
    const template = await this.getV4AccountTemplateByPath({ v4account });
    v4account.template = template;
    return v4account.template;
  }

  async getV4AccountTemplateByPath({
    v4account,
  }: {
    v4account: IV4DBAccount;
  }): Promise<string> {
    if (v4account.template) {
      return v4account.template;
    }
    const coinType = v4account.coinType;
    const networkId = v4CoinTypeToNetworkId[coinType || ''];
    if (v4account.path && networkId) {
      const template =
        await this.backgroundApi.serviceNetwork.getDeriveTemplateByPath({
          networkId,
          path: v4account.path,
        });
      return template || '';
    }
    return '';
  }

  prepareAddHdOrHwAccounts({
    v4account,
    v5wallet,
  }: {
    v4account: IV4DBAccount;
    v5wallet: IDBWallet;
  }) {
    const { serviceAccount, servicePassword, serviceNetwork } =
      this.backgroundApi;

    return v4dbHubs.logger.runAsyncWithCatch(
      async () => {
        const index = accountUtils.findIndexFromTemplate({
          template: await this.fixV4AccountTemplate({ v4account }),
          path: v4account.path,
        });
        if (!isNil(index)) {
          const indexedAccountsAdded = await serviceAccount.addIndexedAccount({
            walletId: v5wallet.id,
            indexes: [index],
            skipIfExists: true,
          });
          for (const indexedAccountAdded of indexedAccountsAdded || []) {
            try {
              await simpleDb.v4MigrationResult.saveMigratedIndexedAccountId({
                v5indexedAccountId: indexedAccountAdded.id,
              });
            } catch (error) {
              //
            }
          }
          const coinType = v4account.coinType;
          if (coinType) {
            const networkId = v4CoinTypeToNetworkId[coinType];
            if (networkId) {
              const { deriveType, deriveInfo } =
                await serviceNetwork.getDeriveTypeByTemplate({
                  networkId,
                  template: await this.fixV4AccountTemplate({
                    v4account,
                  }),
                });
              const networkImpl = networkUtils.getNetworkImpl({ networkId });
              const indexedAccountId = accountUtils.buildIndexedAccountId({
                walletId: v5wallet.id,
                index,
              });
              return {
                index,
                networkId,
                networkImpl,
                deriveType,
                deriveInfo,
                coinType,
                indexedAccountId,
              };
            }
          }
        }
        return undefined;
      },
      {
        name: 'prepareAddHdOrHwAccounts',
        errorResultFn: () => undefined,
        logResultFn: (result) =>
          result
            ? `addIndexedAccount: ${JSON.stringify({
                networkId: result.networkId,
                deriveType: result.deriveType,
                indexedAccountId: result.indexedAccountId,
              })}`
            : `skipped`,
      },
    );
  }

  // ----------------------------------------------

  async revealV4HdMnemonic({ hdWalletId }: { hdWalletId: string }) {
    const v4dbCredential: IV4DBCredentialBase =
      await v4dbHubs.v4localDb.getRecordById({
        name: EV4LocalDBStoreNames.Credential,
        id: hdWalletId,
      });
    return this.decryptV4HdCredential({
      v4dbCredential,
      encodedPassword:
        await this.backgroundApi.serviceV4Migration.getMigrationPasswordV4(),
    });
  }

  async revealV4ImportedPrivateKey({
    accountId,
    password,
  }: {
    accountId: string;
    password?: string;
  }) {
    const v4dbCredential: IV4DBCredentialBase =
      await v4dbHubs.v4localDb.getRecordById({
        name: EV4LocalDBStoreNames.Credential,
        id: accountId,
      });

    return this.decryptV4ImportedCredential({
      v4dbCredential,
      encodedPassword: password
        ? encodeSensitiveText({ text: password })
        : await this.backgroundApi.serviceV4Migration.getMigrationPasswordV4(),
    });
  }

  async addV5WatchingAccount({
    networkId,
    input,
    v4account,
    onAccountMigrated,
  }: {
    networkId: string;
    input: string;
    v4account: IV4DBAccount;
    onAccountMigrated: IV4OnAccountMigrated;
  }): Promise<IDBAccount[]> {
    const { serviceAccount, servicePassword, serviceNetwork } =
      this.backgroundApi;

    const deriveTypes = await serviceNetwork.getAccountImportingDeriveTypes({
      networkId,
      input: await servicePassword.encodeSensitiveText({
        text: input,
      }),
      validateAddress: true,
      validateXpub: true,
      template: await this.fixV4AccountTemplate({
        v4account,
      }),
    });

    const addedV5Accounts: IDBAccount[] = [];
    for (const deriveType of deriveTypes) {
      v4dbHubs.logger.log({
        name: 'loop each deriveType',
        type: 'info',
        payload: JSON.stringify({
          deriveType,
          networkId,
        }),
      });
      const v5accountAdded: IDBAccount | undefined =
        await v4dbHubs.logger.runAsyncWithCatch(
          async () => {
            const result = await serviceAccount.addWatchingAccount({
              input,
              name: v4account.name,
              networkId,
              deriveType,
              isUrlAccount: false,
              skipAddIfNotEqualToAddress: v4account.address,
            });
            const v5account = result?.accounts?.[0];
            if (v5account) {
              await onAccountMigrated(v5account, v4account);
            }
            return v5account;
          },
          {
            name: 'migrateWatchingAccounts addWatchingAccount',
            logResultFn: (result) =>
              JSON.stringify({
                deriveType,
                id: result?.id,
                name: result?.name,
                type: result?.type,
                address: result?.address,
                coinType: result?.coinType,
              }),
            errorResultFn: () => undefined,
          },
        );
      if (v5accountAdded) {
        addedV5Accounts.push(v5accountAdded);
      }
    }

    return addedV5Accounts;
  }

  async migrateWatchingAccounts({
    v4wallet,
    onAccountMigrated,
    isResumeMode,
  }: IV4RunWalletMigrationParams) {
    const { serviceAccount, servicePassword, serviceNetwork } =
      this.backgroundApi;

    const v4accounts: IV4DBAccount[] = await v4dbHubs.logger.runAsyncWithCatch(
      async () =>
        this.getV4AccountsOfWallet({
          v4wallet,
        }),
      {
        name: 'migrateWatchingAccounts getV4AccountsOfWallet',
        logResultFn: (result) => `accountsCount: ${result.length}`,
        errorResultFn: () => [],
      },
    );

    for (const v4account of v4accounts) {
      const networkId = v4CoinTypeToNetworkId[v4account.coinType];
      v4dbHubs.logger.log({
        name: 'migrateWatchingAccounts loop each v4account',
        type: 'info',
        payload: JSON.stringify({
          id: v4account.id,
          name: v4account.name,
          networkId,
        }),
      });

      let v5dbAccount: IDBAccount | undefined;
      const v5accountMigrated = await this.getV5AccountInResumeMode({
        isResumeMode,
        v4accountId: v4account.id,
      });
      if (v5accountMigrated) {
        v5dbAccount = v5accountMigrated;
      }

      if (v5dbAccount) {
        await onAccountMigrated(v5dbAccount, v4account);
      } else {
        await v4dbHubs.logger.runAsyncWithCatch(
          async () => {
            await this.fixV4AccountMissingFields({ v4account });
            if (networkId) {
              const v4accountUtxo = v4account as IV4DBUtxoAccount;

              if (
                v4accountUtxo.address ===
                '====bc1pmxftvl44gfdeu0w2qhksz0nj296lsd4keafh32097tc8kkaeeues6wklpg'
              ) {
                debugger;
              }

              const addWatchingAccountByInput = async (
                input: string,
                type: string,
              ) => {
                const result = await v4dbHubs.logger.runAsyncWithCatch(
                  async () => {
                    const added = await this.addV5WatchingAccount({
                      input,
                      v4account,
                      networkId,
                      onAccountMigrated,
                    });
                    return added;
                  },
                  {
                    name: `migrateWatchingAccounts by input: ${JSON.stringify([
                      v4account.id,
                      type,
                      input,
                    ])}`,
                    errorResultFn: () => undefined,
                  },
                );
                return result?.filter(Boolean) || [];
              };

              let addedV5Accounts: IDBAccount[] = [];

              if (v4account?.pub) {
                addedV5Accounts = [
                  ...addedV5Accounts,
                  ...(await addWatchingAccountByInput(v4account.pub, 'pub')),
                ];
              }

              if (v4accountUtxo?.xpub) {
                addedV5Accounts = [
                  ...addedV5Accounts,
                  ...(await addWatchingAccountByInput(
                    v4accountUtxo.xpub,
                    'xpub',
                  )),
                ];
              }

              if (v4accountUtxo?.xpubSegwit) {
                addedV5Accounts = [
                  ...addedV5Accounts,
                  ...(await addWatchingAccountByInput(
                    v4accountUtxo.xpubSegwit,
                    'xpubSegwit',
                  )),
                ];
              }

              if (
                v4account?.address &&
                !addedV5Accounts?.filter?.(Boolean)?.length
              ) {
                addedV5Accounts = [
                  ...addedV5Accounts,
                  ...(await addWatchingAccountByInput(
                    v4account.address,
                    'address',
                  )),
                ];
              }

              const networkToAddress = Object.entries(
                v4accountUtxo?.addresses || {},
              );
              if (networkToAddress.length) {
                for (const [mapNetworkId, mapAddress] of networkToAddress) {
                  await v4dbHubs.logger.runAsyncWithCatch(
                    async () => {
                      if (
                        mapAddress ===
                        '====bc1pmxftvl44gfdeu0w2qhksz0nj296lsd4keafh32097tc8kkaeeues6wklpg'
                      ) {
                        debugger;
                      }

                      // skip add address watching if xpub watching is added with same address
                      if (
                        addedV5Accounts?.find(
                          (item) =>
                            (item as IDBUtxoAccount)?.xpub &&
                            item.address === mapAddress,
                        )
                      ) {
                        return;
                      }

                      v4account.address = mapAddress;
                      await this.addV5WatchingAccount({
                        input: mapAddress,
                        v4account,
                        networkId: mapNetworkId,
                        onAccountMigrated,
                      });
                    },
                    {
                      name: `migrateWatchingAccounts by account.addresses: ${JSON.stringify(
                        [v4account.id, mapNetworkId, mapAddress],
                      )}`,
                      errorResultFn: () => undefined,
                    },
                  );
                }
              }
            }
          },
          {
            name: 'migrateWatchingAccounts each v4account',
            errorResultFn: () => undefined,
          },
        );
      }
    }
  }

  async migrateImportedAccounts({
    v4wallet,
    onAccountMigrated,
    isResumeMode,
  }: IV4RunWalletMigrationParams) {
    const { serviceAccount, servicePassword, serviceNetwork } =
      this.backgroundApi;

    const v4ImportedAccounts: IV4DBAccount[] =
      await v4dbHubs.logger.runAsyncWithCatch(
        async () =>
          this.getV4AccountsOfWallet({
            v4wallet,
          }),
        {
          name: 'migrateImportedAccounts getV4AccountsOfWallet',
          logResultFn: (result) => `accountsCount: ${result.length}`,
          errorResultFn: () => [],
        },
      );

    for (const v4account of v4ImportedAccounts) {
      const networkId = v4CoinTypeToNetworkId[v4account.coinType];
      v4dbHubs.logger.log({
        name: 'migrateImportedAccounts loop each v4account',
        type: 'info',
        payload: JSON.stringify({
          id: v4account.id,
          name: v4account.name,
          networkId,
        }),
      });

      let v5dbAccount: IDBAccount | undefined;
      const v5accountMigrated = await this.getV5AccountInResumeMode({
        isResumeMode,
        v4accountId: v4account.id,
      });
      if (v5accountMigrated) {
        v5dbAccount = v5accountMigrated;
      }

      if (v5dbAccount) {
        await onAccountMigrated(v5dbAccount, v4account);
      } else {
        await v4dbHubs.logger.runAsyncWithCatch(
          async () => {
            const { v4privateKey, exportedPrivateKey: input } =
              await v4dbHubs.logger.runAsyncWithCatch(
                async () => {
                  await this.fixV4AccountMissingFields({ v4account });
                  const credential = await this.revealV4ImportedPrivateKey({
                    accountId: v4account.id,
                  });
                  const { privateKey: v4privateKeyText, exportedPrivateKey } =
                    credential;
                  return { exportedPrivateKey, v4privateKey: v4privateKeyText };
                },
                {
                  name: 'migrateImportedAccounts revealV4ImportedPrivateKey',
                  errorResultFn: 'throwError',
                },
              );

            if (networkId) {
              if (
                v4account.address ===
                '====bc1qjclx3t2ykepvcqegx8tmn3nwd5ahsswenrvd90'
              ) {
                debugger;
              }
              const v4accountTemplate = await this.fixV4AccountTemplate({
                v4account,
              });
              const deriveTypes =
                await serviceNetwork.getAccountImportingDeriveTypes({
                  networkId,
                  input: await servicePassword.encodeSensitiveText({
                    text: input,
                  }),
                  validatePrivateKey: true,
                  validateXprvt: true,
                  template: v4accountTemplate,
                });
              for (const deriveType of deriveTypes) {
                v4dbHubs.logger.log({
                  name: 'loop each deriveType',
                  type: 'info',
                  payload: JSON.stringify({
                    deriveType,
                    networkId,
                  }),
                });
                await v4dbHubs.logger.runAsyncWithCatch(
                  async () => {
                    const result =
                      await serviceAccount.addImportedAccountWithCredential({
                        credential: await servicePassword.encodeSensitiveText({
                          text: v4privateKey,
                        }),
                        name: v4account.name,
                        networkId,
                        deriveType,
                        skipAddIfNotEqualToAddress: v4account.address,
                      });
                    const v5account = result?.accounts?.[0];
                    if (v5account) {
                      await onAccountMigrated(v5account, v4account);
                    }
                    return v5account;
                  },
                  {
                    name: 'migrateImportedAccounts addImportedAccountWithCredential',
                    logResultFn: (result) =>
                      JSON.stringify({
                        deriveType,
                        id: result?.id,
                        name: result?.name,
                        type: result?.type,
                        address: result?.address,
                        coinType: result?.coinType,
                      }),
                    errorResultFn: () => undefined,
                  },
                );
              }
            }
          },
          {
            name: 'migrateImportedAccounts each v4account',
            errorResultFn: () => undefined,
          },
        );
      }
    }
  }

  async getV5AccountInResumeMode({
    isResumeMode,
    v4accountId,
  }: {
    isResumeMode: boolean;
    v4accountId: string;
  }): Promise<IDBAccount | undefined> {
    if (isResumeMode && v4accountId) {
      return v4dbHubs.logger.runAsyncWithCatch(
        async () => {
          const v5AccountIdMigrated =
            await simpleDb.v4MigrationResult.getV5AccountIdByV4AccountId({
              v4accountId,
            });
          if (v5AccountIdMigrated) {
            const v5AccountMigrated = await v5localDb.getAccountSafe({
              accountId: v5AccountIdMigrated,
            });
            if (v5AccountMigrated) {
              return v5AccountMigrated;
            }
          }
        },
        {
          name: 'Resume account migration',
          logResultFn: (result) =>
            `result: ${v4accountId}===>${result?.id || ''}`,
          errorResultFn: () => undefined,
        },
      );
    }
    return undefined;
  }

  async getV5WalletInResumeMode({
    isResumeMode,
    v4walletId,
  }: {
    isResumeMode: boolean;
    v4walletId: string;
  }): Promise<IDBWallet | undefined> {
    if (isResumeMode && v4walletId) {
      return v4dbHubs.logger.runAsyncWithCatch(
        async () => {
          const v5WalletIdMigrated =
            await simpleDb.v4MigrationResult.getV5WalletIdByV4WalletId({
              v4walletId,
            });
          if (v5WalletIdMigrated) {
            const v5WalletMigrated = await v5localDb.getWalletSafe({
              walletId: v5WalletIdMigrated,
            });
            if (v5WalletMigrated) {
              return v5WalletMigrated;
            }
          }
        },
        {
          name: 'Resume wallet migration',
          logResultFn: (result) =>
            `result: ${v4walletId}===>${result?.id || ''}`,
          errorResultFn: () => undefined,
        },
      );
    }
    return undefined;
  }

  async migrateHwWallet({
    v4wallet,
    onAccountMigrated,
    onWalletMigrated,
    isResumeMode,
  }: IV4RunWalletMigrationParams) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { serviceAccount, servicePassword, serviceNetwork } =
      this.backgroundApi;
    let v4device: IV4DBDevice | undefined;
    if (v4wallet?.associatedDevice) {
      v4device = await v4dbHubs.logger.runAsyncWithCatch(
        async () =>
          v4dbHubs.v4localDb.getRecordById({
            name: EV4LocalDBStoreNames.Device,
            id: v4wallet.associatedDevice || '',
          }),
        {
          name: 'migrateHwWallet getDeviceV4',
          logResultFn: (result) =>
            JSON.stringify({
              name: result?.name,
              deviceId: result?.deviceId,
              uuid: result?.uuid,
              mac: result?.mac,
              deviceType: result?.deviceType,
            }),
          errorResultFn: () => undefined,
        },
      );
    }
    if (v4device) {
      const v5dbDevice = await v4dbHubs.logger.runAsyncWithCatch(
        async () => {
          if (!v4device) {
            return undefined;
          }
          v4dbHubs.logger.saveWalletDeviceDetailsV4({
            v4walletId: v4wallet.id,
            v4device,
          });
          let v4devicePayloadJson: IV4DBDevicePayloadJson | undefined;
          if (v4device?.payloadJson) {
            if (isString(v4device?.payloadJson)) {
              try {
                v4devicePayloadJson = JSON.parse(v4device.payloadJson || '{}');
              } catch (error) {
                //
              }
            }
            if (!v4devicePayloadJson && isObject(v4device?.payloadJson)) {
              v4devicePayloadJson = v4device.payloadJson as
                | IV4DBDevicePayloadJson
                | undefined;
            }
          }

          let v5deviceSettings: IDBDeviceSettings | undefined;
          if (v4devicePayloadJson) {
            v5deviceSettings = {
              inputPinOnSoftware: !v4devicePayloadJson.onDeviceInputPin,
              inputPinOnSoftwareSupport: undefined,
            };
          }

          const v5device: IDBDevice = {
            ...v4device, // TODO deviceName is wrong in v4 if update hidden wallet name
            connectId: v4device?.mac || '',
            settingsRaw: v5deviceSettings
              ? JSON.stringify(v5deviceSettings)
              : '',
          };

          const v5deviceAsV4 = v5device as unknown as {
            mac?: string;
            payloadJson?: string;
          };
          delete v5deviceAsV4.mac;
          delete v5deviceAsV4.payloadJson;

          await v5localDb.addDbDevice({
            device: v5device,
            skipIfExists: true,
          });
          const v5dbDeviceSaved = await v5localDb.getDevice(v5device.id);
          v4dbHubs.logger.saveWalletDeviceDetailsV5({
            v4walletId: v4wallet.id,
            v5device: v5dbDeviceSaved,
          });
          return v5dbDeviceSaved;
        },
        {
          name: 'migrateHwWallet saveDeviceV5',
          logResultFn: (result) =>
            JSON.stringify({
              name: result?.name,
              deviceId: result?.deviceId,
              uuid: result?.uuid,
              connectId: result?.connectId,
              deviceType: result?.deviceType,
            }),
          errorResultFn: () => undefined,
        },
      );

      let v5wallet: IDBWallet | undefined;
      if (v5dbDevice) {
        const v5WalletMigrated = await this.getV5WalletInResumeMode({
          isResumeMode,
          v4walletId: v4wallet.id,
        });
        if (v5WalletMigrated) {
          v5wallet = v5WalletMigrated;
        }

        if (!v5wallet) {
          if (v4wallet?.passphraseState) {
            v5wallet = await v4dbHubs.logger.runAsyncWithCatch(
              async () => {
                const params: IDBCreateHWWalletParams = {
                  name: v4wallet.name,
                  device: deviceUtils.dbDeviceToSearchDevice(v5dbDevice),
                  features: v5dbDevice.featuresInfo || ({} as any),
                  passphraseState: v4wallet.passphraseState,
                };

                const { dbWalletId: v5dbWalletId } =
                  await v5localDb.buildHwWalletId(params);

                const v5walletCurrent = await v5localDb.getWalletSafe({
                  walletId: v5dbWalletId,
                });
                const isV5WalletExistAndRemembered =
                  v5walletCurrent && !v5walletCurrent.isTemp;
                const { wallet: v5walletSaved } =
                  await serviceAccount.createHWWalletBase(params);

                void (async () => {
                  // only update wallet isTemp status when first time migration
                  if (isV5WalletExistAndRemembered) {
                    return;
                  }
                  const v4reduxData = await v4dbHubs?.v4reduxDb?.reduxData;
                  const v4rememberPassphraseWallets =
                    v4reduxData?.settings?.hardware
                      ?.rememberPassphraseWallets || [];
                  let isTemp = false;
                  if (
                    v4wallet?.id &&
                    !v4rememberPassphraseWallets.includes(v4wallet?.id)
                  ) {
                    isTemp = true;
                  }
                  await serviceAccount.setWalletTempStatus({
                    walletId: v5walletSaved.id,
                    isTemp,
                    hideImmediately: true,
                  });
                })();

                return v5walletSaved;
              },
              {
                name: 'migrateHwWallet createHWWalletV5 (hidden)',
                logResultFn: (result) =>
                  JSON.stringify({
                    id: result?.id,
                    name: result?.name,
                    type: result?.type,
                    associatedDevice: result?.associatedDevice,
                    isPassphraseState: Boolean(result?.passphraseState),
                  }),
                errorResultFn: () => undefined,
              },
            );
          } else {
            v5wallet = await v4dbHubs.logger.runAsyncWithCatch(
              async () => {
                const v4reduxData = await v4dbHubs?.v4reduxDb?.reduxData;
                const v4verificationMap =
                  v4reduxData?.settings?.hardware?.verification || {};
                const isFirmwareVerified =
                  v4verificationMap?.[v5dbDevice?.connectId];
                const { wallet: v5walletSaved } =
                  await serviceAccount.createHWWalletBase({
                    name: v4wallet.name,
                    features: JSON.parse(v4device?.features || '{}') || {},
                    device: v5dbDevice,
                    isFirmwareVerified,
                  });
                return v5walletSaved;
              },
              {
                name: 'migrateHwWallet createHWWalletV5 (normal)',
                logResultFn: (result) =>
                  JSON.stringify({
                    id: result?.id,
                    name: result?.name,
                    type: result?.type,
                    associatedDevice: result?.associatedDevice,
                    isPassphraseState: Boolean(result?.passphraseState),
                  }),
                errorResultFn: () => undefined,
              },
            );
          }
        }

        if (v5wallet) {
          await onWalletMigrated(v5wallet);
          v4dbHubs.logger.saveWalletDetailsV5({
            v4walletId: v4wallet.id,
            v5wallet,
          });
        }

        const v4accounts: IV4DBAccount[] =
          await v4dbHubs.logger.runAsyncWithCatch(
            async () =>
              this.getV4AccountsOfWallet({
                v4wallet,
              }),
            {
              name: 'migrateHwWallet getV4AccountsOfWallet',
              logResultFn: (result) => `accountsCount: ${result.length}`,
              errorResultFn: () => [],
            },
          );

        for (const v4account of v4accounts) {
          v4dbHubs.logger.log({
            name: 'loop each v4account',
            type: 'info',
            payload: JSON.stringify({
              id: v4account.id,
              name: v4account.name,
            }),
          });
          await v4dbHubs.logger.runAsyncWithCatch(
            async () => {
              await this.fixV4AccountMissingFields({ v4account });

              if (v5wallet) {
                const prepareResult = await this.prepareAddHdOrHwAccounts({
                  v4account,
                  v5wallet,
                });
                if (prepareResult) {
                  await v4dbHubs.logger.runAsyncWithCatch(
                    async () => {
                      if (!v5wallet) {
                        return;
                      }

                      let v5dbAccount: IDBAccount | undefined;
                      const v5accountMigrated =
                        await this.getV5AccountInResumeMode({
                          isResumeMode,
                          v4accountId: v4account.id,
                        });
                      if (v5accountMigrated) {
                        v5dbAccount = v5accountMigrated;
                      }

                      if (!v5dbAccount) {
                        const {
                          index,
                          // eslint-disable-next-line @typescript-eslint/no-unused-vars
                          networkId,
                          networkImpl,
                          // eslint-disable-next-line @typescript-eslint/no-unused-vars
                          deriveType,
                          deriveInfo,
                          // eslint-disable-next-line @typescript-eslint/no-unused-vars
                          coinType,
                          indexedAccountId,
                        } = prepareResult;
                        const v4accountUtxo = v4account as IV4DBUtxoAccount;
                        const accountId = accountUtils.buildHDAccountId({
                          walletId: v5wallet?.id,
                          path: v4account.path,
                          idSuffix: deriveInfo?.idSuffix,
                        });
                        const addressRelPath =
                          v4account.type === EV4DBAccountType.UTXO
                            ? accountUtils.buildUtxoAddressRelPath()
                            : undefined;
                        const v5account: IDBAccount = {
                          address: v4account.address,
                          addresses: v4accountUtxo?.addresses,
                          coinType: v4account.coinType,
                          id: accountId,
                          impl: networkImpl,
                          indexedAccountId,
                          name: v4account.name,
                          path: v4account.path,
                          pathIndex: index,
                          pub: v4account.pub || '',
                          relPath: addressRelPath,
                          template: await this.fixV4AccountTemplate({
                            v4account,
                          }),
                          type: v4account.type as any,
                        };
                        if (v5account.type === EDBAccountType.VARIANT) {
                          v5account.address = '';
                        }
                        const v5accountUtxo = v5account as IDBUtxoAccount;
                        v5accountUtxo.xpub = v4accountUtxo.xpub;
                        v5accountUtxo.xpubSegwit = v4accountUtxo.xpubSegwit;
                        v4dbHubs.logger.saveAccountDetailsV5({
                          v4accountId: v4account.id,
                          v5account,
                        });
                        // TODO use service add hw account
                        await v5localDb.addAccountsToWallet({
                          allAccountsBelongToNetworkId: networkId,
                          walletId: v5wallet?.id,
                          accounts: [v5account],
                        });
                        v5dbAccount = v5account;
                      }

                      await onAccountMigrated(v5dbAccount, v4account);
                      return v5dbAccount;
                    },
                    {
                      name: 'migrateHwWallet saveAccountV5',
                      errorResultFn: () => undefined,
                      logResultFn: (result) =>
                        JSON.stringify({
                          id: result?.id,
                          name: result?.name,
                          type: result?.type,
                          pathIndex: result?.pathIndex,
                          template: result?.template,
                        }),
                    },
                  );
                }
              }
            },
            {
              name: 'migrateHwWallet each account',
              logResultFn: () =>
                JSON.stringify({
                  id: v4account.id,
                  name: v4account.name,
                }),
              errorResultFn: () => undefined,
            },
          );
        }
      }
    }
  }

  async migrateHdWallet({
    v4wallet,
    onAccountMigrated,
    onWalletMigrated,
    isResumeMode,
  }: IV4RunWalletMigrationParams) {
    const { serviceAccount, servicePassword, serviceNetwork } =
      this.backgroundApi;
    const mnemonic = await v4dbHubs.logger.runAsyncWithCatch(
      async () => {
        const { mnemonic: mnemonicText } = await this.revealV4HdMnemonic({
          hdWalletId: v4wallet.id,
        });
        return mnemonicText;
      },
      {
        name: 'migrateHdWallet getMnemonic',
        errorResultFn: 'throwError',
      },
    );

    const v5wallet: IDBWallet | undefined =
      await v4dbHubs.logger.runAsyncWithCatch(
        async () => {
          let v5dbWallet: IDBWallet | undefined;

          const v5WalletMigrated = await this.getV5WalletInResumeMode({
            isResumeMode,
            v4walletId: v4wallet.id,
          });
          if (v5WalletMigrated) {
            v5dbWallet = v5WalletMigrated;
          }

          if (!v5dbWallet) {
            const { wallet: v5walletSaved } =
              await serviceAccount.createHDWallet({
                name: v4wallet.name,
                mnemonic: await servicePassword.encodeSensitiveText({
                  text: mnemonic,
                }),
                walletHashBuilder: () => {
                  const text = `${mnemonic}--4863FBE1-7B9B-4006-91D0-24212CCCC375--${v4wallet.id}`;
                  const buff = sha256(bufferUtils.toBuffer(text, 'utf8'));
                  const walletHash = bufferUtils.bytesToHex(buff);
                  return walletHash;
                },
              });
            v5dbWallet = v5walletSaved;
          }

          await onWalletMigrated(v5dbWallet);
          return v5dbWallet;
        },
        {
          name: 'migrateHdWallet createHDWallet',
          logResultFn: (result) =>
            JSON.stringify({
              id: result?.id,
              name: result?.name,
              type: result?.type,
            }),
          errorResultFn: () => undefined,
        },
      );

    const v4accounts: IV4DBAccount[] = await v4dbHubs.logger.runAsyncWithCatch(
      async () =>
        this.getV4AccountsOfWallet({
          v4wallet,
        }),
      {
        name: 'migrateHdWallet getV4AccountsOfWallet',
        logResultFn: (result) => `accountsCount: ${result.length}`,
        errorResultFn: () => [],
      },
    );

    // const indexes: Array<number | undefined> = v4accounts.map((a) =>
    //   ,
    // );
    // const indexesFixed = uniq(indexes).filter(
    //   (item) => !isNil(item),
    // ) as number[];

    for (const v4account of v4accounts) {
      v4dbHubs.logger.log({
        name: 'loop each v4account',
        type: 'info',
        payload: JSON.stringify({
          id: v4account.id,
          name: v4account.name,
        }),
      });

      await v4dbHubs.logger.runAsyncWithCatch(
        async () => {
          let v5dbAccount: IDBAccount | undefined;
          const v5accountMigrated = await this.getV5AccountInResumeMode({
            isResumeMode,
            v4accountId: v4account.id,
          });
          if (v5accountMigrated) {
            v5dbAccount = v5accountMigrated;
          }

          if (!v5dbAccount) {
            await this.fixV4AccountMissingFields({ v4account });
            if (v5wallet) {
              const prepareResult = await this.prepareAddHdOrHwAccounts({
                v4account,
                v5wallet,
              });
              if (prepareResult) {
                const { networkId, index, deriveType } = prepareResult;
                const result = await serviceAccount.addHDOrHWAccounts({
                  names: [v4account.name],
                  walletId: v5wallet.id,
                  networkId,
                  indexes: [index],
                  indexedAccountId: undefined,
                  deriveType,
                  skipDeviceCancel: true,
                  hideCheckingDeviceLoading: true,
                });
                const v5account = result?.accounts?.[0];
                if (v5account) {
                  v5dbAccount = v5account;
                }
              }
            }
          }

          if (v5dbAccount) {
            await onAccountMigrated(v5dbAccount, v4account);
          }
        },
        {
          name: 'migrateHdWallet each account',
          logResultFn: () =>
            JSON.stringify({
              id: v4account.id,
              name: v4account.name,
            }),
          errorResultFn: () => undefined,
        },
      );
    }
    // TODO get deriveType and networkId by coinType
  }
}
