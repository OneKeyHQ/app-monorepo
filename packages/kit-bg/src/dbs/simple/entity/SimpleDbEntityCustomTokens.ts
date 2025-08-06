import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { NATIVE_TOKEN_MOCK_ADDRESS } from '@onekeyhq/shared/src/consts/tokenConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  ECustomTokenStatus,
  type IAccountToken,
  type IAccountTokenWithAccountId,
  type ICloudSyncCustomToken,
  type ICloudSyncCustomTokenInfo,
} from '@onekeyhq/shared/types/token';

// ICustomTokenItem
import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

interface ICustomTokenDBStructV1Legacy {
  hiddenTokens: Record<string, IAccountToken>;
  customTokens: Record<string, IAccountToken>;
}

export interface ICustomTokenDBStruct {
  $legacyData?: ICustomTokenDBStructV1Legacy; // dev only
  tokens: {
    [tokenKey: string]: ICloudSyncCustomTokenInfo;
  };
  hiddenMap: {
    [accountKey: string]: {
      [tokenKey: string]: string; // value is token symbol
    };
  };
  customMap: {
    [accountKey: string]: {
      [tokenKey: string]: string;
    };
  };
}

const AccountKeySplitter = '__account:';
const TokenKeySplitter = '__token:';

export class SimpleDbEntityCustomTokens extends SimpleDbEntityBase<ICustomTokenDBStruct> {
  entityName = 'customTokens';

  override enableCache = false;

  @backgroundMethod()
  override async getRawData(): Promise<
    ICustomTokenDBStruct | null | undefined
  > {
    const rawData = await super.getRawData();
    if ((await this.isV1LegacyData(rawData)) && rawData) {
      return this.convertFromV1LegacyData(
        rawData as unknown as ICustomTokenDBStructV1Legacy,
      );
    }
    return (
      rawData ?? {
        tokens: {},
        hiddenMap: {},
        customMap: {},
      }
    );
  }

  async isV1LegacyData(
    rawData?: ICustomTokenDBStruct | null | undefined,
  ): Promise<boolean> {
    // eslint-disable-next-line no-param-reassign
    rawData = rawData || (await super.getRawData());
    const rawDataV1Legacy =
      rawData as unknown as ICustomTokenDBStructV1Legacy | null;
    if (
      (rawDataV1Legacy?.customTokens || rawDataV1Legacy?.hiddenTokens) &&
      !rawData?.tokens
    ) {
      return true;
    }
    return false;
  }

  async convertFromV1LegacyData(
    legacyData: ICustomTokenDBStructV1Legacy,
  ): Promise<ICustomTokenDBStruct> {
    const hiddenTokens = Object.values(legacyData.hiddenTokens);
    const customTokens = Object.values(legacyData.customTokens);

    const data: ICustomTokenDBStruct = {
      tokens: {},
      hiddenMap: {},
      customMap: {},
      $legacyData: platformEnv.isDev ? legacyData : undefined,
    };

    await Promise.all(
      [...hiddenTokens].map(async (token) => {
        const accountXpubOrAddress =
          await appGlobals.$backgroundApiProxy.serviceAccount.getAccountXpubOrAddress(
            {
              networkId: token.networkId ?? '',
              accountId: token.accountId ?? '',
            },
          );
        return this.setTokenToRawData({
          rawData: data,
          token: {
            ...token,
            accountXpubOrAddress: accountXpubOrAddress ?? '',
            tokenStatus: ECustomTokenStatus.Hidden,
          },
        });
      }),
    );

    await Promise.all(
      [...customTokens].map(async (token) => {
        const accountXpubOrAddress =
          await appGlobals.$backgroundApiProxy.serviceAccount.getAccountXpubOrAddress(
            {
              networkId: token.networkId ?? '',
              accountId: token.accountId ?? '',
            },
          );
        return this.setTokenToRawData({
          rawData: data,
          token: {
            ...token,
            accountXpubOrAddress: accountXpubOrAddress ?? '',
            tokenStatus: ECustomTokenStatus.Custom,
          },
        });
      }),
    );

    return data;
  }

