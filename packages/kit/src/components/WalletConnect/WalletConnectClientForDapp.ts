import {
  ERROR_QRCODE_MODAL_NOT_PROVIDED,
  ERROR_QRCODE_MODAL_USER_CLOSED,
} from '@walletconnect/core/dist/esm/errors';
import { merge } from 'lodash';

import { OneKeyWalletConnectModalCloseError } from '@onekeyhq/engine/src/errors';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { wait } from '../../utils/helper';

import walletConnectUtils from './utils/walletConnectUtils';
import { WalletConnectClientBase } from './WalletConnectClient';
import {
  WALLET_CONNECT_CLIENT_META,
  WALLET_CONNECT_OPEN_WALLET_APP_DELAY,
} from './walletConnectConsts';
import { WalletConnectSessionStorage } from './WalletConnectSessionStorage';

import type { WalletService } from './types';
import type {
  IWalletConnectClientEventRpc,
  IWalletConnectClientOptions,
} from './WalletConnectClient';
import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import type {
  IClientMeta,
  IQRCodeModal,
  ISessionStatus,
  IWalletConnectSession,
} from '@walletconnect/types';

export type ISessionStatusPro = ISessionStatus & {
  peerId?: string | null;
  peerMeta?: IClientMeta | null;
};

const sessionStorage = new WalletConnectSessionStorage({
  storageId: WalletConnectSessionStorage.STORAGE_IDS.DAPP_SIDE,
});

const clientMeta: IClientMeta = WALLET_CONNECT_CLIENT_META;

export class WalletConnectClientForDapp extends WalletConnectClientBase {
  override isWalletSide = false;

  constructor(props?: IWalletConnectClientOptions) {
    super(
      merge(
        {
          sessionStorage,
          clientMeta,
        },
        props,
      ),
    );
  }

  accountId = '';

  async sendTestingRequest() {
    await wait(3500);
    if (!this.connector) {
      return;
    }
    // @ts-ignore
    const request = this.connector._formatRequest({
      // id: this.connector.handshakeId,
      method: 'wc_sessionRequest',
      params: [
        {
          peerId: this.connector.clientId,
          peerMeta: this.connector.clientMeta,
          chainId: null, // opts && opts.chainId ? opts.chainId : null,
        },
      ],
    });
    this.connector.handshakeId = request.id;
    // this.connector.handshakeTopic = uuid();
    // @ts-ignore
    await this.connector._sendSessionRequest(
      request,
      'Session update rejected',
      {
        topic: this.connector.handshakeTopic,
      },
    );

    // this.connector.signMessage()

    // metamask: method=wallet_addEthereumChain
    // walletConnect: method=wallet_updateChain
    await this.connector.updateChain({
      chainId: 56, // polygon 137, bsc 56
      networkId: 137,
      rpcUrl: '',
      nativeCurrency: {
        name: '',
        symbol: '',
      },
    });
  }

  // close self low-level websocket transport only,
  // but do NOT disconnect remote peer connection session
  cleanPrevConnection() {
    this.offAllEvents();
    if (this.connector) {
      this.unregisterEvents(this.connector);
      this.connector.transportClose();
      // @ts-ignore
      this.connector._connected = false;
      // @ts-ignore
      // this.connector._handleSessionDisconnect(); // trigger `disconnect`
      this.connector = undefined;
    }

    this.walletService = undefined;
    this.accountId = '';
  }

  // connectToWallet
  // qrcodeModal= { open(uri: string, cb: any, opts?: any): void; close():void }
  async connect(options: {
    // IWalletConnectOptions
    qrcodeModal: IQRCodeModal;
    session?: IWalletConnectSession | null;
    walletService?: WalletService;
  }): Promise<ISessionStatusPro> {
    this.cleanPrevConnection();

    // try connect last storage saved session
    await this.autoConnectLastSession(options);

    this.addAutoOpenWalletListener();

    // last session connected (just read from localStorage)!
    //    return ISessionStatus
    if (this.connector && this.connector.connected) {
      // TODO not working, no error occurred
      // this.sendTestingRequest();
      return {
        peerId: this.connector.peerId,
        peerMeta: this.connector.peerMeta,
        chainId: this.connector.chainId,
        accounts: this.connector.accounts,
      };
    }

    return this.connectNewSession(options);
  }

