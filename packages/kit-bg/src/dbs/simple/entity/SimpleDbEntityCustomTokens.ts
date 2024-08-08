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
    return `${networkId}__${accountId}__${address}`;
  }

  private generateKeyPrefix(networkId: string, accountId: string): string {
    return `${networkId}__${accountId}__`;
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

      // If the token exists in hiddenTokens, remove it first
      if (data.hiddenTokens[key]) {
        delete data.hiddenTokens[key];
      }
      data.customTokens[key] = token;
      return data;
    });
  }

  @backgroundMethod()
  async addCustomTokensBatch({ tokens }: { tokens: IAccountToken[] }) {
    await this.setRawData(({ rawData }) => {
      const data: ICustomTokenDBStruct = {
        hiddenTokens: { ...(rawData?.hiddenTokens || {}) },
        customTokens: { ...(rawData?.customTokens || {}) },
      };

      const validTokens = tokens.filter(
        (token) => token.accountId && token.networkId,
      );

      validTokens.forEach((token) => {
        const key = this.generateKey(
          token.networkId ?? '',
          token.accountId ?? '',
          token.address,
        );

        // Remove from hiddenTokens if present
        delete data.hiddenTokens[key];

        // Add to customTokens
        data.customTokens[key] = token;
      });

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
    allNetworkAccountId,
  }: {
    networkId: string;
    accountId: string;
    allNetworkAccountId?: string;
  }): Promise<IAccountToken[]> {
    const rawData = await this.getRawData();

    if (allNetworkAccountId) {
      return Object.values(rawData?.hiddenTokens || {}).filter(
        (token) => token.allNetworkAccountId === allNetworkAccountId,
      );
    }

    const prefix = this.generateKeyPrefix(networkId, accountId);

    return Object.entries(rawData?.hiddenTokens || {})
      .filter(([key]) => key.startsWith(prefix))
      .map(([, token]) => token);
  }

  @backgroundMethod()
  async getCustomTokens({
    accountId,
    networkId,
    allNetworkAccountId,
  }: {
    networkId: string;
    accountId: string;
    allNetworkAccountId?: string;
  }): Promise<IAccountToken[]> {
    const rawData = await this.getRawData();

    if (allNetworkAccountId) {
      return Object.values(rawData?.customTokens || {}).filter(
        (token) => token.allNetworkAccountId === allNetworkAccountId,
      );
    }

    const prefix = this.generateKeyPrefix(networkId, accountId);

    return Object.entries(rawData?.customTokens || {})
      .filter(([key]) => key.startsWith(prefix))
      .map(([, token]) => token);
  }
}
