import { Semaphore } from 'async-mutex';
import { debounce, isEmpty, isNaN, isNil } from 'lodash';
import natsort from 'natsort';
import { io } from 'socket.io-client';

import type { IBip39RevealableSeed } from '@onekeyhq/core/src/secret';
import {
  decryptAsync,
  decryptImportedCredential,
  decryptRevealableSeed,
  encryptAsync,
  encryptRevealableSeed,
  mnemonicFromEntropy,
  revealEntropyToMnemonic,
} from '@onekeyhq/core/src/secret';
import type { ICoreImportedCredential } from '@onekeyhq/core/src/types';
import appCrypto from '@onekeyhq/shared/src/appCrypto';
import appDeviceInfo from '@onekeyhq/shared/src/appDeviceInfo/appDeviceInfo';
import {
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import {
  WALLET_TYPE_HD,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import {
  TRANSFER_PAIRING_CODE_LENGTH,
  TRANSFER_ROOM_ID_LENGTH,
  TRANSFER_VERIFY_STRING,
} from '@onekeyhq/shared/src/consts/primeConsts';
import { IMPL_TON } from '@onekeyhq/shared/src/engine/engineConsts';
import {
  OneKeyLocalError,
  PrimeTransferImportCancelledError,
  TransferInvalidCodeError,
} from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { headerPlatform } from '@onekeyhq/shared/src/request/InterceptorConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  IAllWalletAvatarImageNamesWithoutDividers,
  IOthersWalletAvatarImageNames,
} from '@onekeyhq/shared/src/utils/avatarUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import type { IAvatarInfo } from '@onekeyhq/shared/src/utils/emojiUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IE2EESocketUserInfo,
  IPrimeTransferAccount,
  IPrimeTransferData,
  IPrimeTransferHDAccount,
  IPrimeTransferHDWallet,
  IPrimeTransferHDWalletCreateNetworkParams,
  IPrimeTransferHDWalletIndexedAccountNames,
  IPrimeTransferPrivateData,
  IPrimeTransferPublicData,
  IPrimeTransferPublicDataWalletDetail,
  IPrimeTransferSelectedData,
  IPrimeTransferSelectedDataItem,
  IPrimeTransferSelectedItemMap,
  IPrimeTransferSelectedItemMapInfo,
} from '@onekeyhq/shared/types/prime/primeTransferTypes';
import { EPrimeTransferServerType } from '@onekeyhq/shared/types/prime/primeTransferTypes';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import localDb from '../../dbs/local/localDb';
import {
  perpsActiveAccountRefreshHookAtom,
  settingsPersistAtom,
} from '../../states/jotai/atoms';
import {
  EPrimeTransferStatus,
  primeTransferAtom,
} from '../../states/jotai/atoms/prime';
import ServiceBase from '../ServiceBase';
import { HDWALLET_BACKUP_VERSION } from '../ServiceCloudBackup';

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

  // Heartbeat mechanism for UI layer connection monitoring
  private lastPingTime = 0;

  private heartbeatCheckTimer: ReturnType<typeof setInterval> | null = null;

  @backgroundMethod()
  async verifyWebSocketEndpoint(endpoint: string): Promise<{
    isValid: boolean;
    correctedUrl?: string;
  }> {
    try {
      // Helper function to test an endpoint with timeout
      const testEndpoint = async (url: string): Promise<boolean> => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10_000); // 5 second timeout

          const response = await fetch(`${url}/health`, {
            method: 'GET',
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          return response.status === 200;
        } catch (error) {
          return false;
        }
      };

      // If endpoint already has protocol, test it directly
      if (endpoint.startsWith('https://') || endpoint.startsWith('http://')) {
        const isValid = await testEndpoint(endpoint);
        return {
          isValid,
          correctedUrl: isValid ? endpoint : undefined,
        };
      }

      // If no protocol, try both https and http concurrently
      const httpsUrl = `https://${endpoint}`;
      const httpUrl = `http://${endpoint}`;

      const [httpsResult, httpResult] = await Promise.all([
        testEndpoint(httpsUrl),
        testEndpoint(httpUrl),
      ]);

      // Return result with corrected URL (prefer https if both work)
      if (httpsResult) {
        return {
          isValid: true,
          correctedUrl: httpsUrl,
        };
      }

      if (httpResult) {
        return {
          isValid: true,
          correctedUrl: httpUrl,
        };
      }

      return {
        isValid: false,
        correctedUrl: undefined,
      };
    } catch (error) {
      console.error('verifyWebSocketEndpoint error:', error);
      return {
        isValid: false,
        correctedUrl: undefined,
      };
    }
  }

  @backgroundMethod()
  async getWebSocketEndpoint() {
    // return 'http://localhost:3868';
    // return 'https://app-monorepo.onrender.com';
    // return 'https://transfer.onekey-test.com';

    const customEndpointInfo =
      await this.backgroundApi.simpleDb.primeTransfer.getServerConfig();
    if (
      customEndpointInfo.customServerUrl &&
      customEndpointInfo.serverType === EPrimeTransferServerType.CUSTOM
    ) {
      return customEndpointInfo.customServerUrl;
    }

    const officialEndpointInfo =
      await this.backgroundApi.serviceApp.getEndpointInfo({
        name: EServiceEndpointEnum.Transfer,
      });
    const officialEndpoint = officialEndpointInfo.endpoint;
    return officialEndpoint;
  }

  @backgroundMethod()
  @toastIfError()
  async initWebSocket({ endpoint }: { endpoint: string }) {
    console.log('initWebSocket', endpoint);
    await this.initWebsocketMutex.runExclusive(async () => {
      void primeTransferAtom.set(
        (v): IPrimeTransferAtomData => ({
          ...v,
          websocketError: undefined,
        }),
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const settings = await settingsPersistAtom.get();
      await this.disconnectWebSocket();

      void primeTransferAtom.set(
        (v): IPrimeTransferAtomData => ({
          ...v,
          websocketError: undefined,
        }),
      );

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
            (v): IPrimeTransferAtomData => ({
              ...v,
              shouldPreventExit: true,
              websocketConnected: true,
              websocketError: undefined,
            }),
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
              websocketError: e?.message || 'WebSocket connection error',
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
              // id: ETranslations.global_connet_error_try_again,
              id: ETranslations.transfer_security_alert_new_device_re_pair,
            });
            appEventBus.emit(EAppEventBusNames.PrimeTransferForceExit, {
              title: message,
              description: platformEnv.isDev ? 'RoomIsFullError' : '',
            });
          }
        });
      }

      // Start heartbeat monitoring after WebSocket is initialized
      this.startHeartbeatCheck();
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
      return this.joinRoom({
        roomId: result.roomId,
        isJoinAfterCreate: true,
      });
    }
    return undefined;
  }

  checkRoomIdValid(roomId: string | undefined | null) {
    if (!roomId || roomId.length !== TRANSFER_ROOM_ID_LENGTH) {
      throw new TransferInvalidCodeError();
    }
  }

  checkPairingCodeValid(pairingCode: string | undefined | null) {
    if (!pairingCode || pairingCode.length !== TRANSFER_PAIRING_CODE_LENGTH) {
      throw new TransferInvalidCodeError();
    }
  }

  @backgroundMethod()
  async checkPairingCodeValidAsync(pairingCode: string | undefined | null) {
    this.checkPairingCodeValid(pairingCode);
  }

  @backgroundMethod()
  @toastIfError()
  async joinRoom({
    roomId,
    isJoinAfterCreate,
  }: {
    roomId: string;
    isJoinAfterCreate?: boolean;
  }) {
    try {
      this.checkRoomIdValid(roomId);
      this.checkWebSocketConnected();
      // const settings = await settingsPersistAtom.get();
      const deviceInfo = await appDeviceInfo.getDeviceInfo();
      const joinFn = isJoinAfterCreate
        ? this.e2eeServerApiProxy?.roomManager.joinRoomAfterCreate.bind(
            this.e2eeServerApiProxy.roomManager,
          )
        : this.e2eeServerApiProxy?.roomManager.joinRoom.bind(
            this.e2eeServerApiProxy.roomManager,
          );
      // TODO try to join room from client side?
      const result = await joinFn?.({
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
      const verifyString = TRANSFER_VERIFY_STRING;

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
    await this.handleTransferDirectionChanged({
      roomId,
      fromUserId,
      toUserId,
    });
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isTransferFromMe,
  }: {
    roomId: string;
    fromUserId: string;
    toUserId: string;
    isTransferFromMe: boolean;
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
  async buildTransferData({
    isForCloudBackup,
  }: {
    isForCloudBackup?: boolean;
  } = {}): Promise<IPrimeTransferData> {
    const { serviceAccount, serviceNetwork } = this.backgroundApi;

    const credentials = await serviceAccount.dumpCredentials();

    const publicData: IPrimeTransferPublicData = {
      dataTime: Date.now(),
      totalWalletsCount: 0,
      totalAccountsCount: 0,
      walletDetails: [],
    };

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
    let { accounts: allAccounts } = await serviceAccount.getAllAccounts();

    const importedWallet = await serviceAccount.getWalletSafe({
      walletId: WALLET_TYPE_IMPORTED,
    });
    const watchingWallet = await serviceAccount.getWalletSafe({
      walletId: WALLET_TYPE_WATCHING,
    });

    const sortAccounts = (accounts: IDBAccount[]) => {
      const sortedAccounts = accounts
        .map((account, walletAccountsIndex) => {
          let walletAccountsIndexUsed: number | undefined = walletAccountsIndex;

          if (
            accountUtils.isWatchingAccount({
              accountId: account.id,
            })
          ) {
            walletAccountsIndexUsed = watchingWallet?.accounts?.findIndex(
              (a) => a === account.id,
            );
          }

          if (
            accountUtils.isImportedAccount({
              accountId: account.id,
            })
          ) {
            walletAccountsIndexUsed = importedWallet?.accounts?.findIndex(
              (a) => a === account.id,
            );
          }

          localDb.refillAccountOrderInfo({
            account,
            walletAccountsIndex:
              isNil(walletAccountsIndexUsed) ||
              isNaN(walletAccountsIndexUsed) ||
              walletAccountsIndexUsed < 0 ||
              walletAccountsIndexUsed === undefined
                ? walletAccountsIndex
                : walletAccountsIndexUsed,
          });
          return account;
        })
        .sort((a, b) => this.accountSortFn(a, b));
      return sortedAccounts;
    };

    allAccounts = sortAccounts(allAccounts);

    const watchingOrImportedAccountToTransferAccount = ({
      account,
      networkAccount,
    }: {
      account: IDBAccount;
      networkAccount: {
        networkAccount: INetworkAccount | undefined;
        address: string;
      };
    }): IPrimeTransferAccount => {
      return {
        id: account.id,
        template: account.template,
        name: account.name,
        createAtNetwork: account?.createAtNetwork,
        networks: account?.networks,
        impl: account?.impl,
        coinType: account?.coinType,
        accountOrder: account?.accountOrder,
        accountOrderSaved: account?.accountOrderSaved,
        path: account?.path,
        type: account?.type,
        pub: account?.pub,
        xpub: (account as IDBUtxoAccount)?.xpub,
        xpubSegwit: (account as IDBUtxoAccount)?.xpubSegwit,
        address: networkAccount?.address || account.address,
        version: -1,
      };
    };

    const hdAccountToTransferAccount = ({
      account,
    }: {
      account: IDBAccount;
    }): IPrimeTransferHDAccount => {
      return {
        id: account.id,
        name: account.name,
        address: account.address,
        pathIndex: account?.pathIndex,
        indexedAccountId: account?.indexedAccountId,
        template: account?.template,
        path: account?.path,
        impl: account?.impl,
        coinType: account?.coinType,
        createAtNetwork: account?.createAtNetwork,
        networks: account?.networks,
      };
    };

    for (const account of allAccounts) {
      const walletId = accountUtils.parseAccountId({
        accountId: account.id,
      }).walletId;
      const wallet = walletAccountMap[walletId];
      if (wallet) {
        const getNetworkAccountInfo = async () => {
          let networkAccount: INetworkAccount | undefined;
          const networkId = await serviceAccount.getAccountCreatedNetworkId({
            account,
          });

          if (networkId && account.id) {
            networkAccount = await serviceAccount.getNetworkAccount({
              dbAccount: account,
              accountId: account.id,
              networkId,
              deriveType: 'default',
              indexedAccountId: undefined,
            });
          }
          return {
            networkAccount,
            address:
              networkAccount?.addressDetail?.displayAddress ||
              networkAccount?.address ||
              account.address,
          };
        };
        if (wallet.type === WALLET_TYPE_IMPORTED) {
          const importedAccountUUID = account.id;
          const networkAccount = await getNetworkAccountInfo();
          privateBackupData.importedAccounts[importedAccountUUID] =
            watchingOrImportedAccountToTransferAccount({
              account,
              networkAccount,
            });
        }
        if (wallet.type === WALLET_TYPE_WATCHING) {
          if (
            !accountUtils.isUrlAccountFn({
              accountId: account.id,
            })
          ) {
            const watchingAccountUUID = account.id;
            const networkAccount = await getNetworkAccountInfo();
            privateBackupData.watchingAccounts[watchingAccountUUID] =
              watchingOrImportedAccountToTransferAccount({
                account,
                networkAccount,
              });
          }
        }
        if (wallet.type === WALLET_TYPE_HD) {
          let walletToBackup: IPrimeTransferHDWallet =
            privateBackupData.wallets[wallet.id];
          if (!walletToBackup) {
            walletToBackup = {
              id: walletId,
              name: wallet.name,
              type: wallet.type,
              backuped: isForCloudBackup ? true : wallet.backuped,
              accounts: [],
              accountIds: [],
              accountIdsLength: 0,
              indexedAccountUUIDs: [],
              indexedAccountUUIDsLength: 0,
              nextIds: wallet.nextIds,
              walletOrder: wallet.walletOrder,
              avatarInfo: wallet.avatarInfo,
              version: HDWALLET_BACKUP_VERSION,
              xfp: wallet.xfp || undefined,
            };
          }
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
                walletToBackup.indexedAccountUUIDs?.push(
                  account.indexedAccountId,
                );
              }
              walletToBackup.accounts?.push(
                hdAccountToTransferAccount({ account }),
              );
              walletToBackup.accountIds?.push(HDAccountUUID);

              privateBackupData.wallets[wallet.id] = walletToBackup;
            }
          }
        }
      }
    }

    // fill publicData summary by aggregating from privateBackupData
    try {
      const hdWallets = Object.values(privateBackupData.wallets);
      const sortedHdWallets = hdWallets.sort((a, b) => this.walletSortFn(a, b));
      const totalHdAccounts = hdWallets.reduce(
        (sum, w) => sum + (w.indexedAccountUUIDs?.length || 0),
        0,
      );
      const importedAccountsCount = Object.keys(
        privateBackupData.importedAccounts,
      ).length;
      const watchingAccountsCount = Object.keys(
        privateBackupData.watchingAccounts,
      ).length;
      publicData.totalWalletsCount = hdWallets.length;
      publicData.totalAccountsCount =
        totalHdAccounts + importedAccountsCount + watchingAccountsCount;
      const walletDetails: Array<IPrimeTransferPublicDataWalletDetail> = [
        ...sortedHdWallets.map((w) => {
          let avatarInfo: IAvatarInfo | undefined;
          try {
            const parsedAvatar = JSON.parse(
              walletAccountMap[w.id]?.avatar || '' || '{}',
            );
            if (parsedAvatar && Object.keys(parsedAvatar).length > 0) {
              avatarInfo = parsedAvatar;
            }
          } catch (error) {
            console.error('refillWalletInfo', error);
          }

          const avatar: IAllWalletAvatarImageNamesWithoutDividers =
            avatarInfo?.img || 'bear';
          return {
            name: w.name,
            avatar,
            accountsCount: w.indexedAccountUUIDs?.length || 0,
            walletXfp: w.xfp,
          };
        }),
      ].filter(Boolean);
      if (importedAccountsCount > 0) {
        const data: IPrimeTransferPublicDataWalletDetail = {
          name: appLocale.intl.formatMessage({
            id: ETranslations.wallet_label_private_key,
          }),
          avatar: 'othersImported',
          accountsCount: importedAccountsCount,
          walletXfp: undefined,
        };
        walletDetails.push(data);
      }
      if (watchingAccountsCount > 0) {
        const data: IPrimeTransferPublicDataWalletDetail = {
          name: appLocale.intl.formatMessage({
            id: ETranslations.wallet_label_watch_only,
          }),
          avatar: 'othersWatching',
          accountsCount: watchingAccountsCount,
          walletXfp: undefined,
        };
        walletDetails.push(data);
      }
      publicData.walletDetails = walletDetails;
    } catch (e) {
      console.error('buildTransferData publicData fill error', e);
    }

    const privateData = privateBackupData;

    for (const wallet of Object.values(privateData.wallets)) {
      const { createNetworkParams = [], indexedAccountNames = {} } =
        await this.buildHdWalletAccountsCreateParams({
          walletId: wallet.id,
          accounts: wallet.accounts || [],
          taskUUID: undefined,
          errorsInfo: undefined,
          skipDefaultNetworks: Boolean(isForCloudBackup),
        });
      wallet.createNetworkParams = createNetworkParams;
      wallet.indexedAccountNames = indexedAccountNames;
      if (isForCloudBackup) {
        wallet.accounts = undefined;
      }
      wallet.accountIdsLength = wallet.accountIds?.length || 0;
      if (isForCloudBackup) {
        wallet.accountIds = undefined;
      }
      wallet.indexedAccountUUIDsLength =
        wallet.indexedAccountUUIDs?.length || 0;
      if (isForCloudBackup) {
        wallet.indexedAccountUUIDs = undefined;
      }
    }

    return {
      privateData,
      publicData,
      appVersion: version ?? '',
      isWatchingOnly: Boolean(
        !Object.keys(privateData?.wallets || {}).length &&
          !Object.keys(privateData?.importedAccounts || {}).length &&
          Object.keys(privateData?.watchingAccounts || {}).length,
      ),
      isEmptyData: Boolean(
        !Object.keys(privateData?.wallets || {}).length &&
          !Object.keys(privateData?.importedAccounts || {}).length &&
          !Object.keys(privateData?.watchingAccounts || {}).length,
      ),
    };
  }

  @backgroundMethod()
  @toastIfError()
  async sendTransferData({
    transferData,
  }: {
    transferData: IPrimeTransferData;
  }) {
    this.checkWebSocketConnected();

    if (!transferData.isWatchingOnly) {
      const { password } =
        await this.backgroundApi.servicePassword.promptPasswordVerify({
          reason: EReasonForNeedPassword.Security,
        });

      if (!password) {
        throw new OneKeyLocalError('Password is required');
      }
    }

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
    const transferData = JSON.parse(d) as IPrimeTransferData | undefined;
    if (!transferData) {
      throw new OneKeyLocalError('Invalid transfer data');
    }

    // fix custom network watching account
    const watchingAccounts = Object.values(
      transferData.privateData.watchingAccounts,
    );
    for (const account of watchingAccounts) {
      let networkId =
        await this.backgroundApi.serviceAccount.getAccountCreatedNetworkId({
          account,
        });
      if (networkUtils.isEvmNetwork({ networkId })) {
        const network = await this.backgroundApi.serviceNetwork.getNetworkSafe({
          networkId,
        });
        // fallback to eth if custom network not exists
        if (!network) {
          networkId = presetNetworksMap.eth.id;
        }
      }
      account.createAtNetwork = networkId || account.createAtNetwork;
    }
    appEventBus.emit(EAppEventBusNames.PrimeTransferDataReceived, {
      data: transferData,
    });
  }

  @backgroundMethod()
  async clearSensitiveData() {
    connectedPairingCode = null;
    connectedEncryptedKey = null;
    e2eeClientToClientApi.setSelfPairingCode({ pairingCode: '' });
    e2eeClientToClientApi.clearSensitiveData();
  }

  async handleDisconnect() {
    connectedPairingCode = null;
    connectedEncryptedKey = null;
    await primeTransferAtom.set(
      (v): IPrimeTransferAtomData => ({
        ...v,
        websocketConnected: false,
        websocketError: 'WebSocket disconnected',
        status: EPrimeTransferStatus.init,
        myCreatedRoomId: undefined,
        pairedRoomId: undefined,
        myUserId: undefined,
        transferDirection: undefined,
      }),
    );
  }

  @backgroundMethod()
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
  async refreshQrcodeHook() {
    await primeTransferAtom.set(
      (v): IPrimeTransferAtomData => ({
        ...v,
        refreshQrcodeHook: Date.now(),
      }),
    );
  }

  // Heartbeat mechanism methods
  @backgroundMethod()
  async pingService() {
    this.lastPingTime = Date.now();
  }

  private startHeartbeatCheck() {
    if (!platformEnv.isExtension) {
      return;
    }
    // Clear existing timer
    if (this.heartbeatCheckTimer) {
      clearInterval(this.heartbeatCheckTimer);
    }

    // Check every 10 seconds if the last ping is older than 10 seconds
    this.heartbeatCheckTimer = setInterval(() => {
      const now = Date.now();
      const timeSinceLastPing = now - this.lastPingTime;

      // If no ping for more than 10 seconds, UI layer is likely closed
      if (this.lastPingTime > 0 && timeSinceLastPing > 10_000) {
        console.log(
          'UI layer connection timeout, auto disconnecting WebSocket',
        );
        void this.disconnectWebSocket();
      }
    }, 10_000);
  }

  private stopHeartbeatCheck() {
    if (this.heartbeatCheckTimer) {
      clearInterval(this.heartbeatCheckTimer);
      this.heartbeatCheckTimer = null;
    }
    this.lastPingTime = 0;
  }

  @backgroundMethod()
  @toastIfError()
  async disconnectWebSocket() {
    // Stop heartbeat monitoring
    this.stopHeartbeatCheck();

    try {
      if (this.socket) {
        try {
          this.socket.removeAllListeners();
        } catch (e) {
          console.error('disconnectWebSocket error', e);
        }
        try {
          this.socket.disconnect();
        } catch (e) {
          console.error('disconnectWebSocket error', e);
        }
        try {
          this.socket.close();
        } catch (e) {
          console.error('disconnectWebSocket error', e);
        }
        try {
          this.socket.disconnect();
        } catch (e) {
          console.error('disconnectWebSocket error', e);
        }
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

  private extractSelectedItems<T>({
    selectedItemMapInfo,
    dataSource,
    credentials,
    decryptedCredentials,
  }: {
    selectedItemMapInfo: IPrimeTransferSelectedItemMapInfo | 'ALL';
    dataSource: Record<string, T>;
    credentials?: Record<string, string>;
    decryptedCredentials?: Record<
      string,
      ICoreImportedCredential | IBip39RevealableSeed
    >;
  }): Array<IPrimeTransferSelectedDataItem<T>> {
    const results: Array<IPrimeTransferSelectedDataItem<T>> = [];

    const buildResultItem = ({ itemId, item }: { itemId: string; item: T }) => {
      let tonMnemonicCredential: string | undefined;
      let tonMnemonicCredentialDecrypted: IBip39RevealableSeed | undefined;
      try {
        if (
          item &&
          accountUtils.isImportedAccount({ accountId: itemId }) &&
          (item as unknown as { impl: string } | undefined)?.impl === IMPL_TON
        ) {
          const tonMnemonicCredentialId =
            accountUtils.buildTonMnemonicCredentialId({
              accountId: itemId,
            });
          tonMnemonicCredential = credentials?.[tonMnemonicCredentialId];
          tonMnemonicCredentialDecrypted = decryptedCredentials?.[
            tonMnemonicCredentialId
          ] as IBip39RevealableSeed;
        }
      } catch (e) {
        console.error('tonMnemonicCredential error', e);
      }
      const credential = credentials?.[itemId];
      const credentialDecrypted = decryptedCredentials?.[itemId];
      return {
        item,
        credential,
        credentialDecrypted,
        id: itemId,
        tonMnemonicCredential,
        tonMnemonicCredentialDecrypted,
      };
    };
    if (selectedItemMapInfo === 'ALL') {
      Object.entries(dataSource).forEach(([itemId, item]) => {
        results.push(buildResultItem({ itemId, item }));
      });
      return results;
    }

    const itemIds = Object.keys(selectedItemMapInfo);
    for (let i = 0; i < itemIds.length; i += 1) {
      const itemId = itemIds[i];
      if (
        selectedItemMapInfo?.[itemId]?.checked === true &&
        dataSource?.[itemId]
      ) {
        const item = dataSource[itemId];
        results.push(buildResultItem({ itemId, item }));
      }
    }

    return results;
  }

  accountSortFn = (
    a: IPrimeTransferAccount | IDBAccount,
    b: IPrimeTransferAccount | IDBAccount,
  ) =>
    natsort({ insensitive: true })(
      a.accountOrder ?? a.accountOrderSaved ?? 0,
      b.accountOrder ?? b.accountOrderSaved ?? 0,
    );

  walletSortFn = (a: IPrimeTransferHDWallet, b: IPrimeTransferHDWallet) =>
    natsort({ insensitive: true })(
      a.walletOrder ?? a.walletOrderSaved ?? 0,
      b.walletOrder ?? b.walletOrderSaved ?? 0,
    );

  @backgroundMethod()
  @toastIfError()
  async getSelectedTransferData({
    data,
    selectedItemMap,
  }: {
    data: IPrimeTransferData;
    selectedItemMap: IPrimeTransferSelectedItemMap | 'ALL';
  }): Promise<IPrimeTransferSelectedData> {
    // Extract selected wallets
    const wallets = this.extractSelectedItems({
      selectedItemMapInfo:
        selectedItemMap === 'ALL' ? 'ALL' : selectedItemMap.wallet,
      dataSource: data.privateData.wallets,
      credentials: data.privateData.credentials,
      decryptedCredentials: data.privateData.decryptedCredentials,
    }).sort((a, b) => this.walletSortFn(a.item, b.item));

    // // Extract selected imported accounts
    const importedAccounts = this.extractSelectedItems({
      selectedItemMapInfo:
        selectedItemMap === 'ALL' ? 'ALL' : selectedItemMap.importedAccount,
      dataSource: data.privateData.importedAccounts,
      credentials: data.privateData.credentials,
      decryptedCredentials: data.privateData.decryptedCredentials,
    }).sort((a, b) => this.accountSortFn(a.item, b.item));

    // // Extract selected watching accounts
    const watchingAccounts = this.extractSelectedItems({
      selectedItemMapInfo:
        selectedItemMap === 'ALL' ? 'ALL' : selectedItemMap.watchingAccount,
      dataSource: data.privateData.watchingAccounts,
    }).sort((a, b) => this.accountSortFn(a.item, b.item));

    // return {
    //   wallets: [],
    //   importedAccounts: [],
    //   watchingAccounts: [],
    // };
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
      totalProgressCount +=
        wallet?.item?.accounts?.length || wallet?.item?.accountIdsLength || 0;
    });
    // this.backgroundApi.serviceBatchCreateAccount.addDefaultNetworkAccounts
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

  finallyImportProgress = debounce(
    async (): Promise<void> => {
      if (this.currentImportTaskUUID === undefined) {
        return;
      }
      /*
      - reset transfer import task
      - register notification clients
      - refresh perps active account
      - call onekey cloud sync
      */
      this.currentImportTaskUUID = undefined;
      void this.backgroundApi.serviceNotification.registerClientWithOverrideAllAccounts();
      void perpsActiveAccountRefreshHookAtom.set((prev) => ({
        ...prev,
        refreshHook: prev.refreshHook + 1,
      }));
      await timerUtils.wait(300);
      appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    },
    1500,
    {
      leading: false,
      trailing: true,
    },
  );

  @backgroundMethod()
  @toastIfError()
  async resetImportProgress(): Promise<void> {
    // Reset import progress
    await primeTransferAtom.set((prev) => ({
      ...prev,
      importProgress: undefined,
    }));
    await this.finallyImportProgress();
  }

  @backgroundMethod()
  @toastIfError()
  async completeImportProgress({
    errorsInfo,
  }: {
    errorsInfo: {
      category: string;
      walletId: string;
      accountId: string;
      networkInfo: string;
      error: string;
    }[];
  }): Promise<void> {
    await primeTransferAtom.set((prev): IPrimeTransferAtomData => {
      const stats = {
        errorsInfo,
        progressTotal: prev.importProgress?.total || 0,
        progressCurrent: prev.importProgress?.current || 0,
      };
      console.log('completeImportProgress', stats);

      return {
        ...prev,
        importProgress: prev.importProgress
          ? {
              ...prev.importProgress,
              isImporting: false,
              current: prev.importProgress.total,
              stats,
            }
          : undefined,
      };
    });
    await this.finallyImportProgress();
  }

  async buildHdWalletAccountsCreateParams({
    walletId,
    skipDefaultNetworks,
    accounts,
    taskUUID,
    errorsInfo,
  }: {
    walletId: string;
    // Do not return default networks for cloud backup, which can save storage capacity
    skipDefaultNetworks?: boolean;
    accounts: IPrimeTransferHDAccount[];
    taskUUID: string | undefined;
    errorsInfo:
      | {
          category: string;
          walletId: string;
          accountId: string;
          networkInfo: string;
          error: string;
        }[]
      | undefined;
  }): Promise<{
    isCancelled?: boolean;
    createNetworkParams: IPrimeTransferHDWalletCreateNetworkParams;
    indexedAccountNames: IPrimeTransferHDWalletIndexedAccountNames;
  }> {
    const { serviceAccount, serviceNetwork, servicePassword } =
      this.backgroundApi;

    const defaultCustomNetworks = [
      { networkId: 'tron--0x2b6653dc', deriveType: 'default' },
      { networkId: 'sol--101', deriveType: 'default' },
      { networkId: 'evm--1', deriveType: 'default' },
      { networkId: 'btc--0', deriveType: 'default' },
      { networkId: 'btc--0', deriveType: 'BIP44' },
      { networkId: 'btc--0', deriveType: 'BIP84' },
      { networkId: 'btc--0', deriveType: 'BIP86' },
    ];
    const createNetworkParamsMap: {
      [index: number]: {
        index: number;
        customNetworks:
          | {
              networkId: string;
              deriveType: IAccountDeriveTypes;
            }[]
          | undefined;
      };
    } = {};
    const indexedAccountNames: IPrimeTransferHDWalletIndexedAccountNames = {};
    for (const hdAccount of accounts) {
      if (
        taskUUID &&
        this.currentImportTaskUUID &&
        this.currentImportTaskUUID !== taskUUID
      ) {
        // task cancelled
        // throw new PrimeTransferImportCancelledError();
        return {
          isCancelled: true,
          createNetworkParams: [],
          indexedAccountNames: {},
        };
      }

      try {
        const pathIndex = accountUtils.getHDAccountPathIndex({
          account: hdAccount,
        });
        if (!isNil(pathIndex) && hdAccount.name) {
          indexedAccountNames[pathIndex] = hdAccount.name;
        }
        const networkId = await serviceAccount.getAccountCreatedNetworkId({
          account: hdAccount,
        });
        const deriveTypeData = await serviceNetwork.getDeriveTypeByDBAccount({
          networkId: networkId || '',
          account: hdAccount,
        });
        if (
          !isNil(pathIndex) &&
          !isNaN(pathIndex) &&
          networkId &&
          deriveTypeData.deriveType
        ) {
          createNetworkParamsMap[pathIndex] = createNetworkParamsMap[
            pathIndex
          ] || {
            customNetworks: undefined,
          };
          createNetworkParamsMap[pathIndex].index = pathIndex;
          const isIncludedInDefaultCustomNetworks = defaultCustomNetworks.some(
            (item) =>
              item.networkId === networkId &&
              item.deriveType === deriveTypeData.deriveType,
          );
          if (!isIncludedInDefaultCustomNetworks || !skipDefaultNetworks) {
            createNetworkParamsMap[pathIndex].customNetworks =
              createNetworkParamsMap[pathIndex].customNetworks || [];
            if (
              networkId &&
              // ignore lightning network as it requires network verification
              ![presetNetworksMap.lightning.id].includes(networkId)
            ) {
              createNetworkParamsMap[pathIndex].customNetworks.push({
                networkId,
                deriveType: deriveTypeData.deriveType,
              });
            }
          }
        }
      } catch (e) {
        console.error('startImport error', e);
        errorsInfo?.push({
          category: 'createHDWallet.createNetworkParams',
          walletId,
          accountId: hdAccount.id,
          networkInfo: '',
          error: (e as Error)?.message || 'Unknown error',
        });
      }
    }

    const createNetworkParams: IPrimeTransferHDWalletCreateNetworkParams =
      Object.values(createNetworkParamsMap);

    return {
      createNetworkParams,
      indexedAccountNames,
    };
  }

  @backgroundMethod()
  async isInTransferImportOrBackupRestoreFlow(): Promise<boolean> {
    return Boolean(this.currentImportTaskUUID);
  }

  currentImportTaskUUID: string | undefined;

  @backgroundMethod()
  @toastIfError()
  async startImport({
    selectedTransferData,
    includingDefaultNetworks = false,
    password,
  }: {
    selectedTransferData: IPrimeTransferSelectedData;
    includingDefaultNetworks?: boolean;
    password: string;
  }): Promise<{
    success: boolean;
    errorsInfo: {
      category: string;
      walletId: string;
      accountId: string;
      networkInfo: string;
      error: string;
    }[];
  }> {
    const taskUUID = stringUtils.generateUUID();
    this.currentImportTaskUUID = taskUUID;
    // const { watchingAccounts, importedAccounts } = selectedTransferData;
    // const { wallets, ...others } = selectedTransferData;
    // console.log(others);
    const errorsInfo: {
      category: string;
      walletId: string;
      accountId: string;
      networkInfo: string;
      error: string;
    }[] = [];

    const cancelledResult = {
      success: false,
      errorsInfo: [],
    };

    const { serviceAccount, serviceNetwork, servicePassword } =
      this.backgroundApi;

    for (const {
      item: wallet,
      credential,
      credentialDecrypted,
    } of selectedTransferData.wallets) {
      if (this.currentImportTaskUUID !== taskUUID) {
        // task cancelled
        return cancelledResult;
      }

      let newWallet: IDBWallet | undefined;
      try {
        let mnemonicFromRs = '';
        if (credentialDecrypted) {
          mnemonicFromRs = revealEntropyToMnemonic(
            bufferUtils.toBuffer(
              (credentialDecrypted as IBip39RevealableSeed)
                .entropyWithLangPrefixed,
            ),
          );
        } else {
          if (!credential) {
            throw new OneKeyLocalError('Credential is required');
          }
          if (!password) {
            throw new OneKeyLocalError('Password is required');
          }
          mnemonicFromRs = await mnemonicFromEntropy(credential, password);
        }
        if (!mnemonicFromRs) {
          throw new OneKeyLocalError('Mnemonic is required');
        }
        // serviceAccount.createAddressIfNotExists
        const { wallet: newWalletData } = await serviceAccount.createHDWallet({
          mnemonic: await servicePassword.encodeSensitiveText({
            text: mnemonicFromRs,
          }),
          name: wallet.name,
          avatarInfo: wallet.avatarInfo,
          isWalletBackedUp: wallet.backuped,
        });
        newWallet = newWalletData;
      } catch (e) {
        console.error('startImport error', e);
        errorsInfo.push({
          category: 'createHDWallet',
          walletId: wallet.id,
          accountId: '',
          networkInfo: '',
          error: (e as Error)?.message || 'Unknown error',
        });
      }

      let indexedAccountNames: IPrimeTransferHDWalletIndexedAccountNames =
        wallet?.indexedAccountNames ?? {};
      let createNetworkParams: IPrimeTransferHDWalletCreateNetworkParams =
        wallet?.createNetworkParams ?? [];

      if (isEmpty(indexedAccountNames) || isEmpty(createNetworkParams)) {
        let isCancelled: boolean | undefined;
        ({
          createNetworkParams = [],
          indexedAccountNames = {},
          isCancelled,
        } = await this.buildHdWalletAccountsCreateParams({
          walletId: wallet.id,
          accounts: wallet.accounts || [],
          taskUUID,
          errorsInfo,
        }));

        if (isCancelled) {
          // task cancelled
          return cancelledResult;
        }
      }

      for (const { customNetworks, index } of createNetworkParams) {
        if (this.currentImportTaskUUID !== taskUUID) {
          // task cancelled
          return cancelledResult;
        }
        try {
          if (newWallet) {
            const customNetworksUsed = customNetworks?.filter(
              (n) => ![presetNetworksMap.lightning.id].includes(n.networkId),
            );
            await this.backgroundApi.serviceBatchCreateAccount.startBatchCreateAccountsFlowForAllNetwork(
              {
                walletId: newWallet.id,
                fromIndex: index,
                toIndex: index,
                indexedAccountNames,
                excludedIndexes: {},
                saveToDb: true,
                showUIProgress: true, // emit EAppEventBusNames.BatchCreateAccount event
                autoHandleExitError: false,
                customNetworks: customNetworksUsed,
                includingDefaultNetworks,
              },
            );
          }
        } catch (e) {
          console.error('startImport error', e);
          errorsInfo.push({
            category:
              'createHDWallet.startBatchCreateAccountsFlowForAllNetwork',
            walletId: wallet.id,
            accountId: '',
            networkInfo: `${(customNetworks || [])
              .map((n) => `${n.networkId}-${n.deriveType}`)
              .join(', ')}----${index}`,
            error: (e as Error)?.message || 'Unknown error',
          });
        }

        try {
          if (newWallet?.id && indexedAccountNames[index]) {
            const indexedAccountId = accountUtils.buildIndexedAccountId({
              walletId: newWallet.id,
              index,
            });
            await this.backgroundApi.serviceAccount.setAccountName({
              indexedAccountId,
              name: indexedAccountNames[index],
              skipEventEmit: true,
            });
          }
        } catch (e) {
          console.error(e);
        }
      }
      //
    }

    for (const {
      item: importedAccount,
      credential,
      credentialDecrypted,
      tonMnemonicCredential,
      tonMnemonicCredentialDecrypted,
    } of selectedTransferData.importedAccounts) {
      if (this.currentImportTaskUUID !== taskUUID) {
        // task cancelled
        return cancelledResult;
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
          encryptedCredential: credential || '',
          password,
          credentialDecrypted: credentialDecrypted as
            | ICoreImportedCredential
            | undefined,
          networkId,
        });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { addedAccounts } =
        await serviceAccount.restoreImportedAccountByInput({
          importedAccount,
          input: exportedPrivateKey,
          privateKey,
          networkId,
          skipEventEmit: true,
        });
      if (addedAccounts?.length && addedAccounts?.[0]?.id) {
        try {
          if (tonMnemonicCredential || tonMnemonicCredentialDecrypted) {
            let tonRs: IBip39RevealableSeed | undefined =
              tonMnemonicCredentialDecrypted;

            if (!tonRs && tonMnemonicCredential) {
              if (!password) {
                throw new OneKeyLocalError(
                  'startImport error: Password is required',
                );
              }
              tonRs = await decryptRevealableSeed({
                rs: tonMnemonicCredential,
                password,
              });
            }
            if (!tonRs) {
              throw new OneKeyLocalError(
                'startImport error: Ton mnemonic credential is required',
              );
            }
            const { password: localPassword } =
              await this.backgroundApi.servicePassword.promptPasswordVerify({
                reason: EReasonForNeedPassword.Default,
              });
            const tonRsEncrypted = await encryptRevealableSeed({
              rs: tonRs,
              password: localPassword,
            });
            await localDb.saveTonImportedAccountMnemonic({
              accountId: addedAccounts?.[0]?.id,
              rs: tonRsEncrypted,
            });
            // const tonMnemonic2 = await tonMnemonicFromEntropy(
            //   tonMnemonicCredential,
            //   password,
            // );
            // console.log('tonMnemonic2', tonMnemonic2);
          }
        } catch (e) {
          console.error('tonMnemonicCredential error', e);
        }

        await this.updateImportProgress();
        await timerUtils.wait(100); // wait for UI refresh
      }
    }

    for (const {
      item: watchingAccount,
    } of selectedTransferData.watchingAccounts) {
      if (this.currentImportTaskUUID !== taskUUID) {
        // task cancelled
        return cancelledResult;
      }
      const watchingAccountUtxo = watchingAccount;
      let addedAccounts: IDBAccount[] = [];
      const networkId = await serviceAccount.getAccountCreatedNetworkId({
        account: watchingAccount,
      });
      if (!networkId) {
        throw new OneKeyLocalError('NetworkId is required');
      }

      if (watchingAccount?.pub) {
        if (this.currentImportTaskUUID !== taskUUID) {
          // task cancelled
          return cancelledResult;
        }
        const result = await serviceAccount.restoreWatchingAccountByInput({
          watchingAccount,
          input: watchingAccount.pub,
          networkId,
          skipEventEmit: true,
        });
        addedAccounts = [...addedAccounts, ...(result?.addedAccounts || [])];
      }

      if (watchingAccountUtxo?.xpub) {
        if (this.currentImportTaskUUID !== taskUUID) {
          // task cancelled
          return cancelledResult;
        }
        const result = await serviceAccount.restoreWatchingAccountByInput({
          watchingAccount,
          input: watchingAccountUtxo.xpub,
          networkId,
          skipEventEmit: true,
        });
        addedAccounts = [...addedAccounts, ...(result?.addedAccounts || [])];
      }

      if (watchingAccountUtxo?.xpubSegwit) {
        if (this.currentImportTaskUUID !== taskUUID) {
          // task cancelled
          return cancelledResult;
        }
        const result = await serviceAccount.restoreWatchingAccountByInput({
          watchingAccount,
          input: watchingAccountUtxo.xpubSegwit,
          networkId,
          skipEventEmit: true,
        });
        addedAccounts = [...addedAccounts, ...(result?.addedAccounts || [])];
      }

      if (watchingAccount?.address && addedAccounts?.length === 0) {
        if (this.currentImportTaskUUID !== taskUUID) {
          // task cancelled
          return cancelledResult;
        }
        const result = await serviceAccount.restoreWatchingAccountByInput({
          watchingAccount,
          input: watchingAccount.address,
          networkId,
          skipEventEmit: true,
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
      errorsInfo,
    };
  }
}

export default ServicePrimeTransfer;
