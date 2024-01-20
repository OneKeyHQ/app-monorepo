import { getSdkError } from '@walletconnect/utils';
import { debounce } from 'lodash';

import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import { ERootRoutes } from '@onekeyhq/kit/src/routes/enum';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { EDAppConnectionModal } from '@onekeyhq/kit/src/views/DAppConnection/router';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ensureSerializable } from '@onekeyhq/shared/src/utils/assertUtils';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import { getValidUnsignedMessage } from '@onekeyhq/shared/src/utils/messageUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
import type { IConnectionItem } from '@onekeyhq/shared/types/dappConnection';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';
import type { SessionTypes } from '@walletconnect/types';

function buildModalRouteParams({
  screens = [],
  routeParams,
}: {
  screens: string[];
  routeParams: Record<string, any>;
}) {
  const modalParams: { screen: any; params: any } = {
    screen: null,
    params: {},
  };
  let paramsCurrent = modalParams;
  let paramsLast = modalParams;
  screens.forEach((screen) => {
    paramsCurrent.screen = screen;
    paramsCurrent.params = {};
    paramsLast = paramsCurrent;
    paramsCurrent = paramsCurrent.params;
  });
  paramsLast.params = routeParams;
  return modalParams;
}

@backgroundClass()
class ServiceDApp extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async openModal({
    request,
    screens = [],
    params = {},
  }: {
    request: IJsBridgeMessagePayload;
    screens: any[];
    params?: any;
  }) {
    console.log('sampleMethod');
    return new Promise((resolve, reject) => {
      const id = this.backgroundApi.servicePromise.createCallback({
        resolve,
        reject,
      });
      const modalScreens = screens;
      const routeNames = [ERootRoutes.Modal, ...modalScreens];
      const $sourceInfo: IDappSourceInfo = {
        id,
        origin: request.origin || '',
        hostname: uriUtils.getHostNameFromUrl({ url: request.origin || '' }),
        scope: request.scope as any,
        data: request.data as any,
      };

      const routeParams = {
        // stringify required, nested object not working with Ext route linking
        query: JSON.stringify(
          {
            $sourceInfo,
            ...params,
            _$t: Date.now(),
          },
          (key, value) =>
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            typeof value === 'bigint' ? value.toString() : value,
        ),
      };

      const modalParams = buildModalRouteParams({
        screens: routeNames,
        routeParams,
      });

      ensureSerializable(modalParams);

      this._openModalByRouteParamsDebounced({
        routeNames,
        routeParams,
        modalParams,
      });
    });
  }

  _openModalByRouteParams = ({
    modalParams,
    routeParams,
    routeNames,
  }: {
    routeNames: any[];
    routeParams: { query: string };
    modalParams: { screen: any; params: any };
  }) => {
    if (platformEnv.isExtension) {
      // TODO: openStandaloneWindow
      // extUtils.openStandaloneWindow({
      //   routes: routeNames,
      //   params: routeParams,
      // });
      throw new Error('not implemented');
    } else {
      const doOpenModal = () =>
        global.$navigationRef.current?.navigate(
          modalParams.screen,
          modalParams.params,
        );
      console.log('modalParams: ', modalParams);
      // TODO remove timeout after dapp request queue implemented.
      doOpenModal();
    }
  };

  _openModalByRouteParamsDebounced = debounce(
    this._openModalByRouteParams,
    800,
    {
      leading: false,
      trailing: true,
    },
  );

  @backgroundMethod()
  async openConnectionModal(request: IJsBridgeMessagePayload) {
    const result = await this.openModal({
      request,
      screens: [
        EModalRoutes.DAppConnectionModal,
        EDAppConnectionModal.ConnectionModal,
      ],
    });

    return result;
  }

  @backgroundMethod()
  openSignMessageModal({
    request,
    unsignedMessage,
  }: {
    request: IJsBridgeMessagePayload;
    unsignedMessage: IUnsignedMessage;
  }) {
    return this.openModal({
      request,
      screens: [EModalRoutes.WalletConnectModal, 'SignMessageModal'],
      params: {
        unsignedMessage,
      },
    });
  }

  @backgroundMethod()
  async getWalletConnectActiveSessions() {
    await this.backgroundApi.walletConnect.initialize();
    return this.backgroundApi.walletConnect.web3Wallet?.getActiveSessions();
  }

  @backgroundMethod()
  async walletConnectDisconnect(topic: string) {
    return this.backgroundApi.walletConnect.web3Wallet?.disconnectSession({
      topic,
      reason: getSdkError('USER_DISCONNECTED'),
    });
  }

  @backgroundMethod()
  async updateWalletConnectSession(
    topic: string,
    namespaces: SessionTypes.Namespaces,
  ) {
    return this.backgroundApi.walletConnect.web3Wallet?.updateSession({
      topic,
      namespaces,
    });
  }

  @backgroundMethod()
  async signMessage({
    unsignedMessage,
    networkId,
    accountId,
  }: {
    unsignedMessage?: IUnsignedMessage;
    networkId: string;
    accountId: string;
  }) {
    const vault = await vaultFactory.getVault({
      networkId,
      accountId,
    });

    let validUnsignedMessage = unsignedMessage;
    if (unsignedMessage) {
      validUnsignedMessage = getValidUnsignedMessage(unsignedMessage);
    }

    if (!validUnsignedMessage) {
      throw new Error('Invalid unsigned message');
    }

    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerify();
    const [signedMessage] = await vault.keyring.signMessage({
      messages: [validUnsignedMessage],
      password,
    });

    return signedMessage;
  }

  // connection allowance
  @backgroundMethod()
  async saveConnectionSession(data: IConnectionItem) {
    await this.backgroundApi.simpleDb.dappConnection.setRawData(
      ({ rawData }) => {
        if (Array.isArray(rawData?.data)) {
          return {
            data: [...rawData.data, data],
          };
        }
        return {
          data: [data],
        };
      },
    );
  }
}

export default ServiceDApp;
