/* eslint-disable max-classes-per-file */

import { devOnlyData } from '../../../../utils/devModeUtils';
import debugLogger from '../../../debugLogger';
import { FlowLoggerScopeBase } from '../../base/FlowLoggerScopeBase';

import type { LoggerEntity } from '../../../debugLogger';
import type { IInjectedProviderNamesStrings } from '@onekeyfe/cross-inpage-provider-types';

class SceneApiCalls {
  // log all background api call
  callBackgroundApi({
    service,
    method,
    params,
  }: {
    service: string;
    method: string;
    params: any;
  }) {
    return [service, method, devOnlyData(params)] as unknown;
  }

  // log all dapp provider api call
  callProviderApi({
    origin,
    scope,
    method,
    params,
  }: {
    origin?: string;
    scope?: IInjectedProviderNamesStrings;
    method?: string;
    params: any;
  }) {
    return [origin, scope, method, devOnlyData(params)] as unknown;
  }

  callVaultApi({
    networkImpl,
    method,
    params,
  }: {
    networkImpl?: string;
    method?: string;
    params: any;
  }) {
    return [networkImpl, method, devOnlyData(params)] as unknown;
  }

  callKeyringApi({
    keyring,
    method,
    params,
  }: {
    keyring?: string;
    method?: string;
    params: any;
  }) {
    return [keyring, method, devOnlyData(params)] as unknown;
  }

  callCoreApi({
    scopeName,
    apiName,
    method,
    params,
  }: {
    scopeName: string;
    apiName: string;
    method: string;
    params: any;
  }) {
    return [scopeName, apiName, method, devOnlyData(params)] as unknown;
  }
}

class SceneInit {
  loadHtml({ name }: { name: string }) {
    return [name, { name }, true, Date.now()];
  }

  extInstalled() {
    return 'Extension event: first installed';
  }

  extUpdated({
    fromVersion,
    toVersion,
  }: {
    fromVersion: string;
    toVersion: string;
  }) {
    return `Extension event: Updated from ${
      fromVersion || ''
    } to ${toVersion}!`;
  }
}

export default class extends FlowLoggerScopeBase {
  protected override scopeName = 'app';

  protected override logger: LoggerEntity = debugLogger.flowApp;

  // init, bootstrap, installed, updated,
  init: SceneInit = this._createSceneProxy('init') as SceneInit;

  private _init = () => SceneInit;

  apiCalls: SceneApiCalls = this._createSceneProxy('apiCalls') as SceneApiCalls;

  private _apiCalls = () => SceneApiCalls;
}
