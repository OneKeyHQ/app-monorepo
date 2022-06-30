import { getActiveWalletAccount } from '../../hooks/redux';
import { backgroundClass, backgroundMethod } from '../decorators';
import { IBackgroundApi } from '../IBackgroundApi';

export type IServiceBaseProps = {
  backgroundApi: any;
};

@backgroundClass()
export default class ServiceBase {
  constructor({ backgroundApi }: IServiceBaseProps) {
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: IBackgroundApi;

  @backgroundMethod()
  async getActiveWalletAccount() {
    return Promise.resolve(getActiveWalletAccount());
  }
}