  async migrateFromV1LegacyData() {
    if (await this.isV1LegacyData()) {
      console.log('migrateCustomTokens from v1 legacy data');
      await this.setRawData((rawData) => {
        // the param rawData is automatically converted to ICustomTokenDBStruct by getRawData()
        if (rawData) {
          return rawData;
        }
        return {
          tokens: {},
          hiddenMap: {},
          customMap: {},
        };
      });
    } else {
      console.log(
        'migrateCustomTokens from v1 legacy data skip: no legacy data',
      );
    }
  }

  async setTokenToRawData({
    rawData,
    token,
  }: {
    rawData: ICustomTokenDBStruct;
    token: ICloudSyncCustomToken;
  }) {
    const { tokens, hiddenMap, customMap } = rawData;
    const tokenKey = this.buildTokenKey(token);
    if (!tokenKey) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { accountXpubOrAddress, ...rest } = token;
    tokens[tokenKey] = rest;
    const accountKey = await this.buildAccountKey({
      networkId: token.networkId ?? '',
      accountXpubOrAddress: token.accountXpubOrAddress ?? '',
    });
    if (!accountKey) {
      return;
    }

    if (token.tokenStatus === ECustomTokenStatus.Hidden) {
      // remove custom token if it exists
      try {
        if (customMap?.[accountKey]?.[tokenKey]) {
          delete customMap[accountKey][tokenKey];
        }
      } catch (error) {
        console.error(error);
      }
      hiddenMap[accountKey] = {
        ...(hiddenMap[accountKey] || {}),
        [tokenKey]: token.symbol,
      };
    }

    if (token.tokenStatus === ECustomTokenStatus.Custom) {
      // remove hidden token if it exists
      try {
        if (hiddenMap?.[accountKey]?.[tokenKey]) {
          delete hiddenMap[accountKey][tokenKey];
        }
      } catch (error) {
        console.error(error);
      }
      customMap[accountKey] = {
        ...(customMap[accountKey] || {}),
        [tokenKey]: token.symbol,
      };
    }
  }

  getXpubOrAddressFromAccountKey(accountKey: string): string | null {
    const [, accountXpubOrAddress] = accountKey.split(AccountKeySplitter);
    return accountXpubOrAddress;
  }

  async buildAccountKey(params: {
    networkId: string | undefined;
    accountXpubOrAddress: string | undefined;
  }): Promise<string | null> {
    const { networkId, accountXpubOrAddress: accountXpubOrAddressInToken } =
      params;

    const keyBuilder = (info: {
      networkId: string;
      accountXpubOrAddress: string;
    }) => {
      if (!info.networkId) {
        return null;
      }
      if (!info.accountXpubOrAddress) {
        return null;
      }
      return `${info.networkId}${AccountKeySplitter}${info.accountXpubOrAddress}`;
    };

    if (!networkId || !accountXpubOrAddressInToken) {
      return null;
    }
    const accountXpubOrAddress: string | null = accountXpubOrAddressInToken;
    if (!accountXpubOrAddress) {
      return null;
    }
    return keyBuilder({
      networkId,
      accountXpubOrAddress,
    });
  }

  buildTokenKey(token: ICloudSyncCustomToken): string | null {
    if (!token.networkId) {
      return null;
    }
    let tokenAddress = token.address?.toLowerCase();
    if (!tokenAddress && token.isNative) {
      tokenAddress = NATIVE_TOKEN_MOCK_ADDRESS;
    }
    if (!tokenAddress) {
      return null;
    }
    return `${token.networkId}${TokenKeySplitter}${tokenAddress}`;
  }

  @backgroundMethod()
  async addCustomToken({ token }: { token: ICloudSyncCustomToken }) {
    await this.addCustomTokensBatch({
      tokens: [token],
    });
  }

  @backgroundMethod()
  async addCustomTokensBatch({ tokens }: { tokens: ICloudSyncCustomToken[] }) {
    await this.setRawData(async (rawData) => {
      const data: ICustomTokenDBStruct = {
        tokens: { ...(rawData?.tokens || {}) },
        hiddenMap: { ...(rawData?.hiddenMap || {}) },
        customMap: { ...(rawData?.customMap || {}) },
      };

      const validTokens = tokens.filter(
        (token) => token.accountXpubOrAddress && token.networkId,
      );

      await Promise.all(
        validTokens.map((token) =>
          this.setTokenToRawData({
            rawData: data,
            token: {
              ...token,
              tokenStatus: ECustomTokenStatus.Custom,
            },
          }),
        ),
      );

      return data;
    });
  }

