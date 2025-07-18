import { Semaphore } from 'async-mutex';
import { isNaN, isNil } from 'lodash';
import { io } from 'socket.io-client';

import {
  decryptAsync,
  decryptImportedCredential,
  decryptRevealableSeed,
  encryptAsync,
  mnemonicFromEntropy,
} from '@onekeyhq/core/src/secret';
import appCrypto from '@onekeyhq/shared/src/appCrypto';
import appDeviceInfo from '@onekeyhq/shared/src/appDeviceInfo/appDeviceInfo';
import {
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { headerPlatform } from '@onekeyhq/shared/src/request/InterceptorConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IE2EESocketUserInfo,
  IPrimeTransferData,
  IPrimeTransferHDWallet,
  IPrimeTransferPrivateData,
  IPrimeTransferSelectedData,
  IPrimeTransferSelectedItemMap,
  IPrimeTransferSelectedItemMapInfo,
} from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { settingsPersistAtom } from '../../states/jotai/atoms';
import {
  EPrimeTransferStatus,
  primeTransferAtom,
} from '../../states/jotai/atoms/prime';
import ServiceBase from '../ServiceBase';
import {
  HDWALLET_BACKUP_VERSION,
  IMPORTED_ACCOUNT_BACKUP_VERSION,
  WATCHING_ACCOUNT_BACKUP_VERSION,
} from '../ServiceCloudBackup';

import e2eeClientToClientApi, {
  generateEncryptedKey,
} from './e2ee/e2eeClientToClientApi';
import { createE2EEClientToClientApiProxy } from './e2ee/e2eeClientToClientApiProxy';
import { createE2EEServerApiProxy } from './e2ee/e2eeServerApiProxy';

import type {
  IECDHEKeyExchangeRequest,
  IECDHEKeyExchangeResponse,
} from './e2ee/e2eeClientToClientApi';
import type { E2EEClientToClientApiProxy } from './e2ee/e2eeClientToClientApiProxy';
import type { E2EEServerApiProxy } from './e2ee/e2eeServerApiProxy';
import type {
  IDBAccount,
  IDBUtxoAccount,
  IDBWallet,
} from '../../dbs/local/types';
import type { IPrimeTransferAtomData } from '../../states/jotai/atoms/prime';
import type { IAccountDeriveTypes } from '../../vaults/types';
import type { Socket } from 'socket.io-client';

export interface ITransferProgress {
  current: number;
  total: number;
  status: 'preparing' | 'sending' | 'receiving' | 'completed' | 'failed';
  message?: string;
}

let connectedPairingCode: string | null = null;
let connectedEncryptedKey: string | null = null;

