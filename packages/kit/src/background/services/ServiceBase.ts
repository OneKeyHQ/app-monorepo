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
    // eslint-disable-next-line @typescript-eslint/await-thenable
    const result = await getActiveWalletAccount();
    return Promise.resolve(result);
  }
}
