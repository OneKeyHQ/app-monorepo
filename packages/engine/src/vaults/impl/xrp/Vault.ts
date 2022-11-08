/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import BigNumber from 'bignumber.js';
import memoizee from 'memoizee';
import * as XRPL from 'xrpl';

import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';

import { VaultBase } from '../../VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

let clientInstance: XRPL.Client | null = null;
// @ts-ignore
export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  settings = settings;

  async getClient() {
    const { rpcURL } = await this.engine.getNetwork(this.networkId);
    return this.getClientCache(rpcURL);
  }

  getClientCache = memoizee(
    async (rpcUrl) => {
      if (!clientInstance) {
        clientInstance = new XRPL.Client(rpcUrl);
      }
      if (!clientInstance.isConnected()) {
        await clientInstance.connect();
      }
      return clientInstance;
    },
    {
      promise: true,
      max: 1,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  override async getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    const result = await Promise.all(
      requests.map(async ({ address }) => {
        const client = await this.getClient();
        const response = await client.request({
          'command': 'account_info',
          'account': address,
          'ledger_index': 'validated',
        });

        return new BigNumber(response.result?.account_data?.Balance);
      }),
    );

    return result;
  }
}
