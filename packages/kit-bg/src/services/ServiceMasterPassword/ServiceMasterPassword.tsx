import crypto from 'crypto';

import {
  decryptStringAsync,
  encryptStringAsync,
  ensureSensitiveTextEncoded,
  sha512Pro,
} from '@onekeyhq/core/src/secret';
import {
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  ALWAYS_VERIFY_PASSCODE_WHEN_CHANGE_SET_MASTER_PASSWORD,
  ENCRYPTED_SECURITY_PASSWORD_R1_FOR_SERVER_PREFIX,
  ENCRYPTED_SECURITY_PASSWORD_R1_PREFIX,
  ENCRYPTED_SECURITY_PASSWORD_SPLITTER,
  EPrimeCloudSyncDataType,
  RESET_CLOUD_SYNC_MASTER_PASSWORD_UUID as RESET_MASTER_PASSWORD_UUID,
} from '@onekeyhq/shared/src/consts/primeConsts';
import {
  IncorrectMasterPassword,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  ICloudSyncCredential,
  ICloudSyncCredentialForLock,
  ICloudSyncPayloadLock,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';
import type {
  ESecurityPasswordType,
  IPrimeServerUserInfo,
} from '@onekeyhq/shared/types/prime/primeTypes';
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

    const hash = await sha512Pro({
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
    localPasscode,
    masterPasswordUUID,
    accountSalt,
    primeUserId,
  }: {
    localPasscode: string;
    masterPasswordUUID: string;
    accountSalt: string;
    primeUserId: string;
  }) {
    // eslint-disable-next-line no-param-reassign
    localPasscode =
      await this.backgroundApi.servicePassword.decodeSensitiveText({
        encodedText: localPasscode,
      });
    const instanceId = await this.backgroundApi.serviceSetting.getInstanceId();
    const instancePrivateSalt = ''; // TODO create instance salt by getRandomBytes for better random
    return [
      '747E735A-4129-4F0D-B0E2-356D088072B9',
      localPasscode,
      instanceId,
      instancePrivateSalt,
      masterPasswordUUID,
      accountSalt,
      primeUserId,
    ].join('--');
  }

  async buildSecurityPasswordForServerEncryptKey({
    masterPassword,
    masterPasswordUUID,
    masterPasswordHash,
    accountSalt,
    primeUserId,
  }: {
    masterPassword: string;
    masterPasswordUUID: string;
    masterPasswordHash: string;
    accountSalt: string;
    primeUserId: string;
  }) {
    // eslint-disable-next-line no-param-reassign
    masterPassword =
      await this.backgroundApi.servicePassword.decodeSensitiveText({
        encodedText: masterPassword,
      });
    return [
      '5B52886D-15BB-4E6A-94D7-A3A65337399A',
      masterPassword,
      masterPasswordUUID,
      masterPasswordHash,
      accountSalt,
      primeUserId,
    ].join('--');
  }

  async encryptSecurityPasswordForServer({
    securityPassword,
    masterPassword,
    masterPasswordUUID,
    masterPasswordHash,
    accountSalt,
    primeUserId,
  }: {
    securityPassword: string;
    masterPassword: string;
    masterPasswordUUID: string;
    masterPasswordHash: string;
    accountSalt: string;
    primeUserId: string;
  }): Promise<string> {
    const r = await encryptStringAsync({
      password: await this.buildSecurityPasswordForServerEncryptKey({
        masterPassword,
        masterPasswordUUID,
        masterPasswordHash,
        accountSalt,
        primeUserId,
      }),
      data: securityPassword,
      dataEncoding: 'utf-8',
      allowRawPassword: true,
    });
    return `${ENCRYPTED_SECURITY_PASSWORD_R1_FOR_SERVER_PREFIX}${r}`;
  }

  async decryptSecurityPasswordForServer({
    encryptedSecurityPasswordForServer,
    masterPassword,
    masterPasswordUUID,
    masterPasswordHash,
    accountSalt,
    primeUserId,
  }: {
    encryptedSecurityPasswordForServer: string;
    masterPassword: string;
    masterPasswordUUID: string;
    masterPasswordHash: string;
    accountSalt: string;
    primeUserId: string;
  }): Promise<string> {
    // eslint-disable-next-line no-param-reassign
    encryptedSecurityPasswordForServer =
      encryptedSecurityPasswordForServer.split(
        ENCRYPTED_SECURITY_PASSWORD_SPLITTER,
      )?.[1];
    const password = await this.buildSecurityPasswordForServerEncryptKey({
      masterPassword,
      masterPasswordUUID,
      masterPasswordHash,
      accountSalt,
      primeUserId,
    });
    try {
      return await decryptStringAsync({
        password,
        data: encryptedSecurityPasswordForServer,
        dataEncoding: 'hex',
        resultEncoding: 'utf-8',
        allowRawPassword: true,
      });
    } catch (error) {
      if (
        errorUtils.isErrorByClassName({
          error,
          className: EOneKeyErrorClassNames.IncorrectPassword,
        })
      ) {
        throw new IncorrectMasterPassword();
      }
      throw error;
    }
  }

  @backgroundMethod()
  async encryptSecurityPassword({
    securityPassword,
    localPasscode,
    masterPasswordUUID,
    primeUserId,
    accountSalt,
  }: {
    securityPassword: string;
    localPasscode: string; // passcode
    masterPasswordUUID: string;
    primeUserId: string;
    accountSalt: string;
  }): Promise<string> {
    // TODO check empty value
    // eslint-disable-next-line no-param-reassign
    localPasscode =
      await this.backgroundApi.servicePassword.decodeSensitiveText({
        encodedText: localPasscode,
      });
    const r = await encryptStringAsync({
      password: await this.buildSecurityPasswordEncryptKey({
        localPasscode,
        masterPasswordUUID,
        accountSalt,
        primeUserId,
      }),
      data: securityPassword,
      dataEncoding: 'utf-8',
      allowRawPassword: true,
    });
    return `${ENCRYPTED_SECURITY_PASSWORD_R1_PREFIX}${r}`;
  }

  // TODO empty check
  @backgroundMethod()
  async decryptSecurityPassword({
    localPasscode,
    securityPasswordEncrypted,
    masterPasswordUUID,
    accountSalt,
    primeUserId,
  }: {
    localPasscode: string;
    securityPasswordEncrypted: string;
    masterPasswordUUID: string;
    accountSalt: string;
    primeUserId: string;
  }) {
    // eslint-disable-next-line no-param-reassign
    securityPasswordEncrypted = securityPasswordEncrypted.split(
      ENCRYPTED_SECURITY_PASSWORD_SPLITTER,
    )?.[1];
    // TODO check empty value
    // eslint-disable-next-line no-param-reassign
    localPasscode =
      await this.backgroundApi.servicePassword.decodeSensitiveText({
        encodedText: localPasscode,
      });
    return decryptStringAsync({
      password: await this.buildSecurityPasswordEncryptKey({
        localPasscode,
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

  // TODO test if executed from native side
  @backgroundMethod()
  async generateRandomSecurityPassword() {
    const key: Buffer = crypto.randomBytes(32);
    return bufferUtils.bytesToHex(key);
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
    const securityTypeHash = await sha512Pro({
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
      await this.backgroundApi.servicePrimeCloudSync.setCloudSyncEnabled(
        false,
        {
          skipClearLocalMasterPassword: true,
        },
      );
    }
  }

  async prepareMasterPassword({
    passcode,
    serverUserInfo,
    isRegister,
    isChangeMasterPassword,
    masterPasswordUUIDBuilder,
    securityPasswordR1Builder,
  }: {
    passcode?: string;
    serverUserInfo: IPrimeServerUserInfo | undefined;
    isRegister: boolean;
    isChangeMasterPassword?: boolean;
    masterPasswordUUIDBuilder?: () => string;
    securityPasswordR1Builder?: () => Promise<string>;
  }) {
    // const primePersist = await primePersistAtom.get();
    // const isServerMasterPasswordSet = Boolean(
    //   serverUserInfo?.pwdHash &&
    //     serverUserInfo?.pwdHash !== RESET_MASTER_PASSWORD_UUID,
    // );
    const serverPasswordUUID = serverUserInfo?.pwdHash;
    const accountSalt = serverUserInfo?.salt;
    if (!accountSalt) {
      throw new OneKeyLocalError('FetchPrimeUserInfo ERROR: No salt');
    }
    const primeUserId = serverUserInfo?.userId;
    if (!primeUserId) {
      throw new OneKeyLocalError('FetchPrimeUserInfo ERROR: No primeUserId');
    }

    let localPasscode = passcode;
    if (!localPasscode) {
      ({ password: localPasscode } =
        await this.backgroundApi.servicePassword.promptPasswordVerify({}));
    }
    localPasscode =
      await this.backgroundApi.servicePassword.decodeSensitiveText({
        encodedText: localPasscode,
      });
    if (!localPasscode) {
      throw new OneKeyLocalError('Invalid passcode');
    }

    const { masterPassword } =
      await this.backgroundApi.servicePrime.promptPrimeLoginPasswordDialog({
        email: serverUserInfo?.emails?.[0] || '',
        isRegister,
        isVerifyMasterPassword: true,
        isChangeMasterPassword,
        serverUserInfo,
      });
    ensureSensitiveTextEncoded(masterPassword);

    const result = await this.withDialogLoading(
      {
        // title: 'Preparing password',
        title: appLocale.intl.formatMessage({
          id: ETranslations.global_processing,
        }),
      },
      async () => {
        const rawMasterPassword =
          await this.backgroundApi.servicePassword.decodeSensitiveText({
            encodedText: masterPassword,
          });
        if (!rawMasterPassword) {
          throw new OneKeyLocalError('Invalid master password');
        }

        let masterPasswordUUID = serverPasswordUUID;
        // change password use masterPasswordUUIDBuilder
        if (masterPasswordUUIDBuilder) {
          masterPasswordUUID = masterPasswordUUIDBuilder();
        } else if (isRegister) {
          masterPasswordUUID = stringUtils.generateUUID();
        }

        if (!masterPasswordUUID) {
          throw new OneKeyLocalError(
            'SetupMasterPassword ERROR: No master password UUID',
          );
        }

        // const securityPasswordR1 = await this.buildSecurityPassword({
        //   securityType: ESecurityPasswordType.CloudSyncR1,
        //   rawMasterPassword,
        //   masterPasswordHash,
        //   accountSalt,
        //   primeUserId,
        //   // TODO including instanceId and instancePrivateSalt
        // });

        const masterPasswordHash = await this.hashMasterPassword({
          rawMasterPassword,
          accountSalt,
          primeUserId,
        });

        let securityPasswordR1 = '';
        let encryptedSecurityPasswordR1ForServer = '';

        if (isRegister) {
          if (securityPasswordR1Builder) {
            securityPasswordR1 = await securityPasswordR1Builder();
          } else {
            securityPasswordR1 = await this.generateRandomSecurityPassword();
          }
          // securityPasswordR1 encrypt to server
          encryptedSecurityPasswordR1ForServer =
            await this.encryptSecurityPasswordForServer({
              securityPassword: securityPasswordR1,
              masterPassword: rawMasterPassword,
              masterPasswordUUID,
              masterPasswordHash,
              accountSalt,
              primeUserId,
            });
        } else {
          const verifyResult = await this.verifyServerMasterPassword({
            syncCredential: {
              masterPasswordUUID,
              securityPasswordR1: 'lock',
              primeAccountSalt: accountSalt,
            },
            masterPassword: rawMasterPassword,
            masterPasswordUUID,
            masterPasswordHash,
            accountSalt,
            primeUserId,
          });
          securityPasswordR1 = verifyResult.securityPasswordR1;
          encryptedSecurityPasswordR1ForServer =
            verifyResult.encryptedSecurityPasswordR1ForServer;
        }

        //  securityPasswordR1 encrypt to local
        const encryptedSecurityPasswordR1 = await this.encryptSecurityPassword({
          securityPassword: securityPasswordR1,
          localPasscode,
          masterPasswordUUID,
          accountSalt,
          primeUserId,
        });

        if (
          !securityPasswordR1 ||
          !encryptedSecurityPasswordR1 ||
          !encryptedSecurityPasswordR1ForServer
        ) {
          throw new OneKeyLocalError(
            'SetupMasterPassword ERROR: No master password',
          );
        }

        // login should match to server password UUID
        if (
          !isRegister &&
          serverPasswordUUID &&
          serverPasswordUUID !== masterPasswordUUID
        ) {
          throw new OneKeyLocalError(
            'SetupMasterPassword ERROR: Server password UUID mismatch',
          );
        }

        return {
          masterPassword,
          masterPasswordUUID,
          masterPasswordHash,
          encryptedSecurityPasswordR1,
          encryptedSecurityPasswordR1ForServer,
          securityPasswordR1,
          accountSalt,
          primeUserId,
        };
      },
    );

    return result;
  }

  @backgroundMethod()
  async IsServerMasterPasswordSet({
    serverUserInfo,
  }: {
    serverUserInfo: IPrimeServerUserInfo | undefined;
  }) {
    if (!serverUserInfo) {
      // eslint-disable-next-line no-param-reassign
      ({ serverUserInfo } =
        await this.backgroundApi.servicePrime.apiFetchPrimeUserInfo());
    }
    const serverPasswordUUID = serverUserInfo?.pwdHash;
    const isServerMasterPasswordSet = Boolean(
      serverPasswordUUID && serverPasswordUUID !== RESET_MASTER_PASSWORD_UUID,
    );
    return isServerMasterPasswordSet;
  }

  @backgroundMethod()
  @toastIfError()
  async setupMasterPassword({ passcode }: { passcode?: string } = {}): Promise<{
    encryptedSecurityPasswordR1: string;
    encryptedSecurityPasswordR1ForServer: string;
    masterPasswordUUID: string;
    accountSalt: string;
    primeUserId: string;
    isServerMasterPasswordSet: boolean;
  }> {
    const { serverUserInfo } = await this.withDialogLoading(
      {
        // title: 'Checking User Info',
        title: appLocale.intl.formatMessage({
          id: ETranslations.global_processing,
        }),
      },
      async () => this.backgroundApi.servicePrime.apiFetchPrimeUserInfo(),
    );

    const accountSalt = serverUserInfo?.salt;
    if (!accountSalt) {
      throw new OneKeyLocalError('FetchPrimeUserInfo ERROR: No salt');
    }
    const primeUserId = serverUserInfo?.userId;
    if (!primeUserId) {
      throw new OneKeyLocalError('FetchPrimeUserInfo ERROR: No primeUserId');
    }

    const serverPasswordUUID = serverUserInfo?.pwdHash;
    const isServerMasterPasswordSet = await this.IsServerMasterPasswordSet({
      serverUserInfo,
    });

    const localMasterPasswordAtom = await primeMasterPasswordPersistAtom.get();

    // if (
    //   localMasterPasswordAtom.masterPasswordUUID &&
    //   localMasterPasswordAtom.encryptedSecurityPasswordR1
    // ) {
    //   if (
    //     localMasterPasswordAtom.masterPasswordUUID === serverPasswordUUID &&
    //     isServerMasterPasswordSet
    //   ) {
    //     return {
    //       masterPasswordUUID: localMasterPasswordAtom.masterPasswordUUID,
    //       encryptedSecurityPasswordR1:
    //         localMasterPasswordAtom.encryptedSecurityPasswordR1,
    //       encryptedSecurityPasswordR1ForServer: '',
    //       accountSalt,
    //       primeUserId,
    //       isServerMasterPasswordSet,
    //     };
    //   }
    // }

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

  @backgroundMethod()
  @toastIfError()
  async verifyServerMasterPasswordByServerUserInfo({
    serverUserInfo,
    masterPassword,
  }: {
    serverUserInfo: IPrimeServerUserInfo;
    masterPassword: string;
  }) {
    const serverPasswordUUID = serverUserInfo?.pwdHash;
    const accountSalt = serverUserInfo?.salt;
    const primeUserId = serverUserInfo?.userId;
    if (!serverPasswordUUID) {
      throw new OneKeyLocalError(
        'verifyServerMasterPassword ERROR: No server password hash',
      );
    }
    if (!accountSalt) {
      throw new OneKeyLocalError('verifyServerMasterPassword ERROR: No salt');
    }
    if (!primeUserId) {
      throw new OneKeyLocalError(
        'verifyServerMasterPassword ERROR: No primeUserId',
      );
    }

    const rawMasterPassword =
      await this.backgroundApi.servicePassword.decodeSensitiveText({
        encodedText: masterPassword,
      });
    if (!rawMasterPassword) {
      throw new OneKeyLocalError('Invalid master password');
    }

    const masterPasswordUUID = serverPasswordUUID;

    const masterPasswordHash = await this.hashMasterPassword({
      rawMasterPassword,
      accountSalt,
      primeUserId,
    });

    const verifyResult = await this.verifyServerMasterPassword({
      syncCredential: {
        masterPasswordUUID,
        securityPasswordR1: 'lock',
        primeAccountSalt: accountSalt,
      },
      masterPassword: rawMasterPassword,
      masterPasswordUUID,
      masterPasswordHash,
      accountSalt,
      primeUserId,
    });

    return verifyResult;
  }

  async verifyServerMasterPassword({
    syncCredential,
    clearLocalMasterPasswordIfIncorrect,

    masterPassword,
    masterPasswordUUID,
    masterPasswordHash,
    accountSalt,
    primeUserId,
  }: {
    syncCredential: ICloudSyncCredentialForLock;
    clearLocalMasterPasswordIfIncorrect?: boolean;

    masterPassword: string;
    masterPasswordUUID: string;
    masterPasswordHash: string;
    accountSalt: string;
    primeUserId: string;
  }): Promise<{
    encryptedSecurityPasswordR1ForServer: string;
    securityPasswordR1: string;
  }> {
    try {
      const { lock } =
        await this.backgroundApi.servicePrimeCloudSync.apiFetchSyncLock();
      if (!lock) {
        throw new OneKeyLocalError(
          'verifyMasterPassword ERROR: No lock of server to verify',
        );
      }
      // eslint-disable-next-line no-param-reassign
      syncCredential =
        this.backgroundApi.servicePrimeCloudSync.syncManagers.lock.getLockStaticSyncCredential(
          syncCredential,
        );

      const localItem =
        await this.backgroundApi.servicePrimeCloudSync.convertServerItemToLocalItem(
          {
            serverItem: lock,
            shouldDecrypt: false,
            syncCredential,
            serverPwdHash: syncCredential.masterPasswordUUID,
          },
        );
      if (!localItem) {
        throw new OneKeyLocalError('verifyMasterPassword ERROR: No local item');
      }

      const decryptedItem = await cloudSyncItemBuilder.decryptSyncItem({
        item: localItem,
        syncCredential,
      });
      // password correct with server
      if (decryptedItem?.rawDataJson?.payload) {
        const payload = decryptedItem?.rawDataJson
          ?.payload as ICloudSyncPayloadLock;
        if (
          payload?.message === 'lock' &&
          payload?.encryptedSecurityPasswordR1ForServer
        ) {
          const securityPasswordR1 =
            await this.decryptSecurityPasswordForServer({
              encryptedSecurityPasswordForServer:
                payload.encryptedSecurityPasswordR1ForServer,
              masterPassword,
              masterPasswordUUID,
              masterPasswordHash,
              accountSalt,
              primeUserId,
            });
          return {
            securityPasswordR1,
            encryptedSecurityPasswordR1ForServer:
              payload.encryptedSecurityPasswordR1ForServer,
          };
        }
      }
      throw new OneKeyLocalError(
        'verifyMasterPassword ERROR: Invalid password',
      );
    } catch (error) {
      if (clearLocalMasterPasswordIfIncorrect) {
        // password incorrect with server
        await this.clearLocalMasterPassword();
      }
      throw error;
    }
  }

  async getLocalMasterPasswordUUID() {
    const { masterPasswordUUID } = await primeMasterPasswordPersistAtom.get();
    if (!masterPasswordUUID) {
      throw new OneKeyLocalError('No master password UUID');
    }
    return masterPasswordUUID;
  }

  async getLocalMasterPasswordUUIDSafe() {
    try {
      return await this.getLocalMasterPasswordUUID();
    } catch (error) {
      return undefined;
    }
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
      throw new OneKeyLocalError('Invalid password');
    }
  }

  // startResetPassword
  @backgroundMethod()
  async startForgetPassword({
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

    // show forget password warning dialog
    await this.backgroundApi.servicePrime.promptForgetMasterPasswordDialog();

    // verify passcode
    await this.backgroundApi.servicePassword.promptPasswordVerify({
      reason: EReasonForNeedPassword.Security,
      dialogProps: {
        title: 'Reset Password',
        description: appLocale.intl.formatMessage({
          id: ETranslations.prime_verify_passcode_reset_sync_password,
        }),
      },
    });

    // reset server data by api
    await this.withDialogLoading(
      {
        // title: 'Resetting password',
        title: appLocale.intl.formatMessage({
          id: ETranslations.global_processing,
        }),
      },
      async () => {
        await this.backgroundApi.servicePrimeCloudSync.resetServerData({
          skipPrimeStatusCheck: true,
        });
        await this.clearLocalMasterPassword();
      },
    );

    const success = true;
    if (success) {
      await this.showToast({
        method: 'success',
        title: appLocale.intl.formatMessage({
          id: ETranslations.global_success,
        }),
      });
    }
    return { success };
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
          description: appLocale.intl.formatMessage({
            id: ETranslations.prime_verify_passcode_change_sync_password,
          }),
        },
      });

    const { serverUserInfo } = await this.withDialogLoading(
      {
        // title: 'Checking User Info',
        title: appLocale.intl.formatMessage({
          id: ETranslations.global_processing,
        }),
      },
      async () => this.backgroundApi.servicePrime.apiFetchPrimeUserInfo(),
    );

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
        // title: 'Checking password',
        title: appLocale.intl.formatMessage({
          id: ETranslations.global_processing,
        }),
      },
      async () => {
        await this.verifyServerMasterPassword({
          syncCredential: {
            ...oldSyncCredential,
            securityPasswordR1: 'lock',
          },
          masterPassword: oldPasswordResult.masterPassword,
          masterPasswordUUID: oldPasswordResult.masterPasswordUUID,
          masterPasswordHash: oldPasswordResult.masterPasswordHash,
          accountSalt: serverUserInfo?.salt || '',
          primeUserId: serverUserInfo?.userId || '',
        });
        await this.saveLocalMasterPassword({
          masterPasswordUUID: oldPasswordResult.masterPasswordUUID,
          encryptedSecurityPasswordR1:
            oldPasswordResult.encryptedSecurityPasswordR1,
        });

        // start server sync flow to ensure the server data is up to date
        // await this.backgroundApi.servicePrimeCloudSync.startServerSyncFlowSilently(
        //   {
        //     throwError: true,
        //   },
        // );
      },
    );

    // setup new master password
    const newPasswordResult = await this.prepareMasterPassword({
      passcode: password,
      serverUserInfo,
      isRegister: true,
      isChangeMasterPassword: true,
      masterPasswordUUIDBuilder: () => {
        return stringUtils.generateUUID();
      },
      securityPasswordR1Builder: async () => {
        // Use the same securityPasswordR1 of old master password to avoid rebuilding all sync items
        return oldPasswordResult.securityPasswordR1;
      },
    });

    const newSyncCredential: ICloudSyncCredential = {
      masterPasswordUUID: newPasswordResult.masterPasswordUUID,
      securityPasswordR1: newPasswordResult.securityPasswordR1,
      primeAccountSalt: newPasswordResult.accountSalt,
    };

    if (process.env.NODE_ENV !== 'production') {
      const securityPasswordR1 = await this.decryptSecurityPassword({
        localPasscode: password,
        securityPasswordEncrypted:
          newPasswordResult.encryptedSecurityPasswordR1,
        masterPasswordUUID: newPasswordResult.masterPasswordUUID,
        accountSalt: newPasswordResult.accountSalt,
        primeUserId: newPasswordResult.primeUserId,
      });
      if (newPasswordResult.securityPasswordR1 !== securityPasswordR1) {
        throw new OneKeyLocalError('Failed to decrypt securityPasswordR1');
      }
    }

    const shouldFlushAllItems = false;

    let newLocalItems: IDBCloudSyncItem[] = [];
    if (shouldFlushAllItems) {
      await this.withDialogLoading(
        {
          // title: 'Encrypting data',
          title: appLocale.intl.formatMessage({
            id: ETranslations.global_processing,
          }),
        },
        async () => {
          const { serverData, pwdHash } =
            await this.backgroundApi.servicePrimeCloudSync.apiDownloadItems();

          newLocalItems = (
            await Promise.all(
              serverData.map(async (item) => {
                if (item.dataType === EPrimeCloudSyncDataType.Lock) {
                  return null;
                }
                const oldLocalItem =
                  await this.backgroundApi.servicePrimeCloudSync.convertServerItemToLocalItem(
                    {
                      serverItem: item,
                      shouldDecrypt: true,
                      syncCredential: oldSyncCredential,
                      serverPwdHash: pwdHash,
                    },
                  );
                if (!oldLocalItem.rawDataJson) {
                  throw new OneKeyLocalError('No raw data json');
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
            )
          ).filter(Boolean);
        },
      );
    }

    await this.withDialogLoading(
      {
        // title: 'Syncing data',
        title: appLocale.intl.formatMessage({
          id: ETranslations.global_processing,
        }),
      },
      async () => {
        const newLockItem =
          await this.backgroundApi.servicePrimeCloudSync.buildLockItem({
            syncCredential: {
              ...newSyncCredential,
              securityPasswordR1: 'lock',
            },
            encryptedSecurityPasswordR1ForServer:
              newPasswordResult.encryptedSecurityPasswordR1ForServer,
          });
        if (!newLockItem) {
          throw new OneKeyLocalError('Failed to build flush lock');
        }
        if (shouldFlushAllItems) {
          await this.backgroundApi.servicePrimeCloudSync._callApiUploadItems({
            localItems: shouldFlushAllItems ? newLocalItems : [newLockItem],
            isFlush: shouldFlushAllItems, // change master password, should flush all items
            setUndefinedTimeToNow: true,
            pwdHash: newSyncCredential.masterPasswordUUID,
            lockItem: newLockItem,
          });
        } else {
          await this.backgroundApi.servicePrimeCloudSync.callApiChangeLock({
            pwdHash: newSyncCredential.masterPasswordUUID,
            lockItem: newLockItem,
          });
        }
        await this.verifyServerMasterPassword({
          syncCredential: {
            ...newSyncCredential,
            securityPasswordR1: 'lock',
          },
          masterPassword: newPasswordResult.masterPassword,
          masterPasswordUUID: newPasswordResult.masterPasswordUUID,
          masterPasswordHash: newPasswordResult.masterPasswordHash,
          accountSalt: serverUserInfo?.salt || '',
          primeUserId: serverUserInfo?.userId || '',
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
      title: appLocale.intl.formatMessage({
        id: ETranslations.global_success,
      }),
    });
    return true;
  }

  async getSecurityPasswordR1InfoSafe({ passcode }: { passcode: string }) {
    const { masterPasswordUUID, encryptedSecurityPasswordR1 } =
      await primeMasterPasswordPersistAtom.get();

    if (masterPasswordUUID && encryptedSecurityPasswordR1 && passcode) {
      try {
        const isPrimeLoggedIn =
          await this.backgroundApi.servicePrime.isLoggedIn();
        if (!isPrimeLoggedIn) {
          throw new OneKeyLocalError('Prime is not logged in');
        }
        const { serverUserInfo } =
          await this.backgroundApi.servicePrime.apiFetchPrimeUserInfo();
        const accountSalt = serverUserInfo?.salt;
        const primeUserId = serverUserInfo?.userId;
        if (!accountSalt || !primeUserId) {
          throw new OneKeyLocalError(
            'No accountSalt or primeUserId in serverApi',
          );
        }
        const securityPasswordR1 = await this.decryptSecurityPassword({
          securityPasswordEncrypted: encryptedSecurityPasswordR1,
          localPasscode: passcode,
          masterPasswordUUID,
          accountSalt,
          primeUserId,
        });
        if (!securityPasswordR1) {
          throw new OneKeyLocalError('Failed to decrypt securityPasswordR1');
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
        localPasscode: newPasscode,
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
