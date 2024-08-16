import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { ICustomTokenItem } from '@onekeyhq/shared/types/token';

import { V4MigrationManagerBase } from './V4MigrationManagerBase';

import type { IV4DBAccount } from './v4local/v4localDBTypesSchema';
import type { IV4ReduxTokenState } from './v4types/v4typesRedux';
import type { IDBAccount } from '../../dbs/local/types';

export class V4MigrationForCustomTokens extends V4MigrationManagerBase {
  private async getV4AccountTokens(): Promise<
    IV4ReduxTokenState['accountTokens']
  > {
    const reduxData = await this.v4dbHubs.v4reduxDb.reduxData;
    if (!reduxData) {
      return {};
    }
    const accountTokens = reduxData.tokens?.accountTokens;
    if (Object.values(accountTokens ?? {}).length === 0) {
      return {};
    }
    return accountTokens;
  }

  async migrateCustomTokens({
    v4Account,
    v5Account,
  }: {
    v4Account: IV4DBAccount;
    v5Account: IDBAccount;
  }) {
    await this.v4dbHubs.logger.runAsyncWithCatch(
      async () => {
        console.log('======>>>>>v4Account: ', v4Account);
        console.log('======>>>>>v5Account: ', v5Account);
        const v4AccountTokens = await this.getV4AccountTokens();
        if (Object.keys(v4AccountTokens ?? {}).length === 0) {
          return;
        }

        console.log('======>>>>>v4AccountTokens: ', v4AccountTokens);

        const matchedTokens: {
          networkId: string;
          tokens: ICustomTokenItem[];
        }[] = [];
        for (const [networkId, accountData] of Object.entries(
          v4AccountTokens ?? {},
        )) {
          const isExistNetwork =
            await this.backgroundApi.serviceNetwork.getNetworkSafe({
              networkId,
            });
          if (!isExistNetwork || networkUtils.isBTCNetwork(networkId)) {
            // eslint-disable-next-line no-continue
            continue;
          }
          if (accountData[v4Account.id]) {
            const tokens = accountData[v4Account.id];
            matchedTokens.push({
              networkId,
              tokens: tokens.map((t) => ({
                decimals: t.decimals,
                name: t.name,
                symbol: t.symbol,
                address: t.tokenIdOnNetwork,
                logoURI: t.logoURI,
                isNative: t.isNative,
                networkId,
                accountId: v5Account.id,
                $key: `${networkId}_${t.tokenIdOnNetwork}`,
              })),
            });
          }
        }

        console.log('======>>>>>Matched Tokens: ', matchedTokens);
        for (const { tokens } of matchedTokens) {
          await this.backgroundApi.serviceCustomToken.addCustomTokenBatch({
            tokens,
          });
        }
      },
      {
        name: 'migrateCustomTokens',
        errorResultFn: () => undefined,
      },
    );
  }
}
