import {
  decryptStringAsync,
  encryptStringAsync,
  ensureSensitiveTextEncoded,
  sha512Async,
} from '@onekeyhq/core/src/secret';
import {
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  ALWAYS_VERIFY_PASSCODE_WHEN_CHANGE_SET_MASTER_PASSWORD,
  RESET_CLOUD_SYNC_MASTER_PASSWORD_UUID as RESET_MASTER_PASSWORD_UUID,
} from '@onekeyhq/shared/src/consts/primeConsts';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  ICloudSyncCredential,
  ICloudSyncPayloadLock,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';
import type { IPrimeServerUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';
import { ESecurityPasswordType } from '@onekeyhq/shared/types/prime/primeTypes';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { primeMasterPasswordPersistAtom } from '../../states/jotai/atoms/prime';
import ServiceBase from '../ServiceBase';
import cloudSyncItemBuilder from '../ServicePrimeCloudSync/cloudSyncItemBuilder';

import type { IDBCloudSyncItem } from '../../dbs/local/types';
import type { IPrimeMasterPasswordPersistAtomData } from '../../states/jotai/atoms/prime';

class ServiceMasterPassword extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async hashMasterPassword({
    rawMasterPassword,
    accountSalt,
    primeUserId,
  }: {
    rawMasterPassword: string;
    accountSalt: string;
    primeUserId: string;
  }) {
    // TODO check empty value

    const hash = await sha512Async({
      data: [
        '180B50C8-E4EC-40E9-9CF3-7DD71F2882F7',
        rawMasterPassword,
        accountSalt,
        primeUserId,
      ].join('--'),
      iterations: 100, // 100_000, // 1000
      iterationSalt: [
        '5D650C6D-74AC-4989-B6BD-B952C4A3EDB5',
        accountSalt,
        primeUserId,
      ].join('--'),
    });
    return bufferUtils.bytesToHex(hash);
  }

  async buildSecurityPasswordEncryptKey({
    password,
    masterPasswordUUID,
    accountSalt,
    primeUserId,
  }: {
    password: string;
    masterPasswordUUID: string;
    accountSalt: string;
    primeUserId: string;
  }) {
    // eslint-disable-next-line no-param-reassign
    password = await this.backgroundApi.servicePassword.decodeSensitiveText({
      encodedText: password,
    });
    const instanceId = await this.backgroundApi.serviceSetting.getInstanceId();
    const instancePrivateSalt = ''; // TODO create instance salt by getRandomBytes for better random
    return [
      '747E735A-4129-4F0D-B0E2-356D088072B9',
      password,
      instanceId,
      instancePrivateSalt,
      masterPasswordUUID,
      accountSalt,
      primeUserId,
    ].join('--');
  }

  @backgroundMethod()
  async encryptSecurityPassword({
    securityPassword,
    accountSalt,
    password,
    masterPasswordUUID,
    primeUserId,
  }: {
    securityPassword: string;
    accountSalt: string;
    password: string; // passcode
    masterPasswordUUID: string;
    primeUserId: string;
  }): Promise<string> {
    // TODO check empty value
    // eslint-disable-next-line no-param-reassign
    password = await this.backgroundApi.servicePassword.decodeSensitiveText({
      encodedText: password,
    });
    return encryptStringAsync({
      password: await this.buildSecurityPasswordEncryptKey({
        password,
        masterPasswordUUID,
        accountSalt,
        primeUserId,
      }),
      data: securityPassword,
      dataEncoding: 'utf-8',
      allowRawPassword: true,
    });
  }

  // TODO empty check
  @backgroundMethod()
  async decryptSecurityPassword({
    password,
    securityPasswordEncrypted,
    masterPasswordUUID,
    accountSalt,
    primeUserId,
  }: {
    password: string;
    securityPasswordEncrypted: string;
    masterPasswordUUID: string;
    accountSalt: string;
    primeUserId: string;
  }) {
    // TODO check empty value
    // eslint-disable-next-line no-param-reassign
    password = await this.backgroundApi.servicePassword.decodeSensitiveText({
      encodedText: password,
    });
    return decryptStringAsync({
      password: await this.buildSecurityPasswordEncryptKey({
        password,
        masterPasswordUUID,
        accountSalt,
        primeUserId,
      }),
      data: securityPasswordEncrypted,
      dataEncoding: 'hex',
      resultEncoding: 'utf-8',
      allowRawPassword: true,
    });
  }

  async buildSecurityPassword({
    securityType,
    rawMasterPassword,
    accountSalt,
    masterPasswordHash,
    primeUserId,
  }: {
    securityType: ESecurityPasswordType;
    rawMasterPassword: string;
    accountSalt: string;
    masterPasswordHash: string;
    primeUserId: string;
  }) {
    // TODO check empty value
    const securityTypeHash = await sha512Async({
      data: [
        'EB36A58F-E51C-4520-BB41-5437768CE668',
        `${securityType}`,
        accountSalt,
        masterPasswordHash,
        primeUserId,
      ].join('--'),
    });
    // TODO use PBKDF2(keyFromPasswordAndSalt) -> HKDF -> k1,k2,k3 instead of sha512Async
    const key = await this.hashMasterPassword({
      rawMasterPassword: [
        'BC2844DF-6C81-4FF5-B547-FB22A3DFAD46',
        securityTypeHash,
        rawMasterPassword,
        accountSalt,
        masterPasswordHash,
        primeUserId,
      ].join('--'),
      accountSalt,
      primeUserId,
    });
    return key;
  }

  async saveLocalMasterPassword({
    masterPasswordUUID,
    encryptedSecurityPasswordR1,
  }: {
    masterPasswordUUID: string;
    encryptedSecurityPasswordR1: string;
  }) {
    // primeMasterPasswordPersistAtom
    await primeMasterPasswordPersistAtom.set({
      masterPasswordUUID,
      encryptedSecurityPasswordR1,
    });
  }

  @backgroundMethod()
  @toastIfError()
  async clearLocalMasterPassword({
    skipDisableCloudSync,
  }: {
    skipDisableCloudSync?: boolean;
  } = {}) {
    // local password may be changed by other client, reset password data
    await this.saveLocalMasterPassword({
      masterPasswordUUID: '',
      encryptedSecurityPasswordR1: '',
    });
    await this.backgroundApi.servicePrimeCloudSync.clearCachedSyncCredential();
    if (!skipDisableCloudSync) {
      await this.backgroundApi.servicePrimeCloudSync.setCloudSyncEnabled(false);
    }
  }

  async prepareMasterPassword({
    passcode,
    serverUserInfo,
    isRegister,
    masterPasswordUUIDBuilder,
  }: {
    passcode?: string;
    serverUserInfo: IPrimeServerUserInfo | undefined;
    isRegister: boolean;
    masterPasswordUUIDBuilder?: () => string;
  }) {
    // const isServerMasterPasswordSet = Boolean(
    //   serverUserInfo?.pwdHash &&
    //     serverUserInfo?.pwdHash !== RESET_MASTER_PASSWORD_UUID,
    // );
    const serverPasswordUUID = serverUserInfo?.pwdHash;
    const accountSalt = serverUserInfo?.salt;
    if (!accountSalt) {
      throw new Error('FetchPrimeUserInfo ERROR: No salt');
    }
    const primeUserId = serverUserInfo?.userId;
    if (!primeUserId) {
      throw new Error('FetchPrimeUserInfo ERROR: No primeUserId');
    }

    const instanceId = await this.backgroundApi.serviceSetting.getInstanceId();
    // Use getRandomBytes() to generate a high-random instance salt, which should not be sent to the server, and use secure storage
    const instancePrivateSalt = '';

    let password = passcode;
    if (!password) {
      ({ password } =
        await this.backgroundApi.servicePassword.promptPasswordVerify({}));
    }
    password = await this.backgroundApi.servicePassword.decodeSensitiveText({
      encodedText: password,
    });
    if (!password) {
      throw new Error('Invalid passcode');
    }

    const { masterPassword } =
      await this.backgroundApi.servicePrime.promptPrimeLoginPasswordDialog({
        isRegister,
      });
    ensureSensitiveTextEncoded(masterPassword);

    const result = await this.withDialogLoading(
      {
        title: 'Preparing password',
      },
      async () => {
        const rawMasterPassword =
          await this.backgroundApi.servicePassword.decodeSensitiveText({
            encodedText: masterPassword,
          });
        if (!rawMasterPassword) {
          throw new Error('Invalid master password');
        }
        let masterPasswordUUID = serverPasswordUUID;
        if (isRegister) {
          masterPasswordUUID = stringUtils.generateUUID();
        }
        if (masterPasswordUUIDBuilder) {
          masterPasswordUUID = masterPasswordUUIDBuilder();
        }
        if (!masterPasswordUUID) {
          throw new Error('SetupMasterPassword ERROR: No master password UUID');
        }
        const masterPasswordHash = await this.hashMasterPassword({
          rawMasterPassword,
          accountSalt,
          primeUserId,
        });

        const securityPasswordR1 = await this.buildSecurityPassword({
          securityType: ESecurityPasswordType.CloudSyncR1,
          rawMasterPassword,
          masterPasswordHash,
          accountSalt,
          primeUserId,
          // TODO including instanceId and instancePrivateSalt
        });

        const encryptedSecurityPasswordR1 = await this.encryptSecurityPassword({
          securityPassword: securityPasswordR1,
          accountSalt,
          password: password || '',
          masterPasswordUUID,
          primeUserId,
        });

        if (
          !masterPasswordUUID ||
          !encryptedSecurityPasswordR1 ||
          !securityPasswordR1
        ) {
          throw new Error('SetupMasterPassword ERROR: No master password');
        }

        if (
          !isRegister &&
          serverPasswordUUID &&
          serverPasswordUUID !== masterPasswordUUID
        ) {
          throw new Error(
            'SetupMasterPassword ERROR: Server password UUID mismatch',
          );
        }

        return {
          masterPasswordUUID,
          encryptedSecurityPasswordR1,
          securityPasswordR1,
          accountSalt,
          primeUserId,
        };
      },
    );

    return result;
  }

  @backgroundMethod()
  @toastIfError()
  async setupMasterPassword({ passcode }: { passcode?: string } = {}): Promise<{
    encryptedSecurityPasswordR1: string;
    masterPasswordUUID: string;
    accountSalt: string;
    primeUserId: string;
    isServerMasterPasswordSet: boolean;
  }> {
    const { serverUserInfo } = await this.withDialogLoading(
      { title: 'Checking user info' },
      async () => this.backgroundApi.servicePrime.apiFetchPrimeUserInfo(),
    );

    const accountSalt = serverUserInfo?.salt;
    if (!accountSalt) {
      throw new Error('FetchPrimeUserInfo ERROR: No salt');
    }
    const primeUserId = serverUserInfo?.userId;
    if (!primeUserId) {
      throw new Error('FetchPrimeUserInfo ERROR: No primeUserId');
    }

    const serverPasswordUUID = serverUserInfo?.pwdHash;
    const isServerMasterPasswordSet = Boolean(
      serverPasswordUUID && serverPasswordUUID !== RESET_MASTER_PASSWORD_UUID,
    );

    const localMasterPasswordAtom = await primeMasterPasswordPersistAtom.get();

    if (
      localMasterPasswordAtom.masterPasswordUUID &&
      localMasterPasswordAtom.encryptedSecurityPasswordR1
    ) {
      if (
        !isServerMasterPasswordSet ||
        (localMasterPasswordAtom.masterPasswordUUID === serverPasswordUUID &&
          isServerMasterPasswordSet)
      ) {
        return {
          masterPasswordUUID: localMasterPasswordAtom.masterPasswordUUID,
          encryptedSecurityPasswordR1:
            localMasterPasswordAtom.encryptedSecurityPasswordR1,
          accountSalt,
          primeUserId,
          isServerMasterPasswordSet,
        };
      }
    }

    if (isServerMasterPasswordSet) {
      if (localMasterPasswordAtom.masterPasswordUUID !== serverPasswordUUID) {
        await this.clearLocalMasterPassword();
      }
    }

    const result = await this.prepareMasterPassword({
      passcode,
      serverUserInfo,
      isRegister: !isServerMasterPasswordSet,
    });

    await this.saveLocalMasterPassword({
      masterPasswordUUID: result.masterPasswordUUID,
      encryptedSecurityPasswordR1: result.encryptedSecurityPasswordR1,
    });

    return { ...result, isServerMasterPasswordSet };
  }

  async verifyServerMasterPassword({
    syncCredential,
    clearLocalMasterPassword,
  }: {
    syncCredential: ICloudSyncCredential;
    clearLocalMasterPassword?: boolean;
  }) {
    try {
      const { lock } =
        await this.backgroundApi.servicePrimeCloudSync.apiFetchSyncLock();
      if (!lock) {
        throw new Error(
          'verifyMasterPassword ERROR: No lock of server to verify',
        );
      }

      const localItem =
        await this.backgroundApi.servicePrimeCloudSync.convertServerItemToLocalItem(
          {
            serverItem: lock,
            shouldDecrypt: false,
            syncCredential,
          },
        );
      if (!localItem) {
        throw new Error('verifyMasterPassword ERROR: No local item');
      }

      const decryptedItem = await cloudSyncItemBuilder.decryptSyncItem({
        item: localItem,
        syncCredential,
      });
      // password correct with server
      if (decryptedItem?.rawDataJson?.payload) {
        const payload = decryptedItem?.rawDataJson
          ?.payload as ICloudSyncPayloadLock;
        if (payload?.message === 'lock') {
          return;
        }
      }
      throw new Error('verifyMasterPassword ERROR: Invalid password');
    } catch (error) {
      if (clearLocalMasterPassword) {
        // password incorrect with server
        await this.clearLocalMasterPassword();
      }
      throw error;
    }
  }

  async getLocalMasterPasswordUUID() {
    const { masterPasswordUUID } = await primeMasterPasswordPersistAtom.get();
    if (!masterPasswordUUID) {
      throw new Error('No master password UUID');
    }
    return masterPasswordUUID;
  }

  @backgroundMethod()
  @toastIfError()
  async ensurePrimeLoginValidPassword(password: string) {
    ensureSensitiveTextEncoded(password);
    const rawPassword =
      await this.backgroundApi.servicePassword.decodeSensitiveText({
        encodedText: password,
      });
    if (!rawPassword) {
      throw new Error('Invalid password');
    }
  }

  @backgroundMethod()
  async startForgetPassword({
    email,
    passwordDialogPromiseId,
  }: {
    email: string;
    passwordDialogPromiseId: number;
  }) {
    console.log('startForgetPassword', passwordDialogPromiseId);
    if (passwordDialogPromiseId) {
      await this.backgroundApi.servicePrime.cancelPrimeLogin({
        promiseId: passwordDialogPromiseId,
        dialogType: 'promptPrimeLoginPasswordDialog',
      });
    }

    // show forget password dialog
    await this.backgroundApi.servicePrime.promptForgetMasterPasswordDialog();

    await this.clearLocalMasterPassword();

    return { success: true };
  }

  @backgroundMethod()
  @toastIfError()
  async startChangePassword() {
    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerify({
        reason: ALWAYS_VERIFY_PASSCODE_WHEN_CHANGE_SET_MASTER_PASSWORD
          ? EReasonForNeedPassword.Security
          : undefined,
        dialogProps: {
          // custom title not working
          title: 'Change Master Password',
          // TODO description not working for Set passcode dialog
          description: 'Please enter your passcode to change master password',
        },
      });

    const { serverUserInfo } = await this.withDialogLoading(
      { title: 'Checking user info' },
      async () => this.backgroundApi.servicePrime.apiFetchPrimeUserInfo(),
    );
    const serverPasswordUUID = serverUserInfo?.pwdHash;

    // verify old password
    const oldPasswordResult = await this.prepareMasterPassword({
      passcode: password,
      serverUserInfo,
      isRegister: false,
    });
    const oldSyncCredential: ICloudSyncCredential = {
      masterPasswordUUID: oldPasswordResult.masterPasswordUUID,
      securityPasswordR1: oldPasswordResult.securityPasswordR1,
      primeAccountSalt: oldPasswordResult.accountSalt,
    };

    await this.withDialogLoading(
      {
        title: 'Checking password',
      },
      async () => {
        await this.verifyServerMasterPassword({
          syncCredential: oldSyncCredential,
        });
        await this.saveLocalMasterPassword({
          masterPasswordUUID: oldPasswordResult.masterPasswordUUID,
          encryptedSecurityPasswordR1:
            oldPasswordResult.encryptedSecurityPasswordR1,
        });
        // start server sync flow to ensure the server data is up to date
        await this.backgroundApi.servicePrimeCloudSync.startServerSyncFlowSilently(
          {
            throwError: true,
          },
        );
      },
    );

    // setup new master password
    const newPasswordResult = await this.prepareMasterPassword({
      passcode: password,
      serverUserInfo,
      isRegister: true,
      masterPasswordUUIDBuilder: () => {
        return stringUtils.generateUUID();
      },
    });

    const newSyncCredential: ICloudSyncCredential = {
      masterPasswordUUID: newPasswordResult.masterPasswordUUID,
      securityPasswordR1: newPasswordResult.securityPasswordR1,
      primeAccountSalt: newPasswordResult.accountSalt,
    };

    if (process.env.NODE_ENV !== 'production') {
      const securityPasswordR1 = await this.decryptSecurityPassword({
        password,
        securityPasswordEncrypted:
          newPasswordResult.encryptedSecurityPasswordR1,
        masterPasswordUUID: newPasswordResult.masterPasswordUUID,
        accountSalt: newPasswordResult.accountSalt,
        primeUserId: newPasswordResult.primeUserId,
      });
      if (newPasswordResult.securityPasswordR1 !== securityPasswordR1) {
        throw new Error('Failed to decrypt securityPasswordR1');
      }
    }

    let newLocalItems: IDBCloudSyncItem[] = [];
    await this.withDialogLoading(
      {
        title: 'Encrypting data',
      },
      async () => {
        const { serverData } =
          await this.backgroundApi.servicePrimeCloudSync.apiDownloadItems();

        newLocalItems = await Promise.all(
          serverData.map(async (item) => {
            const oldLocalItem =
              await this.backgroundApi.servicePrimeCloudSync.convertServerItemToLocalItem(
                {
                  serverItem: item,
                  shouldDecrypt: true,
                  syncCredential: oldSyncCredential,
                },
              );
            if (!oldLocalItem.rawDataJson) {
              throw new Error('No raw data json');
            }
            const newLocalItem =
              await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
                key: item.key,
                rawDataJson: oldLocalItem.rawDataJson,
                syncCredential: newSyncCredential,
                dataTime: item.dataTimestamp,
              });

            newLocalItem.localSceneUpdated = false;
            newLocalItem.serverUploaded = true;
            return newLocalItem;
          }),
        );
      },
    );

    await this.withDialogLoading(
      {
        title: 'Syncing data',
      },
      async () => {
        const newFlushLock =
          await this.backgroundApi.servicePrimeCloudSync.buildFlushLock({
            syncCredential: newSyncCredential,
          });
        await this.backgroundApi.servicePrimeCloudSync._callApiUploadItems({
          localItems: newLocalItems,
          isFlush: true, // change master password, should flush all items
          pwdHash: newSyncCredential.masterPasswordUUID,
          flushLock: newFlushLock,
          setUndefinedTimeToNow: true,
        });
        await this.clearLocalMasterPassword({
          skipDisableCloudSync: true,
        });
        await this.backgroundApi.servicePrimeCloudSync.initLocalSyncItemsDB({
          syncCredential: newSyncCredential,
          password,
        });
        await this.saveLocalMasterPassword({
          masterPasswordUUID: newPasswordResult.masterPasswordUUID,
          encryptedSecurityPasswordR1:
            newPasswordResult.encryptedSecurityPasswordR1,
        });
        await this.backgroundApi.servicePrimeCloudSync.clearCachedSyncCredential();
      },
    );

    await this.backgroundApi.serviceApp.showToast({
      method: 'success',
      title: 'Master password changed',
    });
    return true;
  }

  async getSecurityPasswordR1InfoSafe({ passcode }: { passcode: string }) {
    const { masterPasswordUUID, encryptedSecurityPasswordR1 } =
      await primeMasterPasswordPersistAtom.get();

    if (masterPasswordUUID && encryptedSecurityPasswordR1 && passcode) {
      try {
        const isPrimeLoggedIn =
          await this.backgroundApi.servicePrime.isPrimeLoggedIn();
        if (!isPrimeLoggedIn) {
          throw new Error('Prime is not logged in');
        }
        const { serverUserInfo } =
          await this.backgroundApi.servicePrime.apiFetchPrimeUserInfo();
        const accountSalt = serverUserInfo?.salt;
        const primeUserId = serverUserInfo?.userId;
        if (!accountSalt || !primeUserId) {
          throw new Error('No accountSalt or primeUserId in serverApi');
        }
        const securityPasswordR1 = await this.decryptSecurityPassword({
          securityPasswordEncrypted: encryptedSecurityPasswordR1,
          password: passcode,
          masterPasswordUUID,
          accountSalt,
          primeUserId,
        });
        if (!securityPasswordR1) {
          throw new Error('Failed to decrypt securityPasswordR1');
        }
        return {
          securityPasswordR1,
          accountSalt,
          primeUserId,
          masterPasswordUUID,
        };
      } catch (error) {
        console.error('getSecurityPasswordR1InfoSafe ERROR ', error);
        await this.clearLocalMasterPassword();
      }
    }
  }

  async updatePasscodeForMasterPassword({
    oldPasscode,
    newPasscode,
  }: {
    oldPasscode: string;
    newPasscode: string;
  }) {
    const oldMasterPasswordAtom: IPrimeMasterPasswordPersistAtomData =
      await primeMasterPasswordPersistAtom.get();
    const oldInfo = await this.getSecurityPasswordR1InfoSafe({
      passcode: oldPasscode,
    });
    if (oldInfo) {
      const masterPasswordUUID = oldInfo.masterPasswordUUID;
      const encryptedSecurityPasswordR1 = await this.encryptSecurityPassword({
        password: newPasscode,
        securityPassword: oldInfo.securityPasswordR1,
        masterPasswordUUID,
        accountSalt: oldInfo.accountSalt,
        primeUserId: oldInfo.primeUserId,
      });
      await this.saveLocalMasterPassword({
        masterPasswordUUID,
        encryptedSecurityPasswordR1,
      });
      await this.backgroundApi.servicePrimeCloudSync.clearCachedSyncCredential();
    }

    return {
      rollback: async () => {
        await this.saveLocalMasterPassword(oldMasterPasswordAtom);
      },
    };
  }
}

export default ServiceMasterPassword;
