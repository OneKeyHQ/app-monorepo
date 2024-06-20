import { isEqual, isNil } from 'lodash';
import natsort from 'natsort';

import {
  getBtcForkNetwork,
  getPublicKeyFromXpub,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import {
  decrypt,
  encodeSensitiveText,
  encryptImportedCredential,
  fixV4VerifyStringToV5,
  revealEntropyToMnemonic,
} from '@onekeyhq/core/src/secret';
import {
  ECoreApiExportedSecretKeyType,
  type ICoreCredentialsInfo,
} from '@onekeyhq/core/src/types';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import {
  COINTYPE_BTC,
  COINTYPE_LIGHTNING,
  COINTYPE_LIGHTNING_TESTNET,
  COINTYPE_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { EDBAccountType } from '../../dbs/local/consts';
import v5localDb from '../../dbs/local/localDb';

import { v4CoinTypeToNetworkId } from './v4CoinTypeToNetworkId';
import v4dbHubs from './v4dbHubs';
import { EV4LocalDBStoreNames } from './v4local/v4localDBStoreNames';
import { V4MigrationManagerBase } from './V4MigrationManagerBase';
import { EV4DBAccountType } from './v4types';

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
  IV4DBHdCredentialRaw,
  IV4DBImportedCredentialRaw,
  IV4DBUtxoAccount,
} from './v4local/v4localDBTypes';
import type {
  IDBAccount,
  IDBDevice,
  IDBUtxoAccount,
  IDBWallet,
} from '../../dbs/local/types';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '../../vaults/types';

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
        throw new Error(`Unsupported coinType: ${v4account.coinType}`);
      }
      const coreApi = this.getCoreApi({ networkId });
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

      const chainId = networkUtils.getNetworkChainId({
        networkId,
        hex: false,
      });

      const exportedPrivateKey = await coreApi.imported.getExportedSecretKey({
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
      async () =>
        new Promise<
          | {
              index: number;
              networkId: string;
              networkImpl: string;
              deriveType: IAccountDeriveTypes;
              coinType: string;
              deriveInfo: IAccountDeriveInfo | undefined;
              indexedAccountId: string;
            }
          | undefined
          // eslint-disable-next-line no-async-promise-executor
        >(async (resolve, reject) => {
          const index = accountUtils.findIndexFromTemplate({
            template: await this.fixV4AccountTemplate({ v4account }),
            path: v4account.path,
          });
          if (!isNil(index)) {
            await serviceAccount.addIndexedAccount({
              walletId: v5wallet.id,
              indexes: [index],
              skipIfExists: true,
            });
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
                return resolve({
                  index,
                  networkId,
                  networkImpl,
                  deriveType,
                  deriveInfo,
                  coinType,
                  indexedAccountId,
                });
              }
            }
          }
          return resolve(undefined);
        }),
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
      encodedPassword: await this.getMigrationPassword(),
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
        : await this.getMigrationPassword(),
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
              onAccountMigrated(v5account, v4account);
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

      await v4dbHubs.logger.runAsyncWithCatch(
        async () => {
          await this.fixV4AccountMissingFields({ v4account });
          if (networkId) {
            const v4accountUtxo = v4account as IV4DBUtxoAccount;

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
              addedV5Accounts = await addWatchingAccountByInput(
                v4account.pub,
                'pub',
              );
            }

            if (v4accountUtxo?.xpub) {
              addedV5Accounts = await addWatchingAccountByInput(
                v4accountUtxo.xpub,
                'xpub',
              );
            }

            if (v4accountUtxo?.xpubSegwit) {
              addedV5Accounts = await addWatchingAccountByInput(
                v4accountUtxo.xpubSegwit,
                'xpubSegwit',
              );
            }

            if (
              v4account?.address &&
              !addedV5Accounts?.filter?.(Boolean)?.length
            ) {
              addedV5Accounts = await addWatchingAccountByInput(
                v4account.address,
                'address',
              );
            }

            const networkToAddress = Object.entries(
              v4accountUtxo?.addresses || {},
            );
            if (networkToAddress.length) {
              for (const [mapNetworkId, mapAddress] of networkToAddress) {
                await v4dbHubs.logger.runAsyncWithCatch(
                  async () => {
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

  async migrateImportedAccounts({
    v4wallet,
    onAccountMigrated,
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
            const deriveTypes =
              await serviceNetwork.getAccountImportingDeriveTypes({
                networkId,
                input: await servicePassword.encodeSensitiveText({
                  text: input,
                }),
                validatePrivateKey: true,
                validateXprvt: true,
                template: await this.fixV4AccountTemplate({
                  v4account,
                }),
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
                    onAccountMigrated(v5account, v4account);
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

  async migrateHwWallet({
    v4wallet,
    onAccountMigrated,
    onWalletMigrated,
  }: IV4RunWalletMigrationParams) {
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
          const v5device: IDBDevice = {
            ...v4device, // TODO deviceName is wrong in v4 if update hidden wallet name
            connectId: v4device?.mac || '',
            settingsRaw: '', // TODO convert v4 payloadJson to v5 settingsRaw
          };
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
        if (v4wallet?.passphraseState) {
          v5wallet = await v4dbHubs.logger.runAsyncWithCatch(
            async () => {
              const { wallet: v5walletSaved } =
                await serviceAccount.createHWWalletBase({
                  name: v4wallet.name,
                  device: deviceUtils.dbDeviceToSearchDevice(v5dbDevice),
                  features: v5dbDevice.featuresInfo || ({} as any),
                  passphraseState: v4wallet.passphraseState,
                });
              onWalletMigrated(v5walletSaved);
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
              const { wallet: v5walletSaved } =
                await serviceAccount.createHWWalletBase({
                  name: v4wallet.name,
                  features: JSON.parse(v4device?.features || '{}') || {},
                  device: v5dbDevice,
                  isFirmwareVerified: false, // TODO v4 isFirmwareVerified
                });
              onWalletMigrated(v5walletSaved);
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

        if (v5wallet) {
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
                      const {
                        networkId,
                        networkImpl,
                        indexedAccountId,
                        index,
                        deriveType,
                        deriveInfo,
                      } = prepareResult;
                      const accountId = accountUtils.buildHDAccountId({
                        walletId: v5wallet?.id,
                        path: v4account.path,
                        idSuffix: deriveInfo?.idSuffix,
                      });
                      const addressRelPath =
                        accountUtils.buildUtxoAddressRelPath();
                      const v5account: IDBAccount = {
                        address: v4account.address,
                        addresses: {},
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
                      const v4accountUtxo = v4account as IV4DBUtxoAccount;
                      v5accountUtxo.xpub = v4accountUtxo.xpub;
                      v5accountUtxo.xpubSegwit = v4accountUtxo.xpubSegwit;
                      v4dbHubs.logger.saveAccountDetailsV5({
                        v4accountId: v4account.id,
                        v5account,
                      });
                      // TODO use service add hw account
                      await v5localDb.addAccountsToWallet({
                        walletId: v5wallet?.id,
                        accounts: [v5account],
                      });
                      onAccountMigrated(v5account, v4account);
                      return v5account;
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

    const v5wallet = await v4dbHubs.logger.runAsyncWithCatch(
      async () => {
        const { wallet: v5walletSaved } = await serviceAccount.createHDWallet({
          name: v4wallet.name,
          mnemonic: await servicePassword.encodeSensitiveText({
            text: mnemonic,
          }),
        });
        onWalletMigrated(v5walletSaved);
        return v5walletSaved;
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
          await this.fixV4AccountMissingFields({ v4account });
          if (v5wallet) {
            const prepareResult = await this.prepareAddHdOrHwAccounts({
              v4account,
              v5wallet,
            });
            if (prepareResult) {
              const { networkId, index, deriveType } = prepareResult;
              // TODO add addressMap to DB
              const result = await serviceAccount.addHDOrHWAccounts({
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
                onAccountMigrated(v5account, v4account);
              }
            }
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
