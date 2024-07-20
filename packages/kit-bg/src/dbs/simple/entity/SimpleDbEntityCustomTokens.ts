import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ICustomTokenDBStruct {
  hiddenTokens: Record<string, IAccountToken>;
  customTokens: Record<string, IAccountToken>;
}

export class SimpleDbEntityCustomTokens extends SimpleDbEntityBase<ICustomTokenDBStruct> {
  entityName = 'customTokens';

  override enableCache = false;

  private generateKey(
    networkId: string,
    accountId: string,
    address: string,
  ): string {
    return `${networkId}:${accountId}:${address}`;
  }

  private generateKeyPrefix(networkId: string, accountId: string): string {
    return `${networkId}:${accountId}:`;
  }

  @backgroundMethod()
  async addCustomToken({ token }: { token: IAccountToken }) {
    await this.setRawData(({ rawData }) => {
      const data: ICustomTokenDBStruct = {
        hiddenTokens: { ...(rawData?.hiddenTokens || {}) },
        customTokens: { ...(rawData?.customTokens || {}) },
      };
      if (!token.accountId || !token.networkId) {
        return data;
      }
      const key = this.generateKey(
        token.networkId,
        token.accountId,
        token.address,
      );

      data.customTokens[key] = token;
      return data;
    });
  }

  @backgroundMethod()
  async hideToken({ token }: { token: IAccountToken }) {
    await this.setRawData(({ rawData }) => {
      const data: ICustomTokenDBStruct = {
        hiddenTokens: { ...(rawData?.hiddenTokens || {}) },
        customTokens: { ...(rawData?.customTokens || {}) },
      };

      if (!token.accountId || !token.networkId) {
        return data;
      }

      const key = this.generateKey(
        token.networkId,
        token.accountId,
        token.address,
      );

      // Remove from customTokens if present
      if (data.customTokens[key]) {
        delete data.customTokens[key];
      }

      // Add to hiddenTokens
      data.hiddenTokens[key] = token;

      return data;
    });
  }

  @backgroundMethod()
  async getHiddenTokens({
    accountId,
    networkId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<IAccountToken[]> {
    const rawData = await this.getRawData();
    const prefix = this.generateKeyPrefix(networkId, accountId);

    return Object.entries(rawData?.hiddenTokens || {})
      .filter(([key]) => key.startsWith(prefix))
      .map(([, token]) => token);
  }

  @backgroundMethod()
  async getCustomTokens({
    accountId,
    networkId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<IAccountToken[]> {
    const rawData = await this.getRawData();
    const prefix = this.generateKeyPrefix(networkId, accountId);

    return Object.entries(rawData?.customTokens || {})
      .filter(([key]) => key.startsWith(prefix))
      .map(([, token]) => token);
  }
}
