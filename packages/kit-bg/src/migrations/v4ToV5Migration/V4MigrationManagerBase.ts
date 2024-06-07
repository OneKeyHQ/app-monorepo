import v4dbHubs from './v4dbHubs';

import type { V4DbHubs } from './v4dbHubs';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

export class V4MigrationManagerBase {
  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: IBackgroundApi;

  v4dbHubs: V4DbHubs = v4dbHubs;

  getMigrationPassword() {
    return this.backgroundApi.serviceV4Migration.getMigrationPassword();
  }
}
