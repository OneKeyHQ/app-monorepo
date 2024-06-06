import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IDefaultWalletSettingsDB {
  isDefaultWallet: boolean;
  excludeDappMap: Record<string, boolean>;
}

export interface IDefaultWalletSettingsWithLogo {
  isDefaultWallet: boolean;
  excludedDappListWithLogo: {
    origin: string;
    logo: string;
  }[];
}

export class SimpleDbEntityDefaultWalletSettings extends SimpleDbEntityBase<IDefaultWalletSettingsDB> {
  entityName = 'defaultWalletSettings';

  override enableCache = false;

  async setIsDefaultWallet(isDefaultWallet: boolean) {
    return this.setRawData(({ rawData }) => {
      if (!rawData) {
        return {
          isDefaultWallet,
          excludeDappMap: {},
        };
      }
      return {
        ...rawData,
        isDefaultWallet,
      };
    });
  }

  async addExcludeDapp(dappOrigin: string) {
    return this.setRawData(({ rawData }) => {
      if (!rawData) {
        return {
          isDefaultWallet: true,
          excludeDappMap: {
            [dappOrigin]: true,
          },
        };
      }
      return {
        ...rawData,
        excludeDappMap: {
          ...rawData.excludeDappMap,
          [dappOrigin]: true,
        },
      };
    });
  }

  async removeExcludeDapp(dappOrigin: string) {
    return this.setRawData(({ rawData }) => {
      if (!rawData) {
        return {
          isDefaultWallet: true,
          excludeDappMap: {},
        };
      }
      const excludeDappMap = { ...rawData.excludeDappMap };
      delete excludeDappMap[dappOrigin];
      return {
        ...rawData,
        excludeDappMap,
      };
    });
  }
}
