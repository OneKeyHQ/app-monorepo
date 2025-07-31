import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { EPrimeTransferServerType } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IPrimeTransferServerConfig {
  serverType: EPrimeTransferServerType;
  customServerUrl: string | undefined;
}

export interface ISimpleDBPrimeTransfer {
  serverConfig: IPrimeTransferServerConfig;
  // 未来可以在这里添加其他配置
  // otherConfig?: IOtherConfig;
}

export class SimpleDbEntityPrimeTransfer extends SimpleDbEntityBase<ISimpleDBPrimeTransfer> {
  entityName = 'primeTransfer';

  override enableCache = true;

  @backgroundMethod()
  async getRawConfig(): Promise<ISimpleDBPrimeTransfer> {
    const rawData = await this.getRawData();
    return (
      rawData || {
        serverConfig: {
          serverType: EPrimeTransferServerType.OFFICIAL,
          customServerUrl: undefined,
        },
      }
    );
  }

  @backgroundMethod()
  async saveRawConfig(config: ISimpleDBPrimeTransfer) {
    await this.setRawData(() => config);
  }

  @backgroundMethod()
  async getServerConfig(): Promise<IPrimeTransferServerConfig> {
    const config = await this.getRawConfig();
    return config.serverConfig;
  }

  @backgroundMethod()
  async saveServerConfig(serverConfig: IPrimeTransferServerConfig) {
    const config = await this.getRawConfig();
    if (serverConfig.customServerUrl) {
      serverConfig.customServerUrl = serverConfig.customServerUrl?.replace(
        /\/+$/,
        '',
      );
    }
    await this.saveRawConfig({
      ...config,
      serverConfig,
    });
  }

  @backgroundMethod()
  async getServerType(): Promise<EPrimeTransferServerType> {
    const serverConfig = await this.getServerConfig();
    return serverConfig.serverType;
  }

  @backgroundMethod()
  async getCustomServerUrl(): Promise<string | undefined> {
    const serverConfig = await this.getServerConfig();
    return serverConfig.customServerUrl;
  }
}
