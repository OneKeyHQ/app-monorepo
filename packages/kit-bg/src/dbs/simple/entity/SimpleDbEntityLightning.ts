import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface ILightningDB {
  tokens: Record<string, string>;
}

export class SimpleDbEntityLightning extends SimpleDbEntityBase<ILightningDB> {
  entityName = 'lightning';

  override enableCache = false;

  async updateCredential({
    address,
    credential,
  }: {
    address: string;
    credential: string;
  }) {
    await this.setRawData(({ rawData }) => {
      if (!rawData || typeof rawData !== 'object' || !rawData.tokens) {
        return {
          tokens: {
            [address]: credential,
          },
        };
      }
      return {
        ...rawData,
        tokens: {
          ...rawData.tokens,
          [address]: credential,
        },
      };
    });
  }

  async getCredential({ address }: { address: string }) {
    const rawData = await this.getRawData();
    if (!rawData || typeof rawData !== 'object' || !rawData.tokens) {
      return undefined;
    }
    return rawData.tokens[address];
  }
}