  async connectNewSession(options: {
    // IWalletConnectOptions
    qrcodeModal: IQRCodeModal;
  }): Promise<ISessionStatusPro> {
    if (!options.qrcodeModal) {
      throw new Error(ERROR_QRCODE_MODAL_NOT_PROVIDED);
    }

    this.cleanPrevConnection();

    // ** show new qrcode modal: createSession()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const connector = await this.createConnector(options, {
      shouldDisconnectStorageSession: false,
    });

    this.addAutoOpenWalletListener();

    // node_modules/@walletconnect/core/dist/esm/index.js
    return new Promise((resolve, reject) => {
      if (!this.connector) {
        // eslint-disable-next-line no-promise-executor-return
        return reject(
          new Error('WalletConnect Error: connector not ready yet.'),
        );
      }
      // node_modules/@walletconnect/react-native-dapp/dist/providers/WalletConnectProvider.js
      this.connector.on(this.EVENT_NAMES.modal_closed, () =>
        reject(
          new OneKeyWalletConnectModalCloseError(
            ERROR_QRCODE_MODAL_USER_CLOSED,
          ),
        ),
      );
      this.connector.on(
        this.EVENT_NAMES.connect,
        (error, payload: IJsonRpcRequest) => {
          if (error) {
            return reject(error);
          }
          resolve((payload?.params as ISessionStatus[])?.[0]);
        },
      );
      this.connector.on(
        this.EVENT_NAMES.disconnect,
        (error, payload: IJsonRpcRequest) => {
          const errorMsg =
            error?.message ||
            (payload?.params as Array<{ message?: string }> | undefined)?.[0]
              ?.message ||
            'Session Disconnected';
          reject(new Error(errorMsg));
        },
      );
    });
  }

  // on `call_request_sent`
  _autoOpenWalletAppListener = async (options: {
    error: Error | null;
    payload: IJsonRpcRequest;
  }) => {
    const { payload } = options;
    // nextConnector.on(ConnectorEvents.CALL_REQUEST_SENT
    // Linking.openURL('wc:');

    if (payload && this.connector?.peerMeta && this.walletService) {
      // add some delay to make sure sendTransaction message has been sent to wallet app by websocket
      await wait(WALLET_CONNECT_OPEN_WALLET_APP_DELAY);
      await walletConnectUtils.dappOpenWalletApp({
        // peerMeta: this.connector?.peerMeta,
        walletService: this.walletService,
      });
    }
  };

  saveAccountSession = async ({
    accountId,
    session,
  }: {
    accountId: string;
    session: IWalletConnectSession;
  }) => {
    const { serviceWalletConnect } = backgroundApiProxy;
    if (!this.walletService) {
      this.walletService =
        await serviceWalletConnect.findWalletServiceBySession({ session });
    }
    debugLogger.walletConnect.info(
      'saveExternalAccountSession',
      accountId,
      session.peerMeta,
      this.walletService?.homepage,
    );
    await serviceWalletConnect.saveWalletConnectSessionOfAccount({
      accountId,
      session,
      walletService: this.walletService,
    });
  };

  handleAccountSessionUpdate = async (
    eventInfo: IWalletConnectClientEventRpc,
  ) => {
    const { connector } = eventInfo;
    // const address = connector?.getAccountAddress() || '';
    if (this.accountId && connector?.session) {
      // TODO error, update other account session
      await this.saveAccountSession({
        accountId: this.accountId,
        session: connector?.session, // session may contain changed accounts and chainId
      });
    }
  };

  offAllEvents() {
    this._offAccountSessionChanged();
    this._offAutoOpenWalletApp();
  }

  _offAccountSessionChanged() {
    this.off(this.EVENT_NAMES.connect, this.handleAccountSessionUpdate);
    this.off(this.EVENT_NAMES.session_update, this.handleAccountSessionUpdate);
    this.off(this.EVENT_NAMES.disconnect, this.handleAccountSessionUpdate);
  }

  _offAutoOpenWalletApp() {
    this.off(
      this.EVENT_NAMES.call_request_sent,
      this._autoOpenWalletAppListener,
    );
  }

  addAutoOpenWalletListener() {
    if (!this.connector) {
      return;
    }

    this._offAutoOpenWalletApp();
    this.on(
      this.EVENT_NAMES.call_request_sent,
      this._autoOpenWalletAppListener,
    );
  }

  watchAccountSessionChanged({ accountId }: { accountId: string }) {
    debugLogger.walletConnect.info('watchAccountSessionChanged', accountId);
    this.accountId = accountId;

    this._offAccountSessionChanged();
    this.on(this.EVENT_NAMES.connect, this.handleAccountSessionUpdate);
    this.on(this.EVENT_NAMES.session_update, this.handleAccountSessionUpdate);
    this.on(this.EVENT_NAMES.disconnect, this.handleAccountSessionUpdate);
  }
}
