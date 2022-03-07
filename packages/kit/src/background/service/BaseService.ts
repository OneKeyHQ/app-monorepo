import { backgroundClass } from '../decorators';
import { IBackgroundApi } from '../IBackgroundApi';

@backgroundClass()
export default class BaseService {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: IBackgroundApi;
}