  @backgroundMethod()
  async hideToken({ token }: { token: ICloudSyncCustomToken }) {
    await this.setRawData(async (rawData) => {
      const data: ICustomTokenDBStruct = {
        tokens: { ...(rawData?.tokens || {}) },
        hiddenMap: { ...(rawData?.hiddenMap || {}) },
        customMap: { ...(rawData?.customMap || {}) },
      };

      if (!token.accountXpubOrAddress || !token.networkId) {
        return data;
      }

      await this.setTokenToRawData({
        rawData: data,
        token: {
          ...token,
          tokenStatus: ECustomTokenStatus.Hidden,
        },
      });

      return data;
    });
  }

  async getTokensByStatus({
    customTokensRawData,
    accountXpubOrAddress,
    networkId,
    tokenStatusMap,
  }: {
    customTokensRawData?: ICustomTokenDBStruct;
    networkId: string;
    accountXpubOrAddress: string | null;
    tokenStatusMap: 'customMap' | 'hiddenMap';
  }): Promise<ICloudSyncCustomToken[]> {
    // console.log('customTokens.getCategorizedTokens >>> ', {
    //   accountXpubOrAddress,
    //   networkId,
    //   tokenCategory,
    // });
    if (!accountXpubOrAddress || !networkId) {
      return [];
    }
    if (networkUtils.isAllNetwork({ networkId })) {
      // allNetwork custom tokens always return empty array, use loop to get all tokens
      return [];
    }

    if (
      tokenStatusMap === 'hiddenMap' &&
      accountXpubOrAddress === '0x2304e629180657B407F83F9BC7bE26A4BdF00b03'
    ) {
      debugger;
    }

    const tokenStatus =
      tokenStatusMap === 'hiddenMap'
        ? ECustomTokenStatus.Hidden
        : ECustomTokenStatus.Custom;

    const rawData = customTokensRawData || (await this.getRawData());

    const accountKey = await this.buildAccountKey({
      networkId,
      accountXpubOrAddress,
    });
    if (!accountKey) {
      return [];
    }
    const tokenKeys = Object.keys(
      rawData?.[tokenStatusMap]?.[accountKey] || {},
    );

    return tokenKeys
      .map((tokenKey) => {
        const token = rawData?.tokens?.[tokenKey];
        if (
          token &&
          tokenKey ===
            this.buildTokenKey({ ...token, accountXpubOrAddress, tokenStatus })
        ) {
          return token;
        }
        return null;
      })
      .filter(Boolean);
  }

  @backgroundMethod()
  async getHiddenTokens({
    accountXpubOrAddress,
    customTokensRawData,
    accountId,
    networkId,
  }: {
    accountXpubOrAddress?: string | null;
    customTokensRawData?: ICustomTokenDBStruct;
    networkId: string;
    accountId: string;
  }): Promise<IAccountTokenWithAccountId[]> {
    if (!accountXpubOrAddress) {
      // eslint-disable-next-line no-param-reassign
      accountXpubOrAddress =
        await appGlobals.$backgroundApiProxy.serviceAccount.getAccountXpubOrAddress(
          {
            networkId,
            accountId,
          },
        );
    }
    const tokens = await this.getTokensByStatus({
      customTokensRawData,
      accountXpubOrAddress,
      networkId,
      tokenStatusMap: 'hiddenMap',
    });
    return tokens.map((token) => ({
      ...token,
      accountId,
    }));
  }

  @backgroundMethod()
  async getCustomTokens({
    accountXpubOrAddress,
    customTokensRawData,
    accountId,
    networkId,
  }: {
    accountXpubOrAddress?: string | null;
    customTokensRawData?: ICustomTokenDBStruct;
    networkId: string;
    accountId: string;
  }): Promise<IAccountTokenWithAccountId[]> {
    if (!accountXpubOrAddress) {
      // eslint-disable-next-line no-param-reassign
      accountXpubOrAddress =
        await appGlobals.$backgroundApiProxy.serviceAccount.getAccountXpubOrAddress(
          {
            networkId,
            accountId,
          },
        );
    }
    const tokens = await this.getTokensByStatus({
      customTokensRawData,
      accountXpubOrAddress,
      networkId,
      tokenStatusMap: 'customMap',
    });
    return tokens.map((token) => ({
      ...token,
      accountId,
    }));
  }
}
