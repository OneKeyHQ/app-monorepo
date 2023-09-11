/* eslint-disable max-classes-per-file */

import debugLogger from '../../../debugLogger';
import { FlowLoggerScopeBase } from '../../base/FlowLoggerScopeBase';

import type { LoggerEntity } from '../../../debugLogger';
import type { IInjectedProviderNamesStrings } from '@onekeyfe/cross-inpage-provider-types';

class SceneApiCalls {
  // log all background api call
  callBackgroundApi({ service, method }: { service: string; method: string }) {
    return [service, method];
  }

  // log all provider api call
  callProviderApi({
    scope,
    method,
    origin,
  }: {
    scope?: IInjectedProviderNamesStrings;
    method?: string;
    origin?: string;
  }) {
    // TODO return { output: '', outputOnlyDev: ''}
    return [scope, method, origin];
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

  // wallet
  // network
  // account(accountSelector, address)
  // notification(socket)
  // migration
  // backup
  // upgrade
  // onboarding
  // secret(password)
  // navigation(routes,deeplink,linking,url)
  // webview(webembed api)
  // store(redux,storage,cache,db,jotai)
}
