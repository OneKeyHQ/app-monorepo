import { IBackgroundApi } from '../IBackgroundApi';

export default class BaseService {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: IBackgroundApi;
}