class ServicePrimeTransfer extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private socket: Socket | null = null;

  private e2eeServerApiProxy: E2EEServerApiProxy | null = null;

  private e2eeClientToClientApiProxy: E2EEClientToClientApiProxy | null = null;

  initWebsocketMutex = new Semaphore(1);

  @backgroundMethod()
  @toastIfError()
  async initWebSocket({ endpoint }: { endpoint: string }) {
    console.log('initWebSocket', endpoint);
    await this.initWebsocketMutex.runExclusive(async () => {
      // TODO mutex
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const settings = await settingsPersistAtom.get();
      await this.disconnectWebSocket();
      this.socket = io(endpoint, {
        transports: [
          //
          // platformEnv.isNative || platformEnv.isExtension
          //   ? 'polling'
          //   : undefined,
          'polling',
          'websocket',
        ].filter(Boolean),
        upgrade: true,
        timeout: 10_000,
        auth: {
          // instanceId: settings.instanceId,
        },
      });
      if (this.socket) {
        this.e2eeServerApiProxy = createE2EEServerApiProxy({
          socket: this.socket as any,
        });

        // Listen to socket connection events
        this.socket.on('connect', () => {
          connectedPairingCode = null;
          connectedEncryptedKey = null;
          void primeTransferAtom.set(
            (v): IPrimeTransferAtomData => ({ ...v, websocketConnected: true }),
          );
        });

        this.socket.on('disconnect', () => {
          void this.handleDisconnect();
        });

        this.socket.on('connect_error', (error) => {
          const e = error as unknown as
            | { message: string; type: string; description: string }
            | undefined;
          console.log('connect_error', e?.message, e?.type, e?.description);
          console.log(
            'Socket.IO transport:',
            this.socket?.io?.engine?.transport?.name,
          );
          connectedPairingCode = null;
          connectedEncryptedKey = null;
          void primeTransferAtom.set(
            (v): IPrimeTransferAtomData => ({
              ...v,
              websocketConnected: false,
              status: EPrimeTransferStatus.init,
              pairedRoomId: undefined,
              myUserId: undefined,
            }),
          );
        });

        this.socket.on(
          'user-left',
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          async (data: {
            roomId: string;
            userId: string;
            userCount: number;
          }) => {
            const currentState = await primeTransferAtom.get();
            if (
              currentState.status !== EPrimeTransferStatus.init &&
              data.roomId === currentState.pairedRoomId
            ) {
              void this.leaveRoom({
                roomId: currentState.pairedRoomId || '',
                userId: currentState.myUserId || '',
              });
            }
          },
        );

        // TODO use client to client api, and verify if pairing code is valid for the other device
        this.socket.on(
          'start-transfer',
          async (data: {
            roomId: string;
            fromUserId: string;
            toUserId: string;
            randomNumber: string;
          }) => {
            if (data.roomId === (await primeTransferAtom.get()).pairedRoomId) {
              this.checkRoomIdValid(data.roomId);
              await primeTransferAtom.set(
                (v): IPrimeTransferAtomData => ({
                  ...v,
                  transferDirection: {
                    fromUserId: data.fromUserId,
                    toUserId: data.toUserId,
                    randomNumber: data.randomNumber,
                  },
                  status: EPrimeTransferStatus.transferring,
                }),
              );
            }
          },
        );

        this.socket.on('room-full', async (data: { roomId: string }) => {
          if (data.roomId === (await primeTransferAtom.get()).pairedRoomId) {
            const message = appLocale.intl.formatMessage({
              // eslint-disable-next-line spellcheck/spell-checker
              id: ETranslations.global_connet_error_try_again,
            });
            appEventBus.emit(EAppEventBusNames.PrimeTransferForceExit, {
              title: message,
              description: platformEnv.isDev ? 'RoomIsFullError' : '',
            });
          }
        });
      }
    });
  }

  async initClientToClientApiApi({ roomId }: { roomId: string }) {
    if (!this.socket) {
      throw new OneKeyLocalError('WebSocket not connected');
    }
    this.checkRoomIdValid(roomId);
    e2eeClientToClientApi.e2eeClientToClientApiSetup({
      socket: this.socket as any,
      roomId,
    });
    this.e2eeClientToClientApiProxy = createE2EEClientToClientApiProxy({
      socket: this.socket as any,
      roomId,
    });
  }

  checkWebSocketConnected() {
    if (!this.e2eeServerApiProxy?.bridge?.socket?.connected) {
      throw new OneKeyLocalError('WebSocket not connected');
    }
  }

  @backgroundMethod()
  async handleTransferDirectionChanged(data: {
    roomId: string | undefined;
    fromUserId?: string | undefined;
    toUserId?: string | undefined;
  }) {
    if (
      data.roomId &&
      data.roomId === (await primeTransferAtom.get()).pairedRoomId
    ) {
      this.checkRoomIdValid(data.roomId);
      await primeTransferAtom.set(
        (v): IPrimeTransferAtomData => ({
          ...v,
          transferDirection: {
            fromUserId: data.fromUserId,
            toUserId: data.toUserId,
            randomNumber: v?.transferDirection?.randomNumber,
          },
        }),
      );
    }
  }

  @backgroundMethod()
  @toastIfError()
  async createRoom() {
    this.checkWebSocketConnected();
    await primeTransferAtom.set(
      (v): IPrimeTransferAtomData => ({
        ...v,
        myCreatedRoomId: undefined,
      }),
    );
    const result = await this.e2eeServerApiProxy?.roomManager.createRoom();
    if (result) {
      this.checkRoomIdValid(result.roomId);
      await primeTransferAtom.set(
        (v): IPrimeTransferAtomData => ({
          ...v,
          myCreatedRoomId: result.roomId,
        }),
      );
      return this.joinRoom(result);
    }
    return undefined;
  }

  checkRoomIdValid(roomId: string | undefined | null) {
    if (!roomId || roomId.length !== 11) {
      throw new OneKeyLocalError('Invalid room ID');
    }
  }

  checkPairingCodeValid(pairingCode: string | undefined | null) {
    if (!pairingCode || pairingCode.length !== 59) {
      const message = appLocale.intl.formatMessage({
        id: ETranslations.transfer_invalid_code,
      });
      throw new OneKeyLocalError(message);
    }
  }

  @backgroundMethod()
  @toastIfError()
  async checkPairingCodeValidAsync(pairingCode: string | undefined | null) {
    this.checkPairingCodeValid(pairingCode);
  }

  @backgroundMethod()
  @toastIfError()
  async joinRoom({ roomId }: { roomId: string }) {
    try {
      this.checkRoomIdValid(roomId);
      this.checkWebSocketConnected();
      // const settings = await settingsPersistAtom.get();
      const deviceInfo = await appDeviceInfo.getDeviceInfo();
      // TODO try to join room from client side?
      const result = await this.e2eeServerApiProxy?.roomManager.joinRoom({
        roomId,
        appPlatformName: deviceInfo.displayName || 'Unknown Device',
        appVersion: platformEnv.version || '',
        appBuildNumber: platformEnv.buildNumber || '',
        appPlatform: headerPlatform,
        appDeviceName: platformEnv.appFullName,
      });
      await primeTransferAtom.set(
        (v): IPrimeTransferAtomData => ({
          ...v,
          myUserId: result?.userId,
        }),
      );
      if (result?.userId && result?.roomId) {
        await this.initClientToClientApiApi({ roomId: result.roomId });
      }
      return result;
    } catch (error) {
      console.error('joinRoom error', error);
      void this.leaveRoom({
        roomId: roomId || (await primeTransferAtom.get()).pairedRoomId || '',
        userId: (await primeTransferAtom.get()).myUserId || '',
      });
      throw error;
    }
  }

  async leaveRoom({ roomId, userId }: { roomId: string; userId: string }) {
    void this.e2eeServerApiProxy?.roomManager.leaveRoom({
      roomId,
      userId,
    });
    void this.handleLeaveRoom();
  }

  @backgroundMethod()
  async getRoomIdFromPairingCode(pairingCode: string) {
    const rawPairingCode =
      await this.backgroundApi.servicePassword.decodeSensitiveText({
        encodedText: pairingCode,
      });
    return rawPairingCode.split('-').slice(0, 2).join('-').toUpperCase();
  }

  @backgroundMethod()
  async verifyPairingCodeDevTest() {
    if (process.env.NODE_ENV !== 'production') {
      return this.verifyPairingCode({
        pairingCode: connectedPairingCode || '',
      });
    }
    throw new OneKeyLocalError('Not in production environment');
  }

  @backgroundMethod()
  @toastIfError()
  async verifyPairingCode({ pairingCode }: { pairingCode: string }) {
    this.checkPairingCodeValid(pairingCode);
    const userId = (await primeTransferAtom.get()).myUserId || '';
    const roomId =
      (await this.getRoomIdFromPairingCode(pairingCode)) ||
      (await primeTransferAtom.get()).pairedRoomId ||
      '';
    try {
      this.checkWebSocketConnected();
      if (!this.e2eeClientToClientApiProxy) {
        throw new OneKeyLocalError('Client to Client API not initialized');
      }

      // Generate client ECDHE key pair
      const clientKeyPair = await appCrypto.ECDHE.generateECDHEKeyPair();
      const verifyString = 'OneKeyPrimeTransfer';

      // Encrypt verification data with pairing code
      const encryptedData = bufferUtils.bytesToHex(
        await encryptAsync({
          data: bufferUtils.utf8ToBytes(verifyString),
          password: pairingCode.toUpperCase(),
          allowRawPassword: true,
        }),
      );

      // Send ECDHE key exchange request
      const keyExchangeRequest: IECDHEKeyExchangeRequest = {
        userId,
        encryptedData,
        clientPublicKey: clientKeyPair.publicKey,
      };

      const result: IECDHEKeyExchangeResponse =
        await this.e2eeClientToClientApiProxy.api.verifyPairingCode(
          keyExchangeRequest,
        );

      if (result.success && result.serverPublicKey) {
        // Validate server public key format (compressed secp256k1: 33 bytes = 66 hex chars)
        if (!result.serverPublicKey || result.serverPublicKey.length !== 66) {
          throw new OneKeyLocalError('Invalid server public key format');
        }

        // Derive ECDHE shared secret
        let sharedSecret = await appCrypto.ECDHE.getSharedSecret({
          privateKey: clientKeyPair.privateKey,
          publicKey: result.serverPublicKey,
        });
        // Clear ephemeral private key immediately (forward secrecy)
        clientKeyPair.privateKey = '';

        // Derive symmetric key from ECDHE shared secret and pairing code
        let encryptedKey = await generateEncryptedKey({
          pairingCode: pairingCode.toUpperCase(),
          sharedSecret,
          roomId,
        });
        sharedSecret = '';

        console.log(
          'Client: ECDHE symmetric key derived and validated successfully',
        );
        void this.handleClientsSuccessPaired({
          roomId,
          pairingCode,
          encryptedKey,
        });
        encryptedKey = '';
      } else {
        // Clear ephemeral private key on failure
        clientKeyPair.privateKey = '';
        throw new OneKeyLocalError(
          'ECDHE key exchange failed: server verification unsuccessful',
        );
      }
    } catch (error) {
      void this.leaveRoom({ roomId, userId });
      throw error;
    }
  }

  @backgroundMethod()
  async handleClientsSuccessPaired({
    roomId,
    pairingCode,
    encryptedKey,
  }: {
    roomId: string;
    pairingCode: string;
    encryptedKey: string;
  }) {
    this.checkRoomIdValid(roomId);
    connectedPairingCode = pairingCode.toUpperCase();
    connectedEncryptedKey = encryptedKey;
    await primeTransferAtom.set(
      (v): IPrimeTransferAtomData => ({
        ...v,
        status: EPrimeTransferStatus.paired,
        pairedRoomId: roomId,
      }),
    );
  }

  @backgroundMethod()
  @toastIfError()
  async updateSelfPairingCode({ pairingCode }: { pairingCode: string }) {
    e2eeClientToClientApi.setSelfPairingCode({ pairingCode });
  }

  @backgroundMethod()
  @toastIfError()
  async getRoomUsers({
    roomId,
  }: {
    roomId: string;
  }): Promise<IE2EESocketUserInfo[]> {
    this.checkWebSocketConnected();
    this.checkRoomIdValid(roomId);
    return this.e2eeServerApiProxy?.roomManager.getRoomUsers({ roomId }) || [];
  }

  @backgroundMethod()
  @toastIfError()
  async changeTransferDirection({
    roomId,
    fromUserId,
    toUserId,
  }: {
    roomId: string;
    fromUserId: string;
    toUserId: string;
  }) {
    this.checkWebSocketConnected();
    this.checkRoomIdValid(roomId);
    // TODO use client to client api
    const result =
      await this.e2eeClientToClientApiProxy?.api.changeTransferDirection({
        roomId,
        fromUserId,
        toUserId,
      });

    await this.handleTransferDirectionChanged({
      roomId,
      ...result,
    });
    return result;
  }

  @backgroundMethod()
  @toastIfError()
  async startTransfer({
    roomId,
    fromUserId,
    toUserId,
  }: {
    roomId: string;
    fromUserId: string;
    toUserId: string;
  }) {
    this.checkWebSocketConnected();
    this.checkRoomIdValid(roomId);
    if (!fromUserId || !toUserId) {
      throw new OneKeyLocalError('From user ID and to user ID are required');
    }
    if (fromUserId === toUserId) {
      throw new OneKeyLocalError(
        'From user ID and to user ID cannot be the same',
      );
    }
    // TODO use client to client api
    const result = await this.e2eeServerApiProxy?.roomManager.startTransfer({
      roomId,
      fromUserId,
      toUserId,
    });
    if (!result) {
      throw new OneKeyLocalError('Failed to start transfer');
    }
    return result;
  }

  @backgroundMethod()
  @toastIfError()
  async cancelTransfer() {
    this.checkWebSocketConnected();
    await this.e2eeClientToClientApiProxy?.api.cancelTransfer();
  }

  @backgroundMethod()
  @toastIfError()
  async sendTransferData({
    transferData,
  }: {
    transferData: IPrimeTransferData;
  }) {
    this.checkWebSocketConnected();

    const currentState = await primeTransferAtom.get();
    const pairedRoomId = currentState.pairedRoomId;
    if (!pairedRoomId) {
      throw new OneKeyLocalError('Paired room ID is required');
    }
    this.checkPairingCodeValid(connectedPairingCode);
    if (!connectedPairingCode) {
      throw new OneKeyLocalError(
        'sendTransferData ERROR: connectedPairingCode is required',
      );
    }

    if (pairedRoomId === currentState.myCreatedRoomId) {
      e2eeClientToClientApi.checkIsVerifiedRoomId(pairedRoomId);
    }

    const data = stringUtils.stableStringify(transferData);

    const encryptionKey = connectedEncryptedKey;
    if (!encryptionKey) {
      throw new OneKeyLocalError('Connected encrypted key is required');
    }

    const encryptedData = await encryptAsync({
      data: bufferUtils.utf8ToBytes(data),
      password: encryptionKey,
      allowRawPassword: true,
    });
    const result = await this.e2eeClientToClientApiProxy?.api.sendTransferData({
      rawData: encryptedData.toString('base64'),
    });
    return result;
  }

  @backgroundMethod()
  @toastIfError()
  async receiveTransferData({ rawData }: { rawData: string }) {
    this.checkPairingCodeValid(connectedPairingCode);
    if (!connectedPairingCode) {
      throw new OneKeyLocalError(
        'receiveTransferData ERROR: connectedPairingCode is required',
      );
    }
    const encryptedData = Buffer.from(rawData, 'base64');

    const decryptionKey = connectedEncryptedKey;
    if (!decryptionKey) {
      throw new OneKeyLocalError('Connected encrypted key is required');
    }

    const data = await decryptAsync({
      data: encryptedData,
      password: decryptionKey,
      allowRawPassword: true,
    });
    const d: string = bufferUtils.bytesToUtf8(data);
    appEventBus.emit(EAppEventBusNames.PrimeTransferDataReceived, {
      data: JSON.parse(d) as IPrimeTransferData,
    });
  }

  async handleDisconnect() {
    connectedPairingCode = null;
    connectedEncryptedKey = null;
    await primeTransferAtom.set(
      (v): IPrimeTransferAtomData => ({
        ...v,
        websocketConnected: false,
        status: EPrimeTransferStatus.init,
        myCreatedRoomId: undefined,
        pairedRoomId: undefined,
        myUserId: undefined,
        transferDirection: undefined,
      }),
    );
  }

  async handleLeaveRoom() {
    connectedPairingCode = null;
    connectedEncryptedKey = null;
    await primeTransferAtom.set(
      (v): IPrimeTransferAtomData => ({
        ...v,
        status: EPrimeTransferStatus.init,
        pairedRoomId: undefined,
      }),
    );
  }

  @backgroundMethod()
  @toastIfError()
  async disconnectWebSocket() {
    try {
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;

        connectedPairingCode = null;
        connectedEncryptedKey = null;
        e2eeClientToClientApi.setSelfPairingCode({ pairingCode: '' });
        e2eeClientToClientApi.clearSensitiveData();
        await this.handleDisconnect();
      }
    } catch (error) {
      console.error('disconnectWebSocket error', error);
    }
  }

  @backgroundMethod()
  @toastIfError()
  async generateConnectionCode() {
    const size = 5;
    const segmentSize = 8;
    const code = stringUtils.randomString(size * segmentSize, {
      chars: stringUtils.randomStringCharsSet.base58UpperCase,
    });
    const codeWithSeparator = stringUtils.addSeparatorToString({
      str: code,
      groupSize: size,
      separator: '-',
    });
    return { code, codeWithSeparator };
  }

  @backgroundMethod()
  async getDataForTransfer(): Promise<IPrimeTransferData> {
    const { serviceAccount } = this.backgroundApi;

    const credentials = await serviceAccount.dumpCredentials();

    const privateBackupData: IPrimeTransferPrivateData = {
      credentials,
      importedAccounts: {},
      watchingAccounts: {},
      wallets: {},
    };
    const { version } = platformEnv;

    const { wallets } = await serviceAccount.getWallets();

    const walletAccountMap = wallets.reduce((summary, current) => {
      summary[current.id] = current;
      return summary;
    }, {} as Record<string, IDBWallet>);
    const { accounts: allAccounts } = await serviceAccount.getAllAccounts();

    for (const account of allAccounts) {
      const walletId = accountUtils.parseAccountId({
        accountId: account.id,
      }).walletId;
      const wallet = walletAccountMap[walletId];
      if (wallet && wallet.type !== WALLET_TYPE_HW) {
        if (wallet.type === WALLET_TYPE_IMPORTED) {
          const importedAccountUUID = account.id;

          privateBackupData.importedAccounts[importedAccountUUID] = {
            ...account,
            version: IMPORTED_ACCOUNT_BACKUP_VERSION,
          };
        }
        if (wallet.type === WALLET_TYPE_WATCHING) {
          const watchingAccountUUID = account.id;

          privateBackupData.watchingAccounts[watchingAccountUUID] = {
            ...account,
            version: WATCHING_ACCOUNT_BACKUP_VERSION,
          };
        }
        if (wallet.type === WALLET_TYPE_HD) {
          const walletToBackup: IPrimeTransferHDWallet = privateBackupData
            .wallets[wallet.id] ?? {
            id: walletId,
            name: wallet.name,
            type: wallet.type,
            backuped: wallet.backuped,
            accounts: [],
            accountIds: [],
            indexedAccountUUIDs: [],
            nextIds: wallet.nextIds,
            avatarInfo: wallet.avatarInfo,
            version: HDWALLET_BACKUP_VERSION,
          };
          const HDAccountUUID = account.id;
          if (account.indexedAccountId) {
            const indexedAccount = await serviceAccount.getIndexedAccountSafe({
              id: account.indexedAccountId,
            });
            // indexedAccount may be removed, but account not clean yet (check ServiceAppCleanup)
            if (indexedAccount) {
              account.name = indexedAccount.name;
              if (
                !walletToBackup.indexedAccountUUIDs?.includes(
                  account.indexedAccountId,
                )
              ) {
                walletToBackup.indexedAccountUUIDs.push(
                  account.indexedAccountId,
                );
              }
              walletToBackup.accounts.push(account);
              walletToBackup.accountIds.push(HDAccountUUID);

              privateBackupData.wallets[wallet.id] = walletToBackup;
            }
          }
        }
      }
    }

    const privateData = privateBackupData;

    return {
      privateData,
      appVersion: version ?? '',
      isEmptyData:
        !Object.keys(privateData?.wallets || {}).length &&
        !Object.keys(privateData?.importedAccounts || {}).length &&
        !Object.keys(privateData?.watchingAccounts || {}).length,
    };
  }

  private extractSelectedItems<T>({
    selectedItemMapInfo,
    dataSource,
    credentials,
  }: {
    selectedItemMapInfo: IPrimeTransferSelectedItemMapInfo;
    dataSource: Record<string, T>;
    credentials?: Record<string, string>;
  }): Array<{ item: T; credential?: string; id: string }> {
    const results: Array<{ item: T; credential?: string; id: string }> = [];
    const itemIds = Object.keys(selectedItemMapInfo);

    for (let i = 0; i < itemIds.length; i += 1) {
      const itemId = itemIds[i];
      if (selectedItemMapInfo[itemId] === true && dataSource[itemId]) {
        const item = dataSource[itemId];
        const credential = credentials?.[itemId];
        results.push({ item, credential, id: itemId });
      }
    }

    return results;
  }

  @backgroundMethod()
  @toastIfError()
  async getSelectedTransferData({
    data,
    selectedItemMap,
  }: {
    data: IPrimeTransferData;
    selectedItemMap: IPrimeTransferSelectedItemMap;
  }): Promise<IPrimeTransferSelectedData> {
    // Extract selected wallets
    const wallets = this.extractSelectedItems({
      selectedItemMapInfo: selectedItemMap.wallet,
      dataSource: data.privateData.wallets,
      credentials: data.privateData.credentials,
    });

    // Extract selected imported accounts
    const importedAccounts = this.extractSelectedItems({
      selectedItemMapInfo: selectedItemMap.importedAccount,
      dataSource: data.privateData.importedAccounts,
      credentials: data.privateData.credentials,
    });

    // Extract selected watching accounts
    const watchingAccounts = this.extractSelectedItems({
      selectedItemMapInfo: selectedItemMap.watchingAccount,
      dataSource: data.privateData.watchingAccounts,
    });

    return {
      wallets,
      importedAccounts,
      watchingAccounts,
    };
  }

  @backgroundMethod()
  @toastIfError()
  async verifyCredentialCanBeDecrypted({
    walletCredential,
    importedAccountCredential,
    password,
  }: {
    walletCredential: string | undefined;
    importedAccountCredential: string | undefined;
    password: string;
  }) {
    try {
      if (walletCredential) {
        if (!password) {
          throw new OneKeyLocalError('Password is required');
        }
        const decryptedCredential1 = await decryptRevealableSeed({
          rs: walletCredential,
          password,
          allowRawPassword: true,
        });
      } else if (importedAccountCredential) {
        if (!password) {
          throw new OneKeyLocalError('Password is required');
        }
        const decryptedCredential2 = await decryptImportedCredential({
          credential: importedAccountCredential,
          password,
          allowRawPassword: true,
        });
      }
      return true;
    } catch (e) {
      console.error('verifyCredentialCanBeDecrypted error', e);
      return false;
    }
  }

  @backgroundMethod()
  async updateImportProgress(): Promise<void> {
    await primeTransferAtom.set((prev) => ({
      ...prev,
      importProgress: prev?.importProgress
        ? {
            ...prev?.importProgress,
            isImporting: true,
            current: (prev?.importProgress?.current || 0) + 1,
          }
        : undefined,
    }));
  }

  @backgroundMethod()
  @toastIfError()
  async initImportProgress({
    selectedTransferData,
  }: {
    selectedTransferData: IPrimeTransferSelectedData;
  }): Promise<void> {
    let totalProgressCount = 0;
    // Count wallets and their indexed accounts
    selectedTransferData.wallets?.forEach((wallet) => {
      totalProgressCount += wallet?.item?.accounts?.length || 0;
    });
    // Count imported accounts
    totalProgressCount += selectedTransferData.importedAccounts?.length || 0;
    // Count watching accounts
    totalProgressCount += selectedTransferData.watchingAccounts?.length || 0;

    await primeTransferAtom.set((prev) => ({
      ...prev,
      importProgress: {
        total: totalProgressCount,
        isImporting: true,
        current: 0,
      },
    }));
  }

  @backgroundMethod()
  @toastIfError()
  async resetImportProgress(): Promise<void> {
    // Reset import progress
    await primeTransferAtom.set((prev) => ({
      ...prev,
      importProgress: undefined,
    }));
  }

  @backgroundMethod()
  @toastIfError()
  async completeImportProgress(): Promise<void> {
    await primeTransferAtom.set((prev) => ({
      ...prev,
      importProgress: prev.importProgress
        ? {
            ...prev.importProgress,
            isImporting: false,
            current: prev.importProgress.total,
          }
        : undefined,
    }));
  }

  @backgroundMethod()
  @toastIfError()
  async startImport({
    selectedTransferData,
    password,
  }: {
    selectedTransferData: IPrimeTransferSelectedData;
    password: string;
  }): Promise<{ success: boolean }> {
    // const { watchingAccounts, importedAccounts } = selectedTransferData;
    // const { wallets, ...others } = selectedTransferData;
    // console.log(others);

    const { serviceAccount, serviceNetwork, servicePassword } =
      this.backgroundApi;

    // TODO try catch
    for (const { item: wallet, credential } of selectedTransferData.wallets) {
      if (!credential) {
        throw new OneKeyLocalError('Credential is required');
      }
      if (!password) {
        throw new OneKeyLocalError('Password is required');
      }
      const mnemonicFromRs = await mnemonicFromEntropy(credential, password);
      // serviceAccount.createAddressIfNotExists
      const { wallet: newWallet } = await serviceAccount.createHDWallet({
        mnemonic: await servicePassword.encodeSensitiveText({
          text: mnemonicFromRs,
        }),
        name: wallet.name,
        avatarInfo: wallet.avatarInfo,
        isWalletBackedUp: wallet.backuped,
      });
      const createNetworkParams: {
        [index: number]: {
          index: number;
          customNetworks: {
            networkId: string;
            deriveType: IAccountDeriveTypes;
          }[];
        };
      } = {};

      // TODO try catch
      for (const hdAccount of wallet.accounts) {
        const index = accountUtils.getHDAccountPathIndex({
          account: hdAccount,
        });
        const networkId = await serviceAccount.getAccountCreatedNetworkId({
          account: hdAccount,
        });
        const deriveTypeData = await serviceNetwork.getDeriveTypeByDBAccount({
          networkId: networkId || '',
          account: hdAccount,
        });
        if (
          !isNil(index) &&
          !isNaN(index) &&
          networkId &&
          deriveTypeData.deriveType
        ) {
          createNetworkParams[index] = createNetworkParams[index] || {
            customNetworks: [],
          };
          createNetworkParams[index].index = index;
          createNetworkParams[index].customNetworks.push({
            networkId,
            deriveType: deriveTypeData.deriveType,
          });
        }
      }
      const createNetworkParamsEntries = Object.entries(createNetworkParams);

      // TODO try catch
      for (const [, { customNetworks, index }] of createNetworkParamsEntries) {
        await this.backgroundApi.serviceBatchCreateAccount.startBatchCreateAccountsFlowForAllNetwork(
          {
            walletId: newWallet.id,
            fromIndex: index,
            toIndex: index,
            excludedIndexes: {},
            saveToDb: true,
            showUIProgress: true, // emit EAppEventBusNames.BatchCreateAccount event
            autoHandleExitError: false,
            customNetworks,
          },
        );
      }
      //
    }

    for (const {
      item: importedAccount,
      credential,
    } of selectedTransferData.importedAccounts) {
      if (!credential) {
        throw new OneKeyLocalError('Credential is required');
      }
      if (!password) {
        throw new OneKeyLocalError('Password is required');
      }
      const networkId = await serviceAccount.getAccountCreatedNetworkId({
        account: importedAccount,
      });
      if (!networkId) {
        throw new OneKeyLocalError('NetworkId is required');
      }
      const { exportedPrivateKey, privateKey } =
        await serviceAccount.getExportedPrivateKeyOfImportedAccount({
          importedAccount,
          encryptedCredential: credential,
          password,
          networkId,
        });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { addedAccounts } =
        await serviceAccount.restoreImportedAccountByInput({
          importedAccount,
          input: exportedPrivateKey,
          privateKey,
          networkId,
        });
      if (addedAccounts?.length) {
        await this.updateImportProgress();
        await timerUtils.wait(100); // wait for UI refresh
      }
    }

    for (const {
      item: watchingAccount,
    } of selectedTransferData.watchingAccounts) {
      const watchingAccountUtxo = watchingAccount as IDBUtxoAccount;
      let addedAccounts: IDBAccount[] = [];
      const networkId = await serviceAccount.getAccountCreatedNetworkId({
        account: watchingAccount,
      });
      if (!networkId) {
        throw new OneKeyLocalError('NetworkId is required');
      }

      if (watchingAccount?.pub) {
        const result = await serviceAccount.restoreWatchingAccountByInput({
          watchingAccount,
          input: watchingAccount.pub,
          networkId,
        });
        addedAccounts = [...addedAccounts, ...(result?.addedAccounts || [])];
      }

      if (watchingAccountUtxo?.xpub) {
        const result = await serviceAccount.restoreWatchingAccountByInput({
          watchingAccount,
          input: watchingAccountUtxo.xpub,
          networkId,
        });
        addedAccounts = [...addedAccounts, ...(result?.addedAccounts || [])];
      }

      if (watchingAccountUtxo?.xpubSegwit) {
        const result = await serviceAccount.restoreWatchingAccountByInput({
          watchingAccount,
          input: watchingAccountUtxo.xpubSegwit,
          networkId,
        });
        addedAccounts = [...addedAccounts, ...(result?.addedAccounts || [])];
      }

      if (watchingAccount?.address && addedAccounts?.length === 0) {
        const result = await serviceAccount.restoreWatchingAccountByInput({
          watchingAccount,
          input: watchingAccount.address,
          networkId,
        });
        addedAccounts = [...addedAccounts, ...(result?.addedAccounts || [])];
      }
      if (addedAccounts?.length) {
        await this.updateImportProgress();
        await timerUtils.wait(100); // wait for UI refresh
      }
    }

    return {
      success: true,
    };
  }
}

export default ServicePrimeTransfer;
