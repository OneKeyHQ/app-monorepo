import TonWeb from 'tonweb';

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

export class Provider extends TonWeb.HttpProvider {
  backgroundApi: IBackgroundApi;

  constructor(backgroundApi: IBackgroundApi) {
    super();
    this.backgroundApi = backgroundApi;
  }

  override send(method: string, params: any): Promise<Response> {
    console.log(method, params);
    return super.send(method, params);
  }
}
