/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */

// TODO: remove components from background.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { Toast } from '@onekeyhq/components';
import { INTERNAL_METHOD_PREFIX } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  getBackgroundServiceApi,
  throwMethodNotFound,
} from '@onekeyhq/shared/src/background/backgroundUtils';
import { globalErrorHandler } from '@onekeyhq/shared/src/errors/globalErrorHandler';
import {
  type EAppEventBusNames,
  EEventBusBroadcastMethodNames,
  type IAppEventBusPayload,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ensurePromiseObject,
  ensureSerializable,
} from '@onekeyhq/shared/src/utils/assertUtils';

import { jotaiBgSync } from '../states/jotai/jotaiBgSync';

import { BackgroundServiceProxyBase } from './BackgroundServiceProxyBase';

import type {
  IBackgroundApi,
  IBackgroundApiBridge,
  IBackgroundApiInternalCallMessage,
} from './IBackgroundApi';
import type ProviderApiBase from '../providers/ProviderApiBase';
import type { EAtomNames } from '../states/jotai/atomNames';
import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type {
  IInjectedProviderNames,
  IInjectedProviderNamesStrings,
  IJsBridgeMessagePayload,
  IJsonRpcResponse,
} from '@onekeyfe/cross-inpage-provider-types';
import type { JsBridgeExtBackground } from '@onekeyfe/extension-bridge-hosted';

export class BackgroundApiProxyBase
  extends BackgroundServiceProxyBase
  implements IBackgroundApiBridge
{
  override serviceNameSpace = '';

  constructor({
    backgroundApi,
  }: {
    backgroundApi?: any;
  } = {}) {
    super();
    if (backgroundApi) {
      this.backgroundApi = backgroundApi as IBackgroundApi;
    }
    jotaiBgSync.setBackgroundApi(this as any);
    void jotaiBgSync.jotaiInitFromUi();
    appEventBus.registerBroadcastMethods(
      EEventBusBroadcastMethodNames.uiToBg,
      async (type, payload) => {
        await this.emitEvent(type as any, payload);
      },
    );
    globalErrorHandler.addListener((error) => {
      // TODO log error to file if developer mode on
      if (error && error.autoToast) {
        Toast.error({
          title: error?.message ?? 'Error',
        });
      }
    });
  }

  async getAtomStates(): Promise<{ states: Record<EAtomNames, any> }> {
    return this.callBackground('getAtomStates');
  }

  async setAtomValue(atomName: EAtomNames, value: any) {
    // await this.allAtoms;
    return this.callBackground('setAtomValue', atomName, value);
  }

  async emitEvent<T extends EAppEventBusNames>(
    type: T,
    payload: IAppEventBusPayload[T],
  ): Promise<boolean> {
    return this.callBackground('emitEvent', type, payload);
  }

  bridge = {} as JsBridgeBase;

  bridgeExtBg = {} as JsBridgeExtBackground;

  providers = {} as Record<IInjectedProviderNames, ProviderApiBase>;

  sendForProvider(providerName: IInjectedProviderNamesStrings): any {
    return this.backgroundApi?.sendForProvider(providerName);
  }

  connectBridge(bridge: JsBridgeBase) {
    this.backgroundApi?.connectBridge(bridge);
  }

  connectWebEmbedBridge(bridge: JsBridgeBase) {
    this.backgroundApi?.connectWebEmbedBridge(bridge);
  }

  bridgeReceiveHandler = (
    payload: IJsBridgeMessagePayload,
  ): any | Promise<any> => this.backgroundApi?.bridgeReceiveHandler(payload);

  // init in NON-Ext UI env
  readonly backgroundApi?: IBackgroundApi | null = null;

  async callBackgroundMethod(
    sync = true,
    method: string,
    ...params: Array<any>
  ): Promise<any> {
    ensureSerializable(params);
    let [serviceName, methodName] = method.split('.');
    if (!methodName) {
      methodName = serviceName;
      serviceName = '';
    }
    if (serviceName === 'ROOT') {
      serviceName = '';
    }
    let backgroundMethodName = `${INTERNAL_METHOD_PREFIX}${methodName}`;
    if (platformEnv.isExtension && platformEnv.isExtensionUi) {
      const data: IBackgroundApiInternalCallMessage = {
        service: serviceName,
        method: backgroundMethodName,
        params,
      };
      if (sync) {
        // call without Promise result
        window.extJsBridgeUiToBg.requestSync({
          data,
        });
      } else {
        return window.extJsBridgeUiToBg.request({
          data,
        });
      }
    } else {
      // some third party modules call native object methods, so we should NOT rename method
      //    react-native/node_modules/pretty-format
      //    expo/node_modules/pretty-format
      const IGNORE_METHODS = ['hasOwnProperty', 'toJSON'];
      if (platformEnv.isNative && IGNORE_METHODS.includes(methodName)) {
        backgroundMethodName = methodName;
      }
      if (!this.backgroundApi) {
        throw new Error('backgroundApi not found in non-ext env');
      }

      const serviceApi = getBackgroundServiceApi({
        serviceName,
        backgroundApi: this.backgroundApi,
      });

      if (serviceApi[backgroundMethodName]) {
        const resultPromise = serviceApi[backgroundMethodName].call(
          serviceApi,
          ...params,
        );
        ensurePromiseObject(resultPromise, {
          serviceName,
          methodName,
        });
        let result = await resultPromise;
        result = ensureSerializable(result, true);
        return result;
      }
      if (!IGNORE_METHODS.includes(backgroundMethodName)) {
        throwMethodNotFound(serviceName, backgroundMethodName);
      }
    }
  }

  callBackgroundSync(method: string, ...params: Array<any>): any {
    void this.callBackgroundMethod(true, method, ...params);
  }

  callBackground(method: string, ...params: Array<any>): any {
    return this.callBackgroundMethod(false, method, ...params);
  }

  handleProviderMethods(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    payload: IJsBridgeMessagePayload,
  ): Promise<IJsonRpcResponse<any>> {
    throw new Error('handleProviderMethods in Proxy is mocked');
  }
}
